import { withApiHandler } from "@/server/api/with-api-handler";
import {
  getOwnPhysiotherapistBankAccount,
  updateOwnPhysiotherapistBankAccount,
} from "@/server/services/physiotherapist-finance.service";
import { physiotherapistBankAccountSchema } from "@zindagi/validators";

export const GET = withApiHandler(
  async ({ session }) => {
    const bankAccount = await getOwnPhysiotherapistBankAccount(session!.user.id);
    return { bankAccount };
  },
  { auth: true, roles: ["physiotherapist"] },
);

export const PATCH = withApiHandler(
  async ({ session, body }) => {
    const bankAccount = await updateOwnPhysiotherapistBankAccount(session!.user.id, body);
    return { bankAccount };
  },
  { auth: true, roles: ["physiotherapist"], bodySchema: physiotherapistBankAccountSchema },
);
