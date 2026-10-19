import { withApiHandler } from "@/server/api/with-api-handler";
import {
  createManualEarning,
  createManualEarningSchema,
  listManualEarningProviders,
  type CreateManualEarningInput,
} from "@/server/services/admin-manual-earnings.service";
import { Roles } from "@zindagi/shared";

const adminRoles = [Roles.ADMIN, Roles.SUPER_ADMIN];

/** Providers (with default commission splits) for the manual-entry form. */
export const GET = withApiHandler(async () => listManualEarningProviders(), {
  auth: true,
  roles: adminRoles,
});

export const POST = withApiHandler<CreateManualEarningInput>(
  async ({ session, body }) =>
    createManualEarning(
      {
        id: session!.user.id,
        roles: session!.user.roles,
        name: session!.user.name,
        email: session!.user.email,
      },
      body,
    ),
  { auth: true, roles: adminRoles, bodySchema: createManualEarningSchema },
);
