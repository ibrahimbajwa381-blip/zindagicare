import { withApiHandler } from "@/server/api/with-api-handler";
import {
  createPlanningItem,
  getPlanningBoard,
} from "@/server/services/admin-planning.service";
import { Roles } from "@zindagi/shared";
import {
  planningBoardQuerySchema,
  planningItemSchema,
  type PlanningItemInput,
} from "@zindagi/validators";

const adminRoles = [Roles.ADMIN, Roles.SUPER_ADMIN];

/** Every planning entry, plus live platform numbers for `?month=YYYY-MM` (default: this month). */
export const GET = withApiHandler(
  async ({ searchParams }) => {
    const { month } = planningBoardQuerySchema.parse({
      month: searchParams.get("month") ?? undefined,
    });
    return getPlanningBoard(month);
  },
  { auth: true, roles: adminRoles },
);

export const POST = withApiHandler<PlanningItemInput>(
  async ({ session, body }) =>
    createPlanningItem(
      {
        id: session!.user.id,
        roles: session!.user.roles,
        name: session!.user.name,
        email: session!.user.email,
      },
      body,
    ),
  { auth: true, roles: adminRoles, bodySchema: planningItemSchema },
);
