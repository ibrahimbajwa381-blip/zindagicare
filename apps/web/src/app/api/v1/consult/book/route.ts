import { withApiHandler } from "@/server/api/with-api-handler";
import { AppError, ErrorCodes } from "@zindagi/shared";

/** Deprecated: online consult is paid-only. Use POST /api/v1/consult/checkout. */
export const POST = withApiHandler(
  async () => {
    throw new AppError(
      "Online consultation requires payment via JazzCash. Use /api/v1/consult/checkout.",
      ErrorCodes.VALIDATION,
      402,
    );
  },
  { auth: true },
);
