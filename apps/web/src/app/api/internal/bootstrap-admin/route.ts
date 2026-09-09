import { NextResponse } from "next/server";
import { randomBytes, timingSafeEqual } from "crypto";
import { bootstrapAdminUser } from "@/server/services/notification.service";

const DEFAULT_EMAIL = "admin@zindagicare.pk";
const DEFAULT_NAME = "ZindagiCare Admin";
const SECRET_HEADER = "x-bootstrap-secret";

function isAuthorized(req: Request): boolean {
  const requiredSecret = process.env.BOOTSTRAP_ADMIN_SECRET;
  if (!requiredSecret) return false;
  const providedSecret = req.headers.get(SECRET_HEADER);
  if (!providedSecret) return false;

  const provided = Buffer.from(providedSecret);
  const required = Buffer.from(requiredSecret);
  // Constant-time compare: a plain === leaks how many leading bytes matched
  // via response timing. Length must match before timingSafeEqual (which
  // throws on mismatched buffer lengths) — that only leaks length, not content.
  return provided.length === required.length && timingSafeEqual(provided, required);
}

/** One-time bootstrap: create or promote the first admin user. Requires the dedicated BOOTSTRAP_ADMIN_SECRET header. */
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL ?? DEFAULT_EMAIL;
    const name = process.env.BOOTSTRAP_ADMIN_NAME ?? DEFAULT_NAME;
    // Never a hardcoded fallback: if BOOTSTRAP_ADMIN_PASSWORD isn't set, generate
    // a random one per-request. It is intentionally never returned in the
    // response, so operators must configure BOOTSTRAP_ADMIN_PASSWORD to know it.
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? randomBytes(24).toString("base64url");

    const result = await bootstrapAdminUser({ email, password, name });

    // Explicit allow-list, not a `...result` spread: keeps this response safe
    // even if the service ever starts returning an extra/sensitive field.
    return NextResponse.json({
      success: true,
      created: result.created,
      email: result.email,
      userId: result.userId,
      message: result.created
        ? "Admin account created. Credentials are intentionally omitted from this response — sign in with the value you already configured for this account."
        : "Existing user promoted to admin. Sign out and sign back in.",
      loginUrl: "/login?callbackUrl=/admin",
    });
  } catch (e) {
    console.error("[bootstrap-admin]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Bootstrap failed" },
      { status: 500 },
    );
  }
}
