import { apiError, apiSuccess } from "@/server/api/response";
import { saveTestimonialAvatar } from "@/server/services/testimonial-avatar.storage";
import { AppError } from "@zindagi/shared";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError("Photo file is required", "VALIDATION_ERROR", 400);
    }

    const stored = await saveTestimonialAvatar(file);
    return apiSuccess(stored);
  } catch (error) {
    return apiError(error);
  }
}
