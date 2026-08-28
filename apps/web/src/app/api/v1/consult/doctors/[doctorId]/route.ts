import { apiError, apiSuccess } from "@/server/api/response";
import { PublicDoctorService } from "@/server/services/public-doctor.service";
import { ReviewService } from "@/server/services/review.service";
import { AppError } from "@zindagi/shared";

type Params = { params: Promise<{ doctorId: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const { doctorId } = await params;
    const doctor = await PublicDoctorService.getPublicDoctor(doctorId);
    if (!doctor) {
      throw new AppError("Doctor not found", "NOT_FOUND", 404);
    }

    const { reviews, total } = await ReviewService.listDoctorReviews(doctor.doctorId, {
      limit: 20,
    });

    return apiSuccess({ doctor, reviews, reviewTotal: total });
  } catch (error) {
    return apiError(error);
  }
}
