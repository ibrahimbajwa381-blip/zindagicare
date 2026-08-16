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
    const issue = error.issues[0];
    const field = issue?.path?.length ? issue.path.join(".") : undefined;
    const message = issue?.message ?? "Invalid input";
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          code: "VALIDATION_ERROR",
          message: field ? `${field}: ${message}` : message,
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
