"use client";

import { HomeVisitServiceTypes } from "@zindagi/shared";
import {
  AssignedHomeVisitsDashboard,
  type AssignedHomeVisitsServiceLabels,
} from "./assigned-home-visits-dashboard";
import { AUTH_ROUTES } from "@/lib/auth/routes";

const SERVICE_LABELS: AssignedHomeVisitsServiceLabels = {
  [HomeVisitServiceTypes.IV_DRIP]: "ivDrip",
  [HomeVisitServiceTypes.INJECTION]: "injection",
  [HomeVisitServiceTypes.WOUND_CARE]: "woundCare",
};

export function NurseVisitsDashboard() {
  return (
    <AssignedHomeVisitsDashboard
      serviceLabels={SERVICE_LABELS}
      messagesHref={AUTH_ROUTES.nurseMessages}
      requireVisitSummary
    />
  );
}
