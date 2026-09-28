import { RoleRegisterPage } from "@/features/auth/components/role-register-page";

export const metadata = { title: "Physiotherapist registration" };

export default function PhysiotherapistRegisterPage() {
  return <RoleRegisterPage role="physiotherapist" />;
}
