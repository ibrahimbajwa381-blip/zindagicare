import { createCopilotSessionSchema, listCopilotSessionsQuerySchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { CopilotService } from "@/server/services/copilot.service";
import { canAccessHealthAssistant, type Role } from "@zindagi/shared";
import { AppError } from "@zindagi/shared";

function assertPatient(session: { user?: { id?: string; roles?: string[] } }) {
  if (!session.user?.id) {
    throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
  }
  if (!canAccessHealthAssistant(session.user.roles as Role[])) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
}

export const GET = withApiHandler(
  async ({ session, searchParams }) => {
    assertPatient(session!);
    const query = listCopilotSessionsQuerySchema.parse({
      limit: searchParams.get("limit") ?? undefined,
    });
    return CopilotService.listSessions(session!.user!.id, query.limit ?? 20);
  },
  { auth: true },
);

export const POST = withApiHandler(
  async ({ session, body }) => {
    assertPatient(session!);
    return CopilotService.createSession(session!.user!.id, body.locale);
  },
  { auth: true, bodySchema: createCopilotSessionSchema },
);
