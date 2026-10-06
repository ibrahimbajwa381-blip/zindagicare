import { RoleRegisterPage } from "@/features/auth/components/role-register-page";

export const metadata = { title: "Doctor registration" };

export default function DoctorRegisterPage() {
  return <RoleRegisterPage role="doctor" />;
}
