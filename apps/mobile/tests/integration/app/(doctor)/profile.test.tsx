import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert, Linking } from "react-native";
import DoctorProfileScreen from "@app/(doctor)/profile";
import { getDoctorProfile } from "@/api/doctor";
import { ApiRequestError } from "@/api/client";
import { useAuth } from "@/lib/auth-context";
import { router } from "expo-router";
import { makeMockAuth } from "@/test-utils/mock-auth";

jest.mock("@/api/doctor");
jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));

const mockGetProfile = getDoctorProfile as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

const profile = {
  id: "doc-1",
  user: { id: "u-1", name: "Bilal Chaudhry", email: "bilal@example.com", phone: "03001234567", memberSince: "2023-01-01" },
  pmdcVerified: true,
  qualifications: ["FCPS"],
  medicalDegree: "MBBS",
  experienceYears: 8,
  additionalSpecialties: [],
  specialties: ["Dermatology"],
  languages: ["English", "Urdu"],
  hospitals: [{ name: "City Hospital", city: "Lahore" }],
  consultationFee: 2000,
  weeklyAvailability: [{ dayOfWeek: 1, startTimeLocal: "09:00", endTimeLocal: "17:00" }],
  sundayConsult: { enabled: true, startTimeLocal: "10:00", endTimeLocal: "14:00", slotDurationMins: 10 },
  homeVisit: { enabled: false },
  verificationStatus: "approved",
  isListed: true,
  bio: "Experienced dermatologist.",
  documents: {},
};

describe("DoctorProfileScreen", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(makeMockAuth());
    mockGetProfile.mockResolvedValue(profile);
  });

  it("renders profile details: contact, practice, bio, hospitals, and availability", async () => {
    await render(<DoctorProfileScreen />);
    await waitFor(() => expect(screen.getByText("Bilal Chaudhry")).toBeTruthy());
    expect(screen.getByText("Dermatology")).toBeTruthy();
    expect(screen.getByText("Approved")).toBeTruthy();
    expect(screen.getByText("bilal@example.com")).toBeTruthy();
    expect(screen.getByText("Rs. 2,000")).toBeTruthy();
    expect(screen.getByText("8+ years")).toBeTruthy();
    expect(screen.getByText("English, Urdu")).toBeTruthy();
    expect(screen.getByText("Experienced dermatologist.")).toBeTruthy();
    expect(screen.getByText("City Hospital")).toBeTruthy();
    expect(screen.getByText("Mon · 09:00–17:00")).toBeTruthy();
    expect(screen.getByText("Enabled · 10:00–14:00")).toBeTruthy();
  });

  it("shows 'Not enabled' when Sunday consult is off", async () => {
    mockGetProfile.mockResolvedValue({ ...profile, sundayConsult: { enabled: false, slotDurationMins: 10 } });
    await render(<DoctorProfileScreen />);
    expect(await screen.findByText("Not enabled")).toBeTruthy();
  });

  it("shows an error message when loading fails", async () => {
    mockGetProfile.mockRejectedValue(new ApiRequestError("Not authorized", "AUTH", 401));
    await render(<DoctorProfileScreen />);
    expect(await screen.findByText("Not authorized")).toBeTruthy();
  });

  it("navigates to edit profile", async () => {
    await render(<DoctorProfileScreen />);
    await waitFor(() => expect(screen.getByText("Edit profile")).toBeTruthy());
    await fireEvent.press(screen.getByText("Edit profile"));
    expect(router.push).toHaveBeenCalledWith("/(doctor)/profile-edit");
  });

  it("calls signOut when Sign out is pressed", async () => {
    const signOut = jest.fn();
    mockUseAuth.mockReturnValue(makeMockAuth({ signOut }));
    await render(<DoctorProfileScreen />);
    await waitFor(() => expect(screen.getByText("Sign out")).toBeTruthy());
    await fireEvent.press(screen.getByText("Sign out"));
    expect(signOut).toHaveBeenCalled();
  });

  it("opens the privacy and terms links", async () => {
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(true as never);
    await render(<DoctorProfileScreen />);
    await waitFor(() => expect(screen.getByText("Privacy Policy")).toBeTruthy());
    await fireEvent.press(screen.getByText("Privacy Policy"));
    await fireEvent.press(screen.getByText("Terms of Service"));
    expect(openURLSpy).toHaveBeenCalledWith("https://zindagicare.com/privacy");
    expect(openURLSpy).toHaveBeenCalledWith("https://zindagicare.com/terms");
  });

  it("deletes the account after the double confirmation flow", async () => {
    const deleteAccount = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ deleteAccount }));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorProfileScreen />);
    await waitFor(() => expect(screen.getByText("Delete account")).toBeTruthy());

    await fireEvent.press(screen.getByText("Delete account"));
    const firstButtons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => firstButtons.find((b) => b.text === "Delete account")?.onPress?.());

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(2));
    const secondButtons = alertSpy.mock.calls[1][2] as { text: string; onPress?: () => void }[];
    await act(async () => secondButtons.find((b) => b.text === "Yes, delete my account")?.onPress?.());

    await waitFor(() => expect(deleteAccount).toHaveBeenCalled());
  });
});
