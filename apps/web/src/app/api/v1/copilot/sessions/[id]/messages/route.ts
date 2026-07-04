import { auth } from "@/lib/auth";
import { apiError } from "@/server/api/response";
import { CopilotService } from "@/server/services/copilot.service";
import { canAccessHealthAssistant, type Role } from "@zindagi/shared";
import { listCopilotMessagesQuerySchema, sendCopilotMessageSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";

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
        throw new Error("Forbidden");
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
      return apiError(new Error("Unauthorized"));
    }
    if (!canAccessHealthAssistant(session.user.roles as Role[])) {
      return apiError(new Error("Forbidden"));
    }

    const json = await req.json();
    const body = sendCopilotMessageSchema.parse(json);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };

        try {
          await CopilotService.sendMessageStream(
            session.user!.id,
            sessionId,
            body,
            (evt) => {
              send(evt.type, evt);
            },
          );
        } catch (error) {
          send("error", {
            type: "error",
            message: error instanceof Error ? error.message : "Something went wrong",
          });
        } finally {
          controller.close();
        }
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
