import { RoleRegisterPage } from "@/features/auth/components/role-register-page";

export const metadata = { title: "Nurse registration" };

export default function NurseRegisterPage() {
  return <RoleRegisterPage role="nurse" />;
}
