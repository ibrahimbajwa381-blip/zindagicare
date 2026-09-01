import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { CopilotService } from "@/server/services/copilot.service";
import { transcribeAudio } from "@/server/services/gemini-voice.service";
import { canUsePatientWorkspace, type Role } from "@zindagi/shared";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError(new Error("Unauthorized"));
    }
    if (!canUsePatientWorkspace(session.user.roles as Role[])) {
      return apiError(new Error("Forbidden"));
    }

    await CopilotService.ensureEnabled();

    const form = await req.formData();
    const file = form.get("audio");
    const localeRaw = form.get("locale");
    const locale = localeRaw === "ur" ? "ur" : "en";

    if (!file || !(file instanceof Blob)) {
      return apiError(new Error("audio file required"));
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "audio/webm";
    const text = await transcribeAudio(buffer, mimeType, locale);

    return apiSuccess({ text });
  } catch (error) {
    return apiError(error);
  }
}
