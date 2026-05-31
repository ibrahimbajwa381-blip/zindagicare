import { NextResponse } from "next/server";
import { bootstrapAdminUser } from "@/server/services/notification.service";

const DEFAULT_EMAIL = "admin@zindagicare.pk";
const DEFAULT_PASSWORD = "Admin@12345";
const DEFAULT_NAME = "ZindagiCare Admin";

/** Dev/bootstrap: create or promote the first admin user. */
export async function POST() {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_BOOTSTRAP_ADMIN) {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL ?? DEFAULT_EMAIL;
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? DEFAULT_PASSWORD;
    const name = process.env.BOOTSTRAP_ADMIN_NAME ?? DEFAULT_NAME;

    const result = await bootstrapAdminUser({ email, password, name });

    return NextResponse.json({
      success: true,
      ...result,
      credentials: { email, password },
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

export async function GET() {
  return NextResponse.json({
    message: "POST to this endpoint to create the first admin user.",
    defaultCredentials: {
      email: process.env.BOOTSTRAP_ADMIN_EMAIL ?? DEFAULT_EMAIL,
      password: process.env.BOOTSTRAP_ADMIN_PASSWORD ?? DEFAULT_PASSWORD,
    },
    steps: [
      "1. POST /api/internal/bootstrap-admin",
      "2. Sign in at /login with the credentials returned",
      "3. Open /admin dashboard",
    ],
  });
}
