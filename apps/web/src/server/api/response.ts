import { NextResponse } from "next/server";
import { ZodError } from "zod";
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

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message ?? "Invalid input",
        },
      },
      { status: 400 },
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
