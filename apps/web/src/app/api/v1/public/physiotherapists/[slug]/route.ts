import { apiError, apiSuccess } from "@/server/api/response";
import { PublicPhysiotherapistService } from "@/server/services/public-physiotherapist.service";
import { AppError } from "@zindagi/shared";

type Params = { params: Promise<{ slug: string }> };

/** Public profile by slug or user id. */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const physio = await PublicPhysiotherapistService.get(slug);
    if (!physio) {
      throw new AppError("Physiotherapist not found", "NOT_FOUND", 404);
    }
    return apiSuccess(physio);
  } catch (error) {
    return apiError(error);
  }
}
