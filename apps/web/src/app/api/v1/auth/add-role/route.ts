import { addStaffRoleSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { addStaffRoleToUser } from "@/server/services/auth.service";

export const POST = withApiHandler(
  async ({ session, body }) => {
    const payload = await addStaffRoleToUser(
      session!.user.id,
      body.accountType,
      body.city,
    );
    return { user: payload };
  },
  { auth: true, bodySchema: addStaffRoleSchema },
);
