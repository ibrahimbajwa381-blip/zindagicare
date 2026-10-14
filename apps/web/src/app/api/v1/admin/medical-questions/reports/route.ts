import { Roles } from "@zindagi/shared";
import { MEDICAL_QA_LIMITS, moderateMedicalQaReportSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { readJsonBody } from "@/server/api/read-json-body";
import { viewerFrom } from "@/server/api/medical-qa-route";
import { MedicalQaService } from "@/server/services/medical-qa.service";

const ADMIN_ROLES = [Roles.ADMIN, Roles.SUPER_ADMIN];

/** Open reports on public Q&A content. */
export const GET = withApiHandler(async () => MedicalQaService.listReports(), {
  auth: true,
  roles: ADMIN_ROLES,
});

/** Hide / restore / dismiss — every action is written to the audit log. */
export const PATCH = withApiHandler(
  async ({ req, session }) => {
    const input = await readJsonBody(req, moderateMedicalQaReportSchema, MEDICAL_QA_LIMITS.maxJsonBodyBytes);
    return MedicalQaService.moderate(viewerFrom(session)!, input);
  },
  { auth: true, roles: ADMIN_ROLES },
);
