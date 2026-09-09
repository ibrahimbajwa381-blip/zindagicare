import { resolveSession } from "@/server/api/resolve-session";
import { apiError, apiSuccess } from "@/server/api/response";
import {
  getOwnDoctorBankAccount,
  updateOwnDoctorBankAccount,
} from "@/server/services/admin-doctor-finance.service";
import { AppError, Roles } from "@zindagi/shared";

function assertDoctor(roles: string[] = []) {
  if (!roles.includes(Roles.DOCTOR)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
}

export async function GET(req: Request) {
  try {
    const session = await resolveSession(req);
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    assertDoctor(session.user.roles ?? []);

    const bankAccount = await getOwnDoctorBankAccount(session.user.id);
    return apiSuccess({ bankAccount });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await resolveSession(req);
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    assertDoctor(session.user.roles ?? []);

    const body = await req.json();
    const accountTitle = typeof body?.accountTitle === "string" ? body.accountTitle : undefined;
    const accountNumber = typeof body?.accountNumber === "string" ? body.accountNumber : undefined;
    const bankName = typeof body?.bankName === "string" ? body.bankName : undefined;
    const iban = typeof body?.iban === "string" ? body.iban : undefined;

    if (!accountTitle?.trim() || !bankName?.trim() || !(accountNumber?.trim() || iban?.trim())) {
      throw new AppError(
        "Account title, bank name, and account number or IBAN are required",
        "VALIDATION_ERROR",
        400,
      );
    }

    const bankAccount = await updateOwnDoctorBankAccount(session.user.id, {
      accountTitle,
      accountNumber,
      bankName,
      iban,
    });
    return apiSuccess({ bankAccount });
  } catch (error) {
    return apiError(error);
  }
}
