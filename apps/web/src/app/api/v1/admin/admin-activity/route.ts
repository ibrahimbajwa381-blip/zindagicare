import { withApiHandler } from "@/server/api/with-api-handler";
import {
  getAdminActivityActionOptions,
  listAdminActivity,
} from "@/server/services/admin-activity.service";
import { Roles } from "@zindagi/shared";

export const GET = withApiHandler(async ({ searchParams }) => {
  const [activity, actionOptions] = await Promise.all([
    listAdminActivity({
      page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      action: searchParams.get("action") || undefined,
      entityType: searchParams.get("entityType") || undefined,
      actorId: searchParams.get("actorId") || undefined,
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
    }),
    getAdminActivityActionOptions(),
  ]);
  return { ...activity, actionOptions };
}, { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] });
