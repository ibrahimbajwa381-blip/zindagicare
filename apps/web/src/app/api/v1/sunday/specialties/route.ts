import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

/** Specialties a patient may ask for on a Sunday free consult request. */
export const GET = withApiHandler(
  async () => SundayConsultService.listRequestableSpecialties(),
  { public: true },
);
