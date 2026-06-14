import { connectDatabase } from "@zindagi/database";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const checkDb = new URL(req.url).searchParams.get("db") === "1";
  const data: Record<string, string> = {
    status: "ok",
    service: "zindagicare-web",
  };

  if (checkDb) {
    try {
      await connectDatabase();
      data.database = "connected";
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Database connection failed";
      data.database = "error";
      data.databaseError = message.includes("MONGODB_URI")
        ? "MONGODB_URI is not set in the deployment environment"
        : message.slice(0, 200);

      return NextResponse.json(
        {
          success: false,
          data,
          error: { code: "DB_UNAVAILABLE", message: data.databaseError },
          meta: { timestamp: new Date().toISOString() },
        },
        { status: 503 },
      );
    }
  }

  return NextResponse.json({
    success: true,
    data,
    meta: { timestamp: new Date().toISOString() },
  });
}
