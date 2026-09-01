import { redirect } from "next/navigation";
import { AUTH_ROUTES } from "@/lib/auth/routes";

export default function PhysiotherapistRegisterPage() {
  redirect(AUTH_ROUTES.register);
}
