import { AppError, ErrorCodes } from "@zindagi/shared";
import { withApiHandler } from "@/server/api/with-api-handler";

/** Urgent care is paid-only. Use POST /api/v1/urgent/checkout. */
export const POST = withApiHandler(async () => {
  throw new AppError(
    "Urgent care requires payment. Use POST /api/v1/urgent/checkout.",
    ErrorCodes.VALIDATION,
    400,
  );
});
