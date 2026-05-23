import { NextResponse } from "next/server";
import { AppError } from "@zindagi/shared";

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data, error: null }, { status });
}

export function apiError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: error.code, message: error.message },
      },
      { status: error.statusCode },
    );
  }

  console.error(error);
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    },
    { status: 500 },
  );
}
