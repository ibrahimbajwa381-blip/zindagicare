import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import DoctorVerificationScreen from "@app/(doctor)/verification";
import { getDoctorProfile, uploadDoctorDocument, submitDoctorVerification } from "@/api/doctor";
import { ApiRequestError } from "@/api/client";

jest.mock("@/api/doctor");

const mockGetProfile = getDoctorProfile as jest.Mock;
const mockUploadDoc = uploadDoctorDocument as jest.Mock;
const mockSubmitVerification = submitDoctorVerification as jest.Mock;

const completeProfile = {
  id: "doc-1",
  user: { id: "u-1", name: "Bilal Chaudhry", memberSince: "2023-01-01", avatarUrl: "/avatar.jpg" },
  pmdcNumber: "12345-P",
  pmdcVerified: false,
  qualifications: ["FCPS"],
  medicalDegree: "MBBS",
  medicalCollege: "King Edward Medical University",
  graduationYear: 2015,
  experienceYears: 9,
  additionalSpecialties: [],
  specialties: ["Dermatology"],
  languages: ["English"],
  hospitals: [{ name: "City Hospital", city: "Lahore" }],
  consultationFee: 2000,
  weeklyAvailability: [{ dayOfWeek: 1, startTimeLocal: "09:00", endTimeLocal: "17:00" }],
  sundayConsult: { enabled: false, slotDurationMins: 10 },
  homeVisit: { enabled: false },
  verificationStatus: "rejected",
  rejectionReason: "Documents were blurry",
  isListed: false,
  documents: {},
};

async function pickImage() {
  jest.spyOn(ImagePicker, "requestMediaLibraryPermissionsAsync").mockResolvedValue({ granted: true } as never);
  jest.spyOn(ImagePicker, "launchImageLibraryAsync").mockResolvedValue({
    canceled: false,
    assets: [{ uri: "file://doc.jpg", fileName: "doc.jpg", mimeType: "image/jpeg" }],
  } as never);
}

