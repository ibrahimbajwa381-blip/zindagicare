import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import DoctorProfileEditScreen from "@app/(doctor)/profile-edit";
import { getDoctorProfile, updateDoctorProfile } from "@/api/doctor";
import { ApiRequestError } from "@/api/client";
import { router } from "expo-router";

jest.mock("@/api/doctor");

const mockGetProfile = getDoctorProfile as jest.Mock;
const mockUpdateProfile = updateDoctorProfile as jest.Mock;

const profile = {
  id: "doc-1",
  user: { id: "u-1", name: "Bilal Chaudhry", memberSince: "2023-01-01" },
  pmdcVerified: true,
  qualifications: [],
  experienceYears: 8,
  additionalSpecialties: [],
  specialties: ["Dermatology"],
  languages: ["English"],
  hospitals: [],
  consultationFee: 2000,
  weeklyAvailability: [],
  bio: "Experienced dermatologist.",
  sundayConsult: { enabled: false, slotDurationMins: 10 },
  homeVisit: { enabled: false },
  verificationStatus: "approved",
  isListed: true,
  documents: {},
};

describe("DoctorProfileEditScreen", () => {
  beforeEach(() => {
    mockGetProfile.mockResolvedValue(profile);
  });

  it("pre-fills the form from the current profile", async () => {
    await render(<DoctorProfileEditScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Experienced dermatologist.")).toBeTruthy());
    expect(screen.getByDisplayValue("2000")).toBeTruthy();
    expect(screen.getByDisplayValue("English")).toBeTruthy();
  });

  it("shows an error message when loading fails", async () => {
    mockGetProfile.mockRejectedValue(new ApiRequestError("Not authorized", "AUTH", 401));
    await render(<DoctorProfileEditScreen />);
    expect(await screen.findByText("Not authorized")).toBeTruthy();
  });

  it("strips non-numeric characters from the fee field", async () => {
    await render(<DoctorProfileEditScreen />);
    const feeInput = await screen.findByDisplayValue("2000");
    await fireEvent.changeText(feeInput, "25a00b");
    expect(feeInput.props.value).toBe("2500");
  });

  it("rejects a fee below Rs. 500", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorProfileEditScreen />);
    const feeInput = await screen.findByDisplayValue("2000");
    await fireEvent.changeText(feeInput, "100");
    await fireEvent.press(screen.getByText("Save changes"));

    expect(alertSpy).toHaveBeenCalledWith("Invalid fee", "Consultation fee must be at least Rs. 500.");
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("rejects a fee of exactly 499 (one below the minimum of 500)", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorProfileEditScreen />);
    const feeInput = await screen.findByDisplayValue("2000");
    await fireEvent.changeText(feeInput, "499");
    await fireEvent.press(screen.getByText("Save changes"));

    expect(alertSpy).toHaveBeenCalledWith("Invalid fee", "Consultation fee must be at least Rs. 500.");
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("accepts a fee of exactly 500 (the minimum)", async () => {
    mockUpdateProfile.mockResolvedValue(undefined);
    await render(<DoctorProfileEditScreen />);
    const feeInput = await screen.findByDisplayValue("2000");
    await fireEvent.changeText(feeInput, "500");
    await fireEvent.press(screen.getByText("Save changes"));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({ consultationFee: 500 }));
    });
  });

  it("rejects an empty fee field", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorProfileEditScreen />);
    const feeInput = await screen.findByDisplayValue("2000");
    await fireEvent.changeText(feeInput, "");
    await fireEvent.press(screen.getByText("Save changes"));

    expect(alertSpy).toHaveBeenCalledWith("Invalid fee", "Consultation fee must be at least Rs. 500.");
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("reveals Sunday start/end fields only when the switch is enabled", async () => {
    await render(<DoctorProfileEditScreen />);
    await waitFor(() => expect(screen.getByText("Sunday free consult")).toBeTruthy());
    expect(screen.queryByPlaceholderText("10:00")).toBeNull();

    await fireEvent(screen.getByRole("switch"), "valueChange", true);
    expect(screen.getByPlaceholderText("10:00")).toBeTruthy();
    expect(screen.getByPlaceholderText("13:00")).toBeTruthy();
  });

  it("lets the Sunday start/end fields be found by their accessible name once revealed", async () => {
    await render(<DoctorProfileEditScreen />);
    await waitFor(() => expect(screen.getByText("Sunday free consult")).toBeTruthy());
    expect(screen.queryByLabelText("Start (HH:mm)")).toBeNull();

    await fireEvent(screen.getByRole("switch"), "valueChange", true);
    await fireEvent.changeText(screen.getByLabelText("Start (HH:mm)"), "09:00");
    await fireEvent.changeText(screen.getByLabelText("End (HH:mm)"), "12:00");
    await fireEvent.press(screen.getByText("Save changes"));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          sundayConsult: { enabled: true, startTimeLocal: "09:00", endTimeLocal: "12:00" },
        }),
      );
    });
  });

  it("saves the updated profile and navigates back", async () => {
    mockUpdateProfile.mockResolvedValue(profile);
    await render(<DoctorProfileEditScreen />);
    const bioInput = screen.getByLabelText("Bio");
    await waitFor(() => expect(bioInput).toHaveDisplayValue("Experienced dermatologist."));
    await fireEvent.changeText(bioInput, "Updated bio");
    await fireEvent.changeText(screen.getByDisplayValue("English"), "English, Urdu");
    await fireEvent.press(screen.getByText("Save changes"));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        bio: "Updated bio",
        consultationFee: 2000,
        languages: ["English", "Urdu"],
        sundayConsult: { enabled: false, startTimeLocal: undefined, endTimeLocal: undefined },
      });
      expect(router.back).toHaveBeenCalled();
    });
  });

  it("includes Sunday start/end times when enabled", async () => {
    mockUpdateProfile.mockResolvedValue(profile);
    await render(<DoctorProfileEditScreen />);
    await waitFor(() => expect(screen.getByText("Sunday free consult")).toBeTruthy());
    await fireEvent(screen.getByRole("switch"), "valueChange", true);
    await fireEvent.press(screen.getByText("Save changes"));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          sundayConsult: { enabled: true, startTimeLocal: "10:00", endTimeLocal: "13:00" },
        }),
      );
    });
  });

  it("shows an alert and error message when saving fails", async () => {
    mockUpdateProfile.mockRejectedValue(new ApiRequestError("Server error", "ERR", 500));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorProfileEditScreen />);
    await screen.findByDisplayValue("2000");
    await fireEvent.press(screen.getByText("Save changes"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Couldn't save changes", "Server error");
    });
    expect(await screen.findByText("Server error")).toBeTruthy();
  });
});
