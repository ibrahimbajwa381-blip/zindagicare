export type AppErrorField = "email" | "phone" | "name" | "password" | "city";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
    public readonly field?: AppErrorField,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const ErrorCodes = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION: "VALIDATION",
  SLOT_UNAVAILABLE: "SLOT_UNAVAILABLE",
  USER_BANNED: "USER_BANNED",
  CONFLICT: "CONFLICT",
} as const;
