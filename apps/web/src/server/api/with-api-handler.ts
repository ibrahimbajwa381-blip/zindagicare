import type { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "./response";
import { AppError } from "@zindagi/shared";
import type { ZodType } from "zod";

type HandlerContext<TBody> = {
  req: NextRequest;
  session: Session | null;
  body: TBody;
  searchParams: URLSearchParams;
};

type Options<TBody> = {
  auth?: boolean;
  /** Skip session lookup — for public read endpoints. */
  public?: boolean;
  roles?: string[];
  bodySchema?: ZodType<TBody>;
};

export function withApiHandler<TBody = unknown>(
  handler: (ctx: HandlerContext<TBody>) => Promise<unknown>,
  options: Options<TBody> = {},
) {
  return async (req: NextRequest) => {
    try {
      const session = options.public
        ? null
        : ((await auth()) as Session | null);

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

      let body = undefined as TBody;
      if (options.bodySchema && req.method !== "GET") {
        const json = await req.json();
        body = options.bodySchema.parse(json) as TBody;
      }

      const data = await handler({
        req,
        session,
        body,
        searchParams: req.nextUrl.searchParams,
      });

      return apiSuccess(data);
    } catch (e) {
      return apiError(e);
    }
  };
}
