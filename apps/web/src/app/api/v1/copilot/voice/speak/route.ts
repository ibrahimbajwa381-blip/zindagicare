import { z } from "zod";
import { withApiHandler } from "@/server/api/with-api-handler";
import { CopilotService } from "@/server/services/copilot.service";
import { synthesizeSpeech } from "@/server/services/gemini-voice.service";
import { canUsePatientWorkspace, type Role, type Workspace } from "@zindagi/shared";
import { AppError } from "@zindagi/shared";

const speakSchema = z.object({
  text: z.string().min(1).max(4000),
  locale: z.enum(["en", "ur"]).optional(),
});

function assertPatient(session: {
  user?: { id?: string; roles?: string[]; activeWorkspace?: string };
}) {
  if (!session.user?.id) {
    throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
  }
  if (
    !canUsePatientWorkspace(
      session.user.roles as Role[],
      session.user.activeWorkspace as Workspace | undefined,
    )
  ) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
}

export const POST = withApiHandler(
  async ({ session, body }) => {
    assertPatient(session!);
    await CopilotService.ensureEnabled();
    const locale = body.locale ?? "ur";
    return synthesizeSpeech(body.text, locale);
  },
  { auth: true, bodySchema: speakSchema },
);
