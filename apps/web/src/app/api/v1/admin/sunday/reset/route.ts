import { withApiHandler } from "@/server/api/with-api-handler";
import {
  resetWeeklySundaySlots,
  applyDefaultSlotsToAllDoctors,
} from "@/server/services/admin-sunday.service";
import { Roles } from "@zindagi/shared";

export const POST = withApiHandler(
  async ({ searchParams }) => {
    const action = searchParams.get("action") ?? "reset";
    const dateKey = searchParams.get("date") ?? undefined;

    if (action === "apply-defaults") {
      return applyDefaultSlotsToAllDoctors();
    }

    return resetWeeklySundaySlots(dateKey);
  },
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);
