import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { verifyMobileToken } from "./mobile-jwt";
import { loadAuthUserPayload } from "@/server/services/auth.service";

/**
 * Cookie sessions (web) and Bearer access tokens (mobile) both resolve to the
 * same Session shape so every existing v1 route works from either client
 * without per-route changes. Typed against the minimal Request shape (not
 * NextRequest) so raw Route Handlers using the plain Web Request/FormData
 * APIs — e.g. multipart file uploads — can call this too.
 */
export async function resolveSession(req: Pick<Request, "headers">): Promise<Session | null> {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    try {
      const { sub } = await verifyMobileToken(token, "access");
      const payload = await loadAuthUserPayload(sub);
      if (!payload) return null;
      return {
        user: payload,
        expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      } as Session;
    } catch {
      return null;
    }
  }

  return (await auth()) as Session | null;
}
