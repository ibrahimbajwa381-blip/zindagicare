// E2E journey: Section 13 — patient profile edit -> save -> reflected, and edit -> change ->
// back without saving -> reopen shows the discarded (original) value, per the screen's actual
// cancel behavior (toForm(profile) resets the form) rather than an invented requirement.
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import ProfileScreen from "@app/(tabs)/profile";
import { useAuth } from "@/lib/auth-context";
import { getPatientProfile, updatePatientProfile } from "@/api/patient-profile";
import { makeMockAuth } from "@/test-utils/mock-auth";

jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));
jest.mock("@/api/patient-profile");

const mockUseAuth = useAuth as jest.Mock;
const mockGetPatientProfile = getPatientProfile as jest.Mock;
const mockUpdatePatientProfile = updatePatientProfile as jest.Mock;

const profileDto = {
  user: { name: "Hassan Raza", email: "hassan@example.com", phone: "03001234567", city: "Lahore", memberSince: "2025-01-01T00:00:00.000Z" },
  profile: {
    dateOfBirth: "1995-05-01",
    gender: "male",
    bloodGroup: "O+",
    allergies: ["Penicillin"],
    chronicConditions: [],
    emergencyContact: { name: "Sara Raza", phone: "03007654321", relation: "Sister" },
  },
};

describe("Section 13: patient profile journey", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(makeMockAuth());
    mockGetPatientProfile.mockResolvedValue(profileDto);
  });

  it("edits, saves, and shows the updated field afterward", async () => {
    await render(<ProfileScreen />);
    await waitFor(() => expect(screen.getAllByText("Hassan Raza").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Lahore").length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByText("Edit profile"));
    const cityInput = screen.getByDisplayValue("Lahore");
    await fireEvent.changeText(cityInput, "Islamabad");

    const updated = { ...profileDto, user: { ...profileDto.user, city: "Islamabad" } };
    mockUpdatePatientProfile.mockResolvedValue(updated);
    await fireEvent.press(screen.getByText("Save changes"));

    await waitFor(() => expect(mockUpdatePatientProfile).toHaveBeenCalledTimes(1));
    expect(mockUpdatePatientProfile.mock.calls[0][0]).toMatchObject({ city: "Islamabad" });
    // Back to the read-only view with the new value, no leftover edit form or duplicate submit.
    await waitFor(() => expect(screen.getAllByText("Islamabad").length).toBeGreaterThan(0));
    expect(screen.queryByText("Save changes")).toBeNull();
  });

  it("discards unsaved changes when Cancel is pressed, and reopening Edit starts from the original data again", async () => {
    await render(<ProfileScreen />);
    await waitFor(() => expect(screen.getAllByText("Hassan Raza").length).toBeGreaterThan(0));

    await fireEvent.press(screen.getByText("Edit profile"));
    await fireEvent.changeText(screen.getByDisplayValue("Hassan Raza"), "Someone Else");
    await fireEvent.press(screen.getByText("Cancel"));

    // Cancelled edit must not have called the save API, and the original name is shown again.
    expect(mockUpdatePatientProfile).not.toHaveBeenCalled();
    expect(screen.getAllByText("Hassan Raza").length).toBeGreaterThan(0);
    expect(screen.queryByText("Someone Else")).toBeNull();

    // Reopening Edit starts from the persisted (original) data, not the discarded draft.
    await fireEvent.press(screen.getByText("Edit profile"));
    expect(screen.getByDisplayValue("Hassan Raza")).toBeTruthy();
    expect(screen.queryByDisplayValue("Someone Else")).toBeNull();
  });

  it("shows a save error, keeps the form open with the entered data, and lets the user retry", async () => {
    await render(<ProfileScreen />);
    await waitFor(() => expect(screen.getAllByText("Hassan Raza").length).toBeGreaterThan(0));
    await fireEvent.press(screen.getByText("Edit profile"));
    await fireEvent.changeText(screen.getByDisplayValue("Lahore"), "Karachi");

    mockUpdatePatientProfile.mockRejectedValueOnce(new Error("Network error"));
    await fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() => expect(screen.getByText("Failed to save profile")).toBeTruthy());
    // The typed value survives the failed save — the user does not have to retype it.
    expect(screen.getByDisplayValue("Karachi")).toBeTruthy();

    mockUpdatePatientProfile.mockResolvedValueOnce({ ...profileDto, user: { ...profileDto.user, city: "Karachi" } });
    await fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() => expect(screen.getAllByText("Karachi").length).toBeGreaterThan(0));
  });
});
