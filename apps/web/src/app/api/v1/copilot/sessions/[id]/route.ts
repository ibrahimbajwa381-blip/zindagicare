import { withApiHandler } from "@/server/api/with-api-handler";
import { CopilotService } from "@/server/services/copilot.service";
import { canAccessHealthAssistant, type Role } from "@zindagi/shared";
import { AppError } from "@zindagi/shared";

type Params = { params: Promise<{ id: string }> };

function assertPatient(session: { user?: { id?: string; roles?: string[] } }) {
  if (!session.user?.id) {
    throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
  }
  if (!canAccessHealthAssistant(session.user.roles as Role[])) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
}

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const handler = withApiHandler(
    async ({ session }) => {
      assertPatient(session!);
      return CopilotService.getSession(session!.user!.id, id);
    },
    { auth: true },
  );
  return handler(req as never);
}

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const handler = withApiHandler(
    async ({ session }) => {
      assertPatient(session!);
      await CopilotService.archiveSession(session!.user!.id, id);
      return { ok: true };
    },
    { auth: true },
  );
  return handler(req as never);
}
