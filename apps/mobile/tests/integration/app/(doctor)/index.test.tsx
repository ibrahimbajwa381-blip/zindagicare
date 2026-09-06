import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import DoctorDashboardScreen from "@app/(doctor)/index";
import { getDoctorSummary, getDoctorProfile } from "@/api/doctor";
import { ApiRequestError } from "@/api/client";
import { router } from "expo-router";

jest.mock("@/api/doctor");

const mockGetSummary = getDoctorSummary as jest.Mock;
const mockGetProfile = getDoctorProfile as jest.Mock;

const summary = {
  patients: 12,
  pendingRequests: 3,
  sundayQueue: 0,
  homeVisitRequests: 0,
  urgentCalls: 0,
  totalEarnings: 100000,
  earningsThisMonth: 25000,
  availableBalance: 15000,
  ratingAvg: 4.75,
  ratingCount: 40,
  completedThisMonth: 10,
  completedAllTime: 100,
  todayAppointments: 2,
  upcomingThisWeek: 5,
  completionRate: 92,
  prescriptionsWritten: 30,
  returningPatients: 8,
};

const profile = {
  id: "doc-1",
  user: { id: "u-1", name: "Bilal Chaudhry", memberSince: "2023-01-01" },
  pmdcVerified: true,
  qualifications: [],
  experienceYears: 5,
  additionalSpecialties: [],
  specialties: ["Dermatology"],
  languages: [],
  hospitals: [],
  consultationFee: 2000,
  weeklyAvailability: [],
  sundayConsult: { enabled: false, slotDurationMins: 10 },
  homeVisit: { enabled: false },
  verificationStatus: "verified",
  isListed: true,
  documents: {},
};

describe("DoctorDashboardScreen", () => {
  beforeEach(() => {
    mockGetSummary.mockResolvedValue(summary);
    mockGetProfile.mockResolvedValue(profile);
  });

  it("greets the doctor by first name and shows key stats", async () => {
    await render(<DoctorDashboardScreen />);
    await waitFor(() => expect(screen.getByText("Hi, Bilal")).toBeTruthy());
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("4.8 (40)")).toBeTruthy();
    expect(screen.getByText("Rs. 25,000")).toBeTruthy();
  });

  it("shows an error message when loading fails", async () => {
    mockGetSummary.mockRejectedValue(new ApiRequestError("Not authorized", "AUTH", 401));
    await render(<DoctorDashboardScreen />);
    expect(await screen.findByText("Not authorized")).toBeTruthy();
  });

  it("shows a pending-verification banner", async () => {
    mockGetProfile.mockResolvedValue({ ...profile, verificationStatus: "pending" });
    await render(<DoctorDashboardScreen />);
    expect(await screen.findByText("Verification pending")).toBeTruthy();
  });

  it("shows a rejected-verification banner", async () => {
    mockGetProfile.mockResolvedValue({ ...profile, verificationStatus: "rejected" });
    await render(<DoctorDashboardScreen />);
    expect(await screen.findByText("Verification rejected")).toBeTruthy();
  });

  it("shows no banner when verified", async () => {
    await render(<DoctorDashboardScreen />);
    await waitFor(() => expect(screen.getByText("Hi, Bilal")).toBeTruthy());
    expect(screen.queryByText("Verification pending")).toBeNull();
    expect(screen.queryByText("Verification rejected")).toBeNull();
  });

  it("navigates to each quick action destination", async () => {
    await render(<DoctorDashboardScreen />);
    await waitFor(() => expect(screen.getByText("Hi, Bilal")).toBeTruthy());

    const destinations: [string, string][] = [
      ["Consult requests", "/(doctor)/requests"],
      ["Patients", "/(doctor)/patients"],
      ["Earnings", "/(doctor)/earnings"],
      ["Prescriptions", "/(doctor)/prescriptions"],
      ["Referrals", "/(doctor)/referrals"],
      ["Verification", "/(doctor)/verification"],
      ["Urgent calls", "/(doctor)/urgent-calls"],
      ["Sunday consult", "/(doctor)/sunday-consult"],
      ["Home visits", "/(doctor)/home-visits"],
      ["Messages", "/(doctor)/messages"],
      ["My profile", "/(doctor)/profile"],
    ];

    for (const [label, href] of destinations) {
      await fireEvent.press(screen.getByText(label));
      expect(router.push).toHaveBeenCalledWith(href);
    }
  });
});
