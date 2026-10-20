import { DoctorProfileModel, connectDatabase } from "@zindagi/database";
import { Roles } from "@zindagi/shared";
import { mongoFilter } from "@/lib/mongo/query";
import { withApiHandler } from "@/server/api/with-api-handler";

/** Marks the doctor as having joined the Doctors' Community so the invite banner stops showing. */
export const POST = withApiHandler(
  async ({ session }) => {
    await connectDatabase();
    await DoctorProfileModel.updateOne(
      mongoFilter({ userId: session!.user.id, communityJoinedAt: { $exists: false } }),
      { $set: { communityJoinedAt: new Date() } },
    );
    return { ok: true };
  },
  { auth: true, roles: [Roles.DOCTOR] },
);
