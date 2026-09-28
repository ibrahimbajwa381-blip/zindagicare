import { RoleRegisterPage } from "@/features/auth/components/role-register-page";

export const metadata = { title: "Herbalist registration" };

export default function HerbalistRegisterPage() {
  return <RoleRegisterPage role="herbalist" />;
}
