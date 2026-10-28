import { auth } from "@/lib/auth";
import { apiError } from "@/server/api/response";
import { CopilotService } from "@/server/services/copilot.service";
import { AppError, canAccessHealthAssistant, type Role } from "@zindagi/shared";
import { listCopilotMessagesQuerySchema, sendCopilotMessageSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { GEMINI_TIMEOUT_MESSAGE } from "@/server/services/gemini.service";

const COPILOT_DEADLINE_MS = 60_000;

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const url = new URL(req.url);
  const query = listCopilotMessagesQuerySchema.parse({
    before: url.searchParams.get("before") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  const handler = withApiHandler(
    async ({ session }) => {
      if (!canAccessHealthAssistant(session!.user!.roles as Role[])) {
        throw new AppError("Forbidden", "FORBIDDEN", 403);
      }
      return CopilotService.listMessages(session!.user!.id, id, query.limit ?? 50);
    },
    { auth: true },
  );

  return handler(req as never);
}

export async function POST(req: Request, { params }: Params) {
  const { id: sessionId } = await params;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError(new AppError("Unauthorized", "UNAUTHORIZED", 401));
    }
    if (!canAccessHealthAssistant(session.user.roles as Role[])) {
      return apiError(new AppError("Forbidden", "FORBIDDEN", 403));
    }

    // Must happen before the SSE stream opens: a throw from inside the
    // stream body can only ever reach the client as an `error` event on an
    // already-200 response, never a real 429.
    CopilotService.checkRateLimit(session.user.id);

    const json = await req.json();
    const body = sendCopilotMessageSchema.parse(json);

    // Whole-question budget across all Gemini rounds and tool calls.
    const deadline = AbortSignal.timeout(COPILOT_DEADLINE_MS);
    const disconnected = new AbortController();
    const signal = AbortSignal.any([req.signal, deadline, disconnected.signal]);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let closed = false;

        const send = (event: string, data: unknown) => {
          if (closed) return;
          try {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
            );
          } catch {
            closed = true; // Client went away; stop writing.
          }
        };

        try {
          await CopilotService.sendMessageStream(
            session.user!.id,
            sessionId,
            body,
            (evt) => {
              send(evt.type, evt);
            },
            signal,
          );
        } catch (error) {
          send("error", {
            type: "error",
            message: deadline.aborted
              ? GEMINI_TIMEOUT_MESSAGE
              : error instanceof Error
                ? error.message
                : "Something went wrong",
          });
        } finally {
          if (!closed) {
            closed = true;
            controller.close();
          }
        }
      },
      cancel() {
        disconnected.abort();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
