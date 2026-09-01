import { redirect } from "next/navigation";
import { AUTH_ROUTES } from "@/lib/auth/routes";

export default function DoctorRegisterPage() {
  redirect(AUTH_ROUTES.register);
}
