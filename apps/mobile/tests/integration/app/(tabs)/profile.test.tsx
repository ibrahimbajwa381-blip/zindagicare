import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert, Linking } from "react-native";
import ProfileScreen from "@app/(tabs)/profile";
import { useAuth } from "@/lib/auth-context";
import { getPatientProfile, updatePatientProfile } from "@/api/patient-profile";
import { ApiRequestError } from "@/api/client";
import { mobileEn } from "@zindagi/i18n";
import { makeMockAuth } from "@/test-utils/mock-auth";

jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));
jest.mock("@/api/patient-profile");

const mockSetLocale = jest.fn();
jest.mock("@/lib/locale-context", () => ({
  useLocale: () => ({ locale: "en", t: jest.requireActual("@zindagi/i18n").mobileEn, setLocale: mockSetLocale, isLoading: false }),
  useTranslations: () => jest.requireActual("@zindagi/i18n").mobileEn,
  LocaleProvider: ({ children }: any) => children,
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetProfile = getPatientProfile as jest.Mock;
const mockUpdateProfile = updatePatientProfile as jest.Mock;

const profileDto = {
  user: {
    id: "u-1",
    name: "Ayesha Khan",
    email: "ayesha@example.com",
    phone: "03001234567",
    emailVerified: true,
    phoneVerified: true,
    locale: "en" as const,
    city: "Lahore",
    memberSince: "2024-01-15T00:00:00.000Z",
  },
  profile: {
    dateOfBirth: "1996-05-01",
    gender: "female" as const,
    bloodGroup: "O+" as const,
    allergies: ["Penicillin"],
    chronicConditions: [],
    emergencyContact: { name: "Bilal Khan", phone: "03111234567", relation: "Brother" },
  },
};

describe("ProfileScreen", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(makeMockAuth());
    mockGetProfile.mockResolvedValue(profileDto);
  });

  it("renders the profile hero and account fields once loaded", async () => {
    await render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText("ayesha@example.com")).toBeTruthy());
    expect(screen.getAllByText("Lahore").length).toBeGreaterThan(0);
    expect(screen.getByText("ayesha@example.com")).toBeTruthy();
    expect(screen.getByText("03001234567")).toBeTruthy();
    expect(screen.getByText("Penicillin")).toBeTruthy();
  });

  it("shows 'Not set' for empty optional fields", async () => {
    mockGetProfile.mockResolvedValue({
      ...profileDto,
      profile: { ...profileDto.profile, gender: undefined, bloodGroup: undefined, allergies: [], chronicConditions: [] },
    });
    await render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText("ayesha@example.com")).toBeTruthy());
    expect(screen.getAllByText("Not set").length).toBeGreaterThan(0);
  });

  it("shows an error message when the profile fails to load", async () => {
    mockGetProfile.mockRejectedValue(new ApiRequestError("Profile not found", "NOT_FOUND", 404));
    await render(<ProfileScreen />);
    expect(await screen.findByText("Profile not found")).toBeTruthy();
  });

  it("enters edit mode and saves updated fields", async () => {
    mockUpdateProfile.mockResolvedValue({
      ...profileDto,
      user: { ...profileDto.user, name: "Ayesha Raza" },
    });
    await render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText("ayesha@example.com")).toBeTruthy());

    await fireEvent.press(screen.getByText("Edit profile"));
    const nameInput = screen.getByDisplayValue("Ayesha Khan");
    await fireEvent.changeText(nameInput, "Ayesha Raza");
    await fireEvent.press(screen.getByText("Save changes"));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Ayesha Raza", allergies: ["Penicillin"], chronicConditions: [] }),
      );
    });
    await waitFor(() => expect(screen.getAllByText("Ayesha Raza").length).toBeGreaterThan(0));
  });

  it("lets the Name field be found and edited by its accessible label, not just its current value", async () => {
    mockUpdateProfile.mockResolvedValue({
      ...profileDto,
      user: { ...profileDto.user, name: "Ayesha Raza" },
    });
    await render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText("ayesha@example.com")).toBeTruthy());

    await fireEvent.press(screen.getByText("Edit profile"));
    await fireEvent.changeText(screen.getByLabelText("Name"), "Ayesha Raza");
    await fireEvent.press(screen.getByText("Save changes"));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({ name: "Ayesha Raza" }));
    });
  });

  it("gives the emergency contact's name/phone fields distinct accessible names from the patient's own name/phone", async () => {
    await render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText("ayesha@example.com")).toBeTruthy());
    await fireEvent.press(screen.getByText("Edit profile"));

    expect(screen.getByLabelText("Name")).toBeTruthy();
    expect(screen.getByLabelText("Emergency contact Name")).toBeTruthy();
    expect(screen.getByLabelText("Phone")).toBeTruthy();
    expect(screen.getByLabelText("Emergency contact Phone")).toBeTruthy();
  });

  it("parses comma-separated allergies and chronic conditions on save", async () => {
    mockUpdateProfile.mockResolvedValue(profileDto);
    await render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText("ayesha@example.com")).toBeTruthy());

    await fireEvent.press(screen.getByText("Edit profile"));
    const allergiesInput = screen.getByDisplayValue("Penicillin");
    await fireEvent.changeText(allergiesInput, "Peanuts,  Dust , ");
    await fireEvent.press(screen.getByText("Save changes"));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ allergies: ["Peanuts", "Dust"] }),
      );
    });
  });

  it("discards edits when Cancel is pressed", async () => {
    await render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText("ayesha@example.com")).toBeTruthy());

    await fireEvent.press(screen.getByText("Edit profile"));
    const nameInput = screen.getByDisplayValue("Ayesha Khan");
    await fireEvent.changeText(nameInput, "Someone Else");
    await fireEvent.press(screen.getByText("Cancel"));

    expect(screen.queryByText("Save changes")).toBeNull();
    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(screen.getAllByText("Ayesha Khan").length).toBeGreaterThan(0);
  });

  it("shows an error banner and alert when saving fails", async () => {
    mockUpdateProfile.mockRejectedValue(new ApiRequestError("City is invalid", "BAD_CITY", 400));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText("ayesha@example.com")).toBeTruthy());

    await fireEvent.press(screen.getByText("Edit profile"));
    await fireEvent.press(screen.getByText("Save changes"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Couldn't save changes", "City is invalid");
    });
    expect(await screen.findByText("City is invalid")).toBeTruthy();
  });

  it("switches the language via setLocale", async () => {
    await render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText("ayesha@example.com")).toBeTruthy());
    await fireEvent.press(screen.getByText(mobileEn.common.urdu));
    expect(mockSetLocale).toHaveBeenCalledWith("ur");
  });

  it("calls signOut when Sign out is pressed", async () => {
    const signOut = jest.fn();
    mockUseAuth.mockReturnValue(makeMockAuth({ signOut }));
    await render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText("ayesha@example.com")).toBeTruthy());
    await fireEvent.press(screen.getByText("Sign out"));
    expect(signOut).toHaveBeenCalled();
  });

  it("opens the privacy policy and terms of service links", async () => {
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(true as never);
    await render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText("ayesha@example.com")).toBeTruthy());
    await fireEvent.press(screen.getByText("Privacy Policy"));
    await fireEvent.press(screen.getByText("Terms of Service"));
    expect(openURLSpy).toHaveBeenCalledWith("https://zindagicare.com/privacy");
    expect(openURLSpy).toHaveBeenCalledWith("https://zindagicare.com/terms");
  });

  it("deletes the account after the double confirmation flow", async () => {
    const deleteAccount = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ deleteAccount }));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText("ayesha@example.com")).toBeTruthy());

    await fireEvent.press(screen.getByText("Delete account"));
    expect(alertSpy).toHaveBeenCalledWith(
      "Delete your account?",
      expect.any(String),
      expect.any(Array),
    );

    const firstButtons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    const confirmFirst = firstButtons.find((b) => b.text === "Delete account");
    await act(async () => confirmFirst?.onPress?.());

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(2));
    const secondButtons = alertSpy.mock.calls[1][2] as { text: string; onPress?: () => void }[];
    const confirmSecond = secondButtons.find((b) => b.text === "Yes, delete my account");
    await act(async () => confirmSecond?.onPress?.());

    await waitFor(() => expect(deleteAccount).toHaveBeenCalled());
  });

  it("shows an alert if account deletion fails", async () => {
    const deleteAccount = jest.fn().mockRejectedValue(new ApiRequestError("Server error", "ERR", 500));
    mockUseAuth.mockReturnValue(makeMockAuth({ deleteAccount }));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText("ayesha@example.com")).toBeTruthy());

    await fireEvent.press(screen.getByText("Delete account"));
    const firstButtons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => firstButtons.find((b) => b.text === "Delete account")?.onPress?.());
    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(2));
    const secondButtons = alertSpy.mock.calls[1][2] as { text: string; onPress?: () => void }[];
    await act(async () => secondButtons.find((b) => b.text === "Yes, delete my account")?.onPress?.());

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Couldn't delete account", "Server error");
    });
  });
});
