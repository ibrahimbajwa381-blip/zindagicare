import { RoleRegisterPage } from "@/features/auth/components/role-register-page";

export const metadata = { title: "Nutritionist registration" };

export default function NutritionistRegisterPage() {
  return <RoleRegisterPage role="nutritionist" />;
}
