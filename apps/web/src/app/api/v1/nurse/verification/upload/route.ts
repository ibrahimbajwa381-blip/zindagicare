import { resolveSession } from "@/server/api/resolve-session";
import { apiError, apiSuccess } from "@/server/api/response";
import { saveNurseDocument } from "@/server/services/nurse-documents.storage";
import { AppError, Roles } from "@zindagi/shared";

export async function POST(req: Request) {
  try {
    const session = await resolveSession(req);
    if (!session?.user?.id) {
      throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    }
    if (!session.user.roles?.includes(Roles.NURSE)) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError("File is required", "VALIDATION_ERROR", 400);
    }

    const stored = await saveNurseDocument(session.user.id, file);
    return apiSuccess(stored);
  } catch (error) {
    return apiError(error);
  }
}
