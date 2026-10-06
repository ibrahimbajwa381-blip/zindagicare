import { apiError, apiSuccess } from "@/server/api/response";
import { PublicNurseService } from "@/server/services/public-nurse.service";
import { AppError } from "@zindagi/shared";

type Params = { params: Promise<{ slug: string }> };

/** Public profile by slug or user id. */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const nurse = await PublicNurseService.get(slug);
    if (!nurse) {
      throw new AppError("Nurse not found", "NOT_FOUND", 404);
    }
    return apiSuccess(nurse);
  } catch (error) {
    return apiError(error);
  }
}
