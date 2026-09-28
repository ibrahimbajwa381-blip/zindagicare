import { cookies } from "next/headers";

/** Anonymous-visitor cookie set by the page-view tracker (`/api/v1/activity/track`). */
export const VISITOR_COOKIE = "zc_visitor";

/**
 * Reads the anonymous-visitor id for the current request, so a signup can be
 * tied back to the visits that preceded it. Undefined outside a request scope
 * or for clients without the cookie (e.g. the mobile app).
 */
export async function readVisitorId(): Promise<string | undefined> {
  try {
    return (await cookies()).get(VISITOR_COOKIE)?.value || undefined;
  } catch {
    return undefined;
  }
}
