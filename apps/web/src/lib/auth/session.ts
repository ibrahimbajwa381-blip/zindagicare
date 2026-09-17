import type { Session } from "next-auth";
import { auth } from "./auth";

export type AuthSessionUser = NonNullable<Session["user"]>;

export async function getSession() {
  return auth();
}