describe("DoctorVerificationScreen", () => {
  beforeEach(() => {
    mockGetProfile.mockResolvedValue(completeProfile);
  });

  it("shows the rejection reason and status", async () => {
    await render(<DoctorVerificationScreen />);
    await waitFor(() => expect(screen.getByText("Rejected")).toBeTruthy());
    expect(screen.getByText("“Documents were blurry”")).toBeTruthy();
  });

  it("shows an error message when loading fails", async () => {
    mockGetProfile.mockRejectedValue(new ApiRequestError("Not authorized", "AUTH", 401));
    await render(<DoctorVerificationScreen />);
    expect(await screen.findByText("Not authorized")).toBeTruthy();
  });

  it("hides the form entirely once approved", async () => {
    mockGetProfile.mockResolvedValue({ ...completeProfile, verificationStatus: "approved" });
    await render(<DoctorVerificationScreen />);
    await waitFor(() => expect(screen.getByText("Approved")).toBeTruthy());
    expect(screen.queryByText("Submit for verification")).toBeNull();
  });

  it("lets the CNIC field be found by its accessible label", async () => {
    await render(<DoctorVerificationScreen />);
    await waitFor(() => expect(screen.getByText("Submit for verification")).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText("CNIC"), "12345-1234567-1");
    expect(screen.getByDisplayValue("12345-1234567-1")).toBeTruthy();
  });

  it("requires a validly formatted CNIC", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorVerificationScreen />);
    await waitFor(() => expect(screen.getByText("Submit for verification")).toBeTruthy());
    await fireEvent.changeText(screen.getByPlaceholderText("XXXXX-XXXXXXX-X"), "invalid");
    await fireEvent.press(screen.getByText("Submit for verification"));

    expect(alertSpy).toHaveBeenCalledWith("Invalid CNIC", "Enter your CNIC as XXXXX-XXXXXXX-X.");
    expect(mockSubmitVerification).not.toHaveBeenCalled();
  });

  it.each([
    ["", "empty"],
    ["12345123456701", "no dashes"],
    [" 12345-1234567-1", "leading space"],
    ["12345-1234567-1 ", "trailing space"],
    ["12345-1234567-12", "extra trailing digit"],
    ["1234-1234567-1", "first group too short"],
    ["123456-1234567-1", "first group too long"],
    ["12345-123456-1", "second group too short"],
    ["12345-1234567-", "missing last digit"],
    ["ABCDE-1234567-1", "letters instead of digits"],
    ["12345.1234567.1", "wrong separator"],
    ["12345-1234567-1\n", "trailing newline"],
    ["١٢٣٤٥-١٢٣٤٥٦٧-١", "Unicode Arabic-indic digits"],
  ])("rejects a malformed CNIC (%s: %s) and does not submit", async (cnic) => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorVerificationScreen />);
    await waitFor(() => expect(screen.getByText("Submit for verification")).toBeTruthy());
    await fireEvent.changeText(screen.getByPlaceholderText("XXXXX-XXXXXXX-X"), cnic);
    await fireEvent.press(screen.getByText("Submit for verification"));

    expect(alertSpy).toHaveBeenCalledWith("Invalid CNIC", "Enter your CNIC as XXXXX-XXXXXXX-X.");
    expect(mockSubmitVerification).not.toHaveBeenCalled();
  });

  it("requires medical degree/college/graduation year on the profile", async () => {
    mockGetProfile.mockResolvedValue({ ...completeProfile, medicalDegree: undefined });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorVerificationScreen />);
    await waitFor(() => expect(screen.getByText("Submit for verification")).toBeTruthy());
    await fireEvent.changeText(screen.getByPlaceholderText("XXXXX-XXXXXXX-X"), "12345-1234567-1");
    await fireEvent.press(screen.getByText("Submit for verification"));

    expect(alertSpy).toHaveBeenCalledWith(
      "Missing details",
      "Add your medical degree, college, and graduation year on the website before resubmitting.",
    );
  });

  it("requires a profile photo", async () => {
    mockGetProfile.mockResolvedValue({ ...completeProfile, user: { ...completeProfile.user, avatarUrl: undefined } });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorVerificationScreen />);
    await waitFor(() => expect(screen.getByText("Submit for verification")).toBeTruthy());
    await fireEvent.changeText(screen.getByPlaceholderText("XXXXX-XXXXXXX-X"), "12345-1234567-1");
    await fireEvent.press(screen.getByText("Submit for verification"));

    expect(alertSpy).toHaveBeenCalledWith(
      "Profile photo required",
      "Add a profile photo on the website before resubmitting.",
    );
  });

  it("requires a practice location and weekly availability", async () => {
    mockGetProfile.mockResolvedValue({ ...completeProfile, hospitals: [] });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorVerificationScreen />);
    await waitFor(() => expect(screen.getByText("Submit for verification")).toBeTruthy());
    await fireEvent.changeText(screen.getByPlaceholderText("XXXXX-XXXXXXX-X"), "12345-1234567-1");
    await fireEvent.press(screen.getByText("Submit for verification"));

    expect(alertSpy).toHaveBeenCalledWith(
      "Missing details",
      "Add at least one practice location and weekly availability window on the website before resubmitting.",
    );
  });

  it("uploads a document and marks it uploaded", async () => {
    await pickImage();
    mockUploadDoc.mockResolvedValue({ storageKey: "k1", url: "/pmdc.jpg" });
    await render(<DoctorVerificationScreen />);
    await waitFor(() => expect(screen.getByText("PMDC certificate")).toBeTruthy());

    const uploadButtons = screen.getAllByText("Upload");
    await fireEvent.press(uploadButtons[0]);

    await waitFor(() => {
      expect(mockUploadDoc).toHaveBeenCalledWith({ uri: "file://doc.jpg", name: "doc.jpg", type: "image/jpeg" });
    });
    expect(await screen.findByText("Replace")).toBeTruthy();
  });

  it("alerts when photo library permission is denied", async () => {
    jest.spyOn(ImagePicker, "requestMediaLibraryPermissionsAsync").mockResolvedValue({ granted: false } as never);
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorVerificationScreen />);
    await waitFor(() => expect(screen.getByText("PMDC certificate")).toBeTruthy());
    await fireEvent.press(screen.getAllByText("Upload")[0]);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Permission needed", "Allow photo library access to attach documents.");
    });
  });

  it("requires all four documents before submitting", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorVerificationScreen />);
    await waitFor(() => expect(screen.getByText("Submit for verification")).toBeTruthy());
    await fireEvent.changeText(screen.getByPlaceholderText("XXXXX-XXXXXXX-X"), "12345-1234567-1");
    await fireEvent.press(screen.getByText("Submit for verification"));

    expect(alertSpy).toHaveBeenCalledWith("Missing documents", "Upload all four documents before submitting.");
    expect(mockSubmitVerification).not.toHaveBeenCalled();
  });

  it("submits successfully once all requirements are met", async () => {
    mockGetProfile.mockResolvedValue({
      ...completeProfile,
      documents: {
        pmdcCertificate: "/pmdc.jpg",
        cnicFront: "/cnicf.jpg",
        cnicBack: "/cnicb.jpg",
        degreeCertificate: "/deg.jpg",
      },
    });
    mockSubmitVerification.mockResolvedValue({ id: "doc-1", verificationStatus: "pending" });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorVerificationScreen />);
    await waitFor(() => expect(screen.getByText("Submit for verification")).toBeTruthy());
    await fireEvent.changeText(screen.getByPlaceholderText("XXXXX-XXXXXXX-X"), "12345-1234567-1");
    await fireEvent.press(screen.getByText("Submit for verification"));

    await waitFor(() => {
      expect(mockSubmitVerification).toHaveBeenCalledWith(
        expect.objectContaining({ pmdcNumber: "12345-P", cnic: "12345-1234567-1" }),
      );
      expect(alertSpy).toHaveBeenCalledWith("Submitted", "Your verification has been resubmitted for review.");
    });
  });

  it("shows an error message when submission fails", async () => {
    mockGetProfile.mockResolvedValue({
      ...completeProfile,
      documents: {
        pmdcCertificate: "/pmdc.jpg",
        cnicFront: "/cnicf.jpg",
        cnicBack: "/cnicb.jpg",
        degreeCertificate: "/deg.jpg",
      },
    });
    mockSubmitVerification.mockRejectedValue(new ApiRequestError("Server error", "ERR", 500));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorVerificationScreen />);
    await waitFor(() => expect(screen.getByText("Submit for verification")).toBeTruthy());
    await fireEvent.changeText(screen.getByPlaceholderText("XXXXX-XXXXXXX-X"), "12345-1234567-1");
    await fireEvent.press(screen.getByText("Submit for verification"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Couldn't submit", "Server error");
    });
    expect(await screen.findByText("Server error")).toBeTruthy();
  });
});
