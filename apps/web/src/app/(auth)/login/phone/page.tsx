import { redirect } from "next/navigation";
import { AUTH_ROUTES } from "@/lib/auth/routes";

type Props = { searchParams: Promise<{ callbackUrl?: string }> };

/** Legacy URL — forgot password is phone-only. */
export default async function PhoneLoginRedirectPage({ searchParams }: Props) {
  const { callbackUrl } = await searchParams;
  const destination = callbackUrl
    ? `${AUTH_ROUTES.forgotPassword}?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : AUTH_ROUTES.forgotPassword;
  redirect(destination);
}
