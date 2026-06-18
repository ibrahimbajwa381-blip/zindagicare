import { AuthError } from "next-auth";

export function isDatabaseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("mongodb") ||
    msg.includes("querysrv") ||
    msg.includes("mongoserverselectionerror") ||
    msg.includes("econnrefused") ||
    msg.includes("mongodb_uri")
  );
}

export function resolveAuthErrorMessage(code?: string): string | undefined {
  switch (code) {
    case "CredentialsSignin":
      return "Invalid email or password";
    case "OAuthAccountNotLinked":
      return "This email is already registered. Sign in with your password instead.";
    case "Configuration":
      return "Google sign-in is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment.";
    case "AccessDenied":
      return "Access denied. Please try again.";
    default:
      return code ? "Sign-in failed. Please try again." : undefined;
  }
}

export function authActionErrorMessage(error: unknown): string | undefined {
  if (error instanceof AuthError) {
    return resolveAuthErrorMessage(error.type) ?? "Invalid email or password";
  }
  if (isDatabaseError(error)) {
    return "Unable to connect to the server. Please try again in a moment.";
  }
  return undefined;
}
