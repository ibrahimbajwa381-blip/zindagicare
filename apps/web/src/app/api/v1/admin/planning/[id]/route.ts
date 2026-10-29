import type { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { withApiHandler } from "@/server/api/with-api-handler";
import {
  deletePlanningItem,
  updatePlanningItem,
} from "@/server/services/admin-planning.service";
import { Roles } from "@zindagi/shared";
import { planningItemSchema, type PlanningItemInput } from "@zindagi/validators";

const adminRoles = [Roles.ADMIN, Roles.SUPER_ADMIN];

/** Last path segment — read off the URL so the handler stays module-scoped. */
function itemId(req: NextRequest): string {
  return decodeURIComponent(new URL(req.url).pathname.split("/").pop() ?? "");
}

function actorOf(session: Session | null) {
  return {
    id: session!.user.id,
    roles: session!.user.roles,
    name: session!.user.name,
    email: session!.user.email,
  };
}

export const PATCH = withApiHandler<PlanningItemInput>(
  async ({ req, session, body }) => updatePlanningItem(actorOf(session), itemId(req), body),
  { auth: true, roles: adminRoles, bodySchema: planningItemSchema },
);

export const DELETE = withApiHandler(
  async ({ req, session }) => deletePlanningItem(actorOf(session), itemId(req)),
  { auth: true, roles: adminRoles },
);
