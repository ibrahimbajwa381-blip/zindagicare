import type { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { resolveSession } from "./resolve-session";
import { apiError, apiSuccess } from "./response";
import { AppError } from "@zindagi/shared";
import type { ZodType } from "zod";
import { createRateLimiter, enforceRateLimit, getClientIp } from "@/server/lib/rate-limit";
import { flushCacheInvalidations } from "@/server/lib/cache";

type HandlerContext<TBody> = {
  req: NextRequest;
  session: Session | null;
  body: TBody;
  searchParams: URLSearchParams;
};

type RateLimitOptions = {
  /** Max requests allowed within `windowMs`. */
  limit: number;
  windowMs: number;
  /**
   * Identity to key the budget on. "user" falls back to client IP when the
   * request is unauthenticated (e.g. `public` routes). Default: "user".
   */
  by?: "user" | "ip";
  message?: string;
};

type Options<TBody> = {
  auth?: boolean;
  /** Skip session lookup — for public read endpoints. */
  public?: boolean;
  roles?: string[];
  bodySchema?: ZodType<TBody>;
  /**
   * Per-route abuse throttle. The limiter is created once per route (module
   * load), so each route gets its own independent budget.
   */
  rateLimit?: RateLimitOptions;
};

export function withApiHandler<TBody = unknown>(
  handler: (ctx: HandlerContext<TBody>) => Promise<unknown>,
  options: Options<TBody> = {},
) {
  const limiter = options.rateLimit
    ? createRateLimiter(options.rateLimit.limit, options.rateLimit.windowMs)
    : null;

  /**
   * IMPORTANT: call withApiHandler(...) once at module scope, not from
   * inside the exported route function. Building a fresh handler per
   * request (e.g. to close over an `await params` value from a dynamic
   * segment) creates a fresh — and therefore useless — rate limiter on
   * every single call, silently disabling `rateLimit`. Routes that need a
   * dynamic segment inside the handler should read it off `req.url`
   * instead of closing over it; see the chat threads/[threadId]/messages
   * route for the pattern.
   */
  return async (req: NextRequest) => {
    try {
      const session = options.public ? null : await resolveSession(req);

      if (options.auth && !session?.user?.id) {
        throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
      }

      if (options.roles?.length) {
        const userRoles = session?.user?.roles ?? [];
        const allowed = options.roles.some((r) => userRoles.includes(r as never));
        if (!allowed) {
          throw new AppError("Forbidden", "FORBIDDEN", 403);
        }
      }

      if (limiter) {
        const identity =
          options.rateLimit?.by === "ip"
            ? `ip:${getClientIp(req)}`
            : (session?.user?.id ? `user:${session.user.id}` : `ip:${getClientIp(req)}`);
        enforceRateLimit(limiter, identity, options.rateLimit?.message);
      }

      let body = undefined as TBody;
      if (options.bodySchema && req.method !== "GET") {
        let json: unknown;
        try {
          json = await req.json();
        } catch {
          // req.json() throws a raw SyntaxError on malformed JSON, which
          // apiError() doesn't special-case — left uncaught here it fell
          // through to a generic 500 instead of a 400 the client can act on.
          throw new AppError("Malformed JSON body", "VALIDATION_ERROR", 400);
        }
        body = options.bodySchema.parse(json) as TBody;
      }

      const data = await handler({
        req,
        session,
        body,
        searchParams: req.nextUrl?.searchParams ?? new URL(req.url).searchParams,
      });

      if (req.method !== "GET" && req.method !== "HEAD") {
        await flushCacheInvalidations();
      }

      return apiSuccess(data);
    } catch (e) {
      return apiError(e);
    }
  };
}
