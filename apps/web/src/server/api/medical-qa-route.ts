import type { Session } from "next-auth";
import { getClientIp } from "@/server/lib/rate-limit";
import {
  enforceDistributedRateLimit,
  type DistributedRateLimiter,
} from "@/server/lib/distributed-rate-limit";
import type { Viewer } from "@/server/services/medical-qa.service";

/** Shared plumbing for the /api/v1/medical-questions/* route handlers. */

export function viewerFrom(session: Session | null): Viewer {
  const user = session?.user;
  if (!user?.id) return null;
  return { id: user.id, roles: user.roles ?? [] };
}

/**
 * Path segments after `/medical-questions/`. Read off the URL (not the route
 * `params`) so handlers can be built once at module scope — see the note in
 * withApiHandler about per-request handlers silently resetting rate limits.
 */
export function medicalQaPathIds(url: string): string[] {
  const segments = new URL(url).pathname.split("/");
  const start = segments.indexOf("medical-questions");
  return segments.slice(start + 1).filter(Boolean);
}

/** Signed-in users are limited by account; anonymous callers by client IP. */
export function rateLimitMedicalQa(
  limiter: DistributedRateLimiter,
  req: Request,
  session: Session | null,
  message = "You're doing that too often. Please wait a little and try again.",
) {
  const identity = session?.user?.id ? `user:${session.user.id}` : `ip:${getClientIp(req)}`;
  return enforceDistributedRateLimit(limiter, identity, message);
}
