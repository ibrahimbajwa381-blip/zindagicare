import { Roles } from "@zindagi/shared";
import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

/** Open Sunday free consult requests any verified doctor can pick, plus the doctor's own picks. */
export const GET = withApiHandler(
  async ({ session, searchParams }) => {
    const date = searchParams.get("date") ?? undefined;
    return SundayConsultService.listDoctorRequests(session!.user!.id, date);
  },
  { auth: true, roles: [Roles.DOCTOR] },
);
