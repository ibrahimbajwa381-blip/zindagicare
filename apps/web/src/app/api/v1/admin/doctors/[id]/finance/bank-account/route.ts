import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { updateDoctorBankAccount } from "@/server/services/admin-doctor-finance.service";
import { AppError, Roles } from "@zindagi/shared";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    const roles = session.user.roles ?? [];
    if (!roles.includes(Roles.ADMIN) && !roles.includes(Roles.SUPER_ADMIN)) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const { id } = await params;
    const body = await req.json();
    const bankAccount = await updateDoctorBankAccount(id, {
      accountTitle: typeof body?.accountTitle === "string" ? body.accountTitle : undefined,
      accountNumber: typeof body?.accountNumber === "string" ? body.accountNumber : undefined,
      bankName: typeof body?.bankName === "string" ? body.bankName : undefined,
      iban: typeof body?.iban === "string" ? body.iban : undefined,
    });
    return apiSuccess({ bankAccount });
  } catch (error) {
    return apiError(error);
  }
}
