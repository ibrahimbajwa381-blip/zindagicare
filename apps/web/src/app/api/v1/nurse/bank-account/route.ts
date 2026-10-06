import { withApiHandler } from "@/server/api/with-api-handler";
import {
  getOwnNurseBankAccount,
  updateOwnNurseBankAccount,
} from "@/server/services/nurse-finance.service";
import { nurseBankAccountSchema } from "@zindagi/validators";

export const GET = withApiHandler(
  async ({ session }) => {
    const bankAccount = await getOwnNurseBankAccount(session!.user.id);
    return { bankAccount };
  },
  { auth: true, roles: ["nurse"] },
);

export const PATCH = withApiHandler(
  async ({ session, body }) => {
    const bankAccount = await updateOwnNurseBankAccount(session!.user.id, body);
    return { bankAccount };
  },
  { auth: true, roles: ["nurse"], bodySchema: nurseBankAccountSchema },
);
