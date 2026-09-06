// E2E journeys: Sections 15 (role separation) and 16 (logout).
// Frontend role checks are UI protection only — backend authorization is out of scope here.
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import TabsLayout from "@app/(tabs)/_layout";
import DoctorLayout from "@app/(doctor)/_layout";
import ProfileScreen from "@app/(tabs)/profile";
import DoctorProfileScreen from "@app/(doctor)/profile";
import { useAuth } from "@/lib/auth-context";
import { useUnreadSummary } from "@/hooks/use-unread-summary";
import { router } from "expo-router";
import { makeAuthUser, makeMockAuth } from "@/test-utils/mock-auth";
import { getPatientProfile } from "@/api/patient-profile";
import { getDoctorProfile } from "@/api/doctor";

jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));
jest.mock("@/hooks/use-unread-summary", () => ({ useUnreadSummary: jest.fn(() => null) }));
jest.mock("@/api/patient-profile");
jest.mock("@/api/doctor");

const mockUseAuth = useAuth as jest.Mock;
const mockGetPatientProfile = getPatientProfile as jest.Mock;
const mockGetDoctorProfile = getDoctorProfile as jest.Mock;

describe("Section 15: role separation", () => {
  it("a patient session renders the patient tab navigator and is never redirected to the doctor area", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ isLoading: false, user: makeAuthUser({ roles: ["patient"] }) }));
    await render(<TabsLayout />);
    expect(router.replace).not.toHaveBeenCalledWith("/(doctor)");
  });

  it("a doctor session is redirected out of the patient tabs into the doctor area (no patient UI shown first)", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ isLoading: false, user: makeAuthUser({ roles: ["doctor"] }) }));
    const result = await render(<TabsLayout />);
    expect(router.replace).toHaveBeenCalledWith("/(doctor)");
    expect(result.toJSON()).toBeNull(); // no patient tab bar/screens ever mounted
  });

  it("a patient session is redirected out of the doctor area back to the patient tabs", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ isLoading: false, user: makeAuthUser({ roles: ["patient"] }) }));
    const result = await render(<DoctorLayout />);
    expect(router.replace).toHaveBeenCalledWith("/(tabs)");
    expect(result.toJSON()).toBeNull(); // no doctor tab bar/screens ever mounted
  });

  it("a doctor session renders the doctor tab navigator and is never redirected to the patient tabs", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ isLoading: false, user: makeAuthUser({ roles: ["doctor"] }) }));
    await render(<DoctorLayout />);
    expect(router.replace).not.toHaveBeenCalledWith("/(tabs)");
  });
});

describe("Section 16: logout journey", () => {
  it("signing out from the patient profile calls the app's signOut, and a stale render with no user redirects the tab navigator to login", async () => {
    const signOut = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ signOut }));
    mockGetPatientProfile.mockResolvedValue({
      user: { name: "Hassan Raza", email: "h@example.com", phone: "0300", city: "Lahore", memberSince: "2025-01-01T00:00:00.000Z" },
      profile: { allergies: [], chronicConditions: [] },
    });
    await render(<ProfileScreen />);
    await waitFor(() => expect(screen.getAllByText("Hassan Raza").length).toBeGreaterThan(0));

    await fireEvent.press(screen.getByText("Sign out"));
    expect(signOut).toHaveBeenCalledTimes(1);

    // The AuthProvider's user becomes null after signOut resolves — the tab navigator (mounted
    // on top of the same auth state) must react by sending the user to login, not by leaving
    // any protected screen reachable.
    mockUseAuth.mockReturnValue(makeMockAuth({ isLoading: false, user: null }));
    await render(<TabsLayout />);
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
  });

  it("signing out from the doctor profile calls the app's signOut the same way", async () => {
    const signOut = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ signOut }));
    mockGetDoctorProfile.mockResolvedValue({
      user: { name: "Dr. Kamran Aziz", email: "k@example.com", phone: "0300", avatarUrl: undefined },
      specialties: [],
      verificationStatus: "approved",
      consultationFee: 1500,
      experienceYears: 5,
      languages: [],
      qualifications: [],
      medicalDegree: undefined,
      medicalCollege: undefined,
      bio: "",
      hospitals: [],
      weeklyAvailability: [],
      sundayConsult: { enabled: false, startTimeLocal: "", endTimeLocal: "" },
    });
    await render(<DoctorProfileScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Kamran Aziz")).toBeTruthy());

    await fireEvent.press(screen.getByText("Sign out"));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("logging out and back in as a different role sends the new session to that role's own area, not the previous role's", async () => {
    // Previous session: doctor, on the doctor tabs.
    mockUseAuth.mockReturnValue(makeMockAuth({ isLoading: false, user: makeAuthUser({ roles: ["doctor"] }) }));
    await render(<DoctorLayout />);
    expect(router.replace).not.toHaveBeenCalledWith("/(auth)/login");

    // After logout, a fresh (unauthenticated) render redirects to login — the previous doctor
    // session is not left reachable.
    mockUseAuth.mockReturnValue(makeMockAuth({ isLoading: false, user: null }));
    await render(<DoctorLayout />);
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");

    // A different user, this time a patient, logs in — they land on the patient tabs, and
    // nothing about the previous doctor session leaks into this render (each screen fetches
    // its own data fresh; there is no shared component state carried across the two sessions).
    mockUseAuth.mockReturnValue(makeMockAuth({ isLoading: false, user: makeAuthUser({ id: "u-patient", roles: ["patient"] }) }));
    await render(<TabsLayout />);
    expect(router.replace).not.toHaveBeenCalledWith("/(doctor)");
  });
});
