import { Roles } from "@zindagi/shared";
import { resolveDashboardMenuLinks } from "@/lib/nav/header-actions";

const labels = {
  myDashboard: "My dashboard",
  patientDashboard: "Patient dashboard",
  doctorDashboard: "Doctor dashboard",
  adminDashboard: "Admin dashboard",
};

describe("resolveDashboardMenuLinks", () => {
  it("gives an admin who is also a patient both dashboards", () => {
    expect(resolveDashboardMenuLinks([Roles.PATIENT, Roles.ADMIN], labels)).toEqual([
      { href: "/dashboard", label: "My dashboard" },
      { href: "/admin", label: "Admin dashboard" },
    ]);
  });

  it("gives an admin-only user just the admin dashboard", () => {
    expect(resolveDashboardMenuLinks([Roles.ADMIN], labels)).toEqual([
      { href: "/admin", label: "Admin dashboard" },
    ]);
  });
});
