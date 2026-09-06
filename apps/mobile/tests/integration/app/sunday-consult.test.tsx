import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import SundayConsultScreen from "@app/sunday-consult";
import { getMySundayRequest, submitSundayRequest } from "@/api/sunday";
import { getPaymentStatus, uploadPaymentReceipt } from "@/api/consult";
import { getPatientProfile } from "@/api/patient-profile";
import { ApiRequestError } from "@/api/client";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { makeAuthUser, makeMockAuth } from "@/test-utils/mock-auth";

jest.mock("@/api/sunday");
jest.mock("@/api/consult");
jest.mock("@/api/patient-profile");
jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));

const mockGetMyRequest = getMySundayRequest as jest.Mock;
const mockSubmitRequest = submitSundayRequest as jest.Mock;
const mockGetProfile = getPatientProfile as jest.Mock;
const mockGetPaymentStatus = getPaymentStatus as jest.Mock;
const mockUploadReceipt = uploadPaymentReceipt as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

const profile = {
  user: { id: "u1", name: "Ayesha", phone: "03001234567", emailVerified: true, phoneVerified: true, locale: "en" as const, city: "Lahore", memberSince: "2024-01-01" },
  profile: { allergies: [], chronicConditions: [] },
};

describe("SundayConsultScreen", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: makeAuthUser() }));
    mockGetMyRequest.mockResolvedValue(null);
    mockGetProfile.mockResolvedValue(profile);
  });

  it("redirects to login instead of rendering the Sunday consult screen when there is no authenticated user", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: null, isLoading: false }));
    await render(<SundayConsultScreen />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/(auth)/login"));
  });

  it("does not redirect while auth is still resolving", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: null, isLoading: true }));
    await render(<SundayConsultScreen />);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("pre-fills the phone number from the patient's profile", async () => {
    await render(<SundayConsultScreen />);
    await waitFor(() => expect(screen.getByText("Request Sunday consult")).toBeTruthy());
    expect(screen.getByDisplayValue("03001234567")).toBeTruthy();
  });

  it("lets the phone number field be found by its accessible label", async () => {
    await render(<SundayConsultScreen />);
    await waitFor(() => expect(screen.getByText("Request Sunday consult")).toBeTruthy());
    expect(screen.getByLabelText("Phone number")).toHaveDisplayValue("03001234567");
  });

  it("requires a phone number before submitting", async () => {
    mockGetProfile.mockResolvedValue({ ...profile, user: { ...profile.user, phone: undefined } });
    await render(<SundayConsultScreen />);
    await waitFor(() => expect(screen.getByText("Request Sunday consult")).toBeTruthy());
    await fireEvent.press(screen.getByText("Request Sunday consult"));
    expect(await screen.findByText("Enter a phone number so we can reach you.")).toBeTruthy();
    expect(mockSubmitRequest).not.toHaveBeenCalled();
  });

  it("rejects a whitespace-only phone number", async () => {
    mockGetProfile.mockResolvedValue({ ...profile, user: { ...profile.user, phone: undefined } });
    await render(<SundayConsultScreen />);
    await waitFor(() => expect(screen.getByText("Request Sunday consult")).toBeTruthy());
    await fireEvent.changeText(screen.getByPlaceholderText("03xx-xxxxxxx"), "   ");
    await fireEvent.press(screen.getByText("No, keep it free"));
    await fireEvent.press(screen.getByText("Request Sunday consult"));
    expect(await screen.findByText("Enter a phone number so we can reach you.")).toBeTruthy();
    expect(mockSubmitRequest).not.toHaveBeenCalled();
  });

  it("requires an affordability choice before submitting", async () => {
    await render(<SundayConsultScreen />);
    await waitFor(() => expect(screen.getByText("Request Sunday consult")).toBeTruthy());
    await fireEvent.press(screen.getByText("Request Sunday consult"));
    expect(await screen.findByText("Choose whether you can contribute a small fee.")).toBeTruthy();
  });

  it("submits a free request directly when no payment is required", async () => {
    mockSubmitRequest.mockResolvedValue({
      kind: "request",
      requestId: "req-1",
      status: "requested",
      sundayDateKey: "2026-02-01",
      patientPhone: "03001234567",
      affordabilityChoice: "cannot_afford",
      createdAt: "2026-01-30T00:00:00.000Z",
    });
    await render(<SundayConsultScreen />);
    await waitFor(() => expect(screen.getByText("Request Sunday consult")).toBeTruthy());

    await fireEvent.press(screen.getByText("No, keep it free"));
    await fireEvent.press(screen.getByText("Request Sunday consult"));

    await waitFor(() => {
      expect(mockSubmitRequest).toHaveBeenCalledWith({
        patientPhone: "03001234567",
        patientNotes: undefined,
        affordabilityChoice: "cannot_afford",
      });
    });
    expect(await screen.findByText("Finding you a doctor…")).toBeTruthy();
  });

  it("shows a checkout card when the request requires payment", async () => {
    mockSubmitRequest.mockResolvedValue({
      kind: "payment",
      paymentId: "pay-1",
      amount: 500,
      manualTransfer: {
        provider: "JazzCash",
        account: { accountTitle: "ZindagiCare", number: "0300", numberDisplay: "0300-0000000" },
      },
    });
    await render(<SundayConsultScreen />);
    await waitFor(() => expect(screen.getByText("Request Sunday consult")).toBeTruthy());

    await fireEvent.press(screen.getByText("Yes, contribute Rs. 500"));
    await fireEvent.press(screen.getByText("Request Sunday consult"));

    expect(await screen.findByText("Rs. 500")).toBeTruthy();
    expect(screen.getByText("Pay via JazzCash")).toBeTruthy();
  });

  it("uploads a receipt and reloads the request", async () => {
    mockSubmitRequest.mockResolvedValue({
      kind: "payment",
      paymentId: "pay-1",
      amount: 500,
      manualTransfer: { provider: "JazzCash", account: { accountTitle: "ZindagiCare", number: "0300" } },
    });
    jest.spyOn(ImagePicker, "requestMediaLibraryPermissionsAsync").mockResolvedValue({ granted: true } as never);
    jest.spyOn(ImagePicker, "launchImageLibraryAsync").mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://receipt.jpg" }],
    } as never);
    mockUploadReceipt.mockResolvedValue(undefined);

    await render(<SundayConsultScreen />);
    await waitFor(() => expect(screen.getByText("Request Sunday consult")).toBeTruthy());
    await fireEvent.press(screen.getByText("No, keep it free"));
    await fireEvent.press(screen.getByText("Yes, contribute Rs. 500"));
    await fireEvent.press(screen.getByText("Request Sunday consult"));
    await screen.findByText("Pay via JazzCash");

    await fireEvent.press(screen.getByText("Choose receipt screenshot"));
    await screen.findByText("Choose a different photo");
    await fireEvent.press(screen.getByText("Submit receipt"));

    await waitFor(() => {
      expect(mockUploadReceipt).toHaveBeenCalledWith(
        "pay-1",
        { uri: "file://receipt.jpg", name: "receipt.jpg", type: "image/jpeg" },
        undefined,
      );
      expect(mockGetMyRequest).toHaveBeenCalledTimes(2);
    });
  });

  it("checks payment status and alerts when still pending", async () => {
    mockSubmitRequest.mockResolvedValue({
      kind: "payment",
      paymentId: "pay-1",
      amount: 500,
    });
    mockGetPaymentStatus.mockResolvedValue({ status: "pending" });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<SundayConsultScreen />);
    await waitFor(() => expect(screen.getByText("Request Sunday consult")).toBeTruthy());
    await fireEvent.press(screen.getByText("Yes, contribute Rs. 500"));
    await fireEvent.press(screen.getByText("Request Sunday consult"));

    await screen.findByText("Waiting for payment confirmation…");
    await fireEvent.press(screen.getByText("I've paid — check status"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Still pending", "We haven't confirmed your payment yet.");
    });
  });

  it("shows a submission error message from the API", async () => {
    mockSubmitRequest.mockRejectedValue(new ApiRequestError("Already requested this Sunday", "DUP", 400));
    await render(<SundayConsultScreen />);
    await waitFor(() => expect(screen.getByText("Request Sunday consult")).toBeTruthy());
    await fireEvent.press(screen.getByText("No, keep it free"));
    await fireEvent.press(screen.getByText("Request Sunday consult"));

    expect(await screen.findByText("Already requested this Sunday")).toBeTruthy();
  });

  it("shows the matching state when a request is already pending", async () => {
    mockGetMyRequest.mockResolvedValue({
      requestId: "req-1",
      status: "requested",
      sundayDateKey: "2026-02-01",
      patientPhone: "03001234567",
      patientNotes: "Fever",
      affordabilityChoice: "cannot_afford",
      createdAt: "2026-01-30T00:00:00.000Z",
    });
    await render(<SundayConsultScreen />);
    expect(await screen.findByText("Finding you a doctor…")).toBeTruthy();
    expect(screen.getByText("“Fever”")).toBeTruthy();
  });

  it("shows the assigned doctor and navigates to appointments", async () => {
    mockGetMyRequest.mockResolvedValue({
      requestId: "req-1",
      status: "assigned",
      sundayDateKey: "2026-02-01",
      patientPhone: "03001234567",
      affordabilityChoice: "cannot_afford",
      createdAt: "2026-01-30T00:00:00.000Z",
      scheduledStart: "2026-02-01T10:00:00.000Z",
      doctor: { doctorId: "doc-1", name: "Dr. Sara Ahmed", specialty: "General", pmdcVerified: true, ratingAvg: 4.9, ratingCount: 10 },
    });
    await render(<SundayConsultScreen />);
    expect(await screen.findByText("Dr. Sara Ahmed")).toBeTruthy();
    await fireEvent.press(screen.getByText("Go to appointments"));
    expect(router.push).toHaveBeenCalledWith("/(tabs)/appointments");
  });

  it("lets the patient request again after a completed or cancelled consult", async () => {
    mockGetMyRequest.mockResolvedValue({
      requestId: "req-1",
      status: "completed",
      sundayDateKey: "2026-02-01",
      patientPhone: "03001234567",
      affordabilityChoice: "cannot_afford",
      createdAt: "2026-01-30T00:00:00.000Z",
    });
    await render(<SundayConsultScreen />);
    expect(await screen.findByText("Your Sunday consult is complete")).toBeTruthy();
    await fireEvent.press(screen.getByText("Request again"));
    expect(await screen.findByText("Request Sunday consult")).toBeTruthy();
  });

  it("does not submit the request twice when pressed twice back-to-back", async () => {
    let resolveSubmit: (v: unknown) => void;
    mockSubmitRequest.mockReturnValue(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      }),
    );
    await render(<SundayConsultScreen />);
    await waitFor(() => expect(screen.getByText("Request Sunday consult")).toBeTruthy());
    await fireEvent.press(screen.getByText("No, keep it free"));

    const submitButton = screen.getByText("Request Sunday consult");
    await act(async () => {
      fireEvent.press(submitButton);
      fireEvent.press(submitButton);
      resolveSubmit!({
        kind: "request",
        requestId: "req-1",
        status: "requested",
        sundayDateKey: "2026-02-01",
        patientPhone: "03001234567",
        affordabilityChoice: "cannot_afford",
        createdAt: "2026-01-30T00:00:00.000Z",
      });
      await waitFor(() => expect(mockSubmitRequest).toHaveBeenCalledTimes(1));
    });
    await screen.findByText("Finding you a doctor…");
    expect(mockSubmitRequest).toHaveBeenCalledTimes(1);
  });

  it("does not fire duplicate payment-status checks when pressed twice back-to-back", async () => {
    mockSubmitRequest.mockResolvedValue({ kind: "payment", paymentId: "pay-1", amount: 500 });
    let resolveStatus: (v: unknown) => void;
    mockGetPaymentStatus.mockReturnValue(
      new Promise((resolve) => {
        resolveStatus = resolve;
      }),
    );
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<SundayConsultScreen />);
    await waitFor(() => expect(screen.getByText("Request Sunday consult")).toBeTruthy());
    await fireEvent.press(screen.getByText("Yes, contribute Rs. 500"));
    await fireEvent.press(screen.getByText("Request Sunday consult"));
    await screen.findByText("Waiting for payment confirmation…");

    const checkButton = screen.getByText("I've paid — check status");
    await act(async () => {
      fireEvent.press(checkButton);
      fireEvent.press(checkButton);
      resolveStatus!({ status: "pending" });
      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Still pending", "We haven't confirmed your payment yet."));
    });
    expect(mockGetPaymentStatus).toHaveBeenCalledTimes(1);
  });
});
