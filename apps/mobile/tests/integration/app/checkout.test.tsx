import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import CheckoutScreen from "@app/checkout";
import {
  checkoutConsult,
  completeTestPayment,
  uploadPaymentReceipt,
  getPaymentStatus,
} from "@/api/consult";
import { ApiRequestError } from "@/api/client";
import { useLocalSearchParams, router } from "expo-router";
import { formatKarachi } from "@/lib/format-date";
import { useAuth } from "@/lib/auth-context";
import { makeAuthUser, makeMockAuth } from "@/test-utils/mock-auth";

jest.mock("@/api/consult");
jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));

const mockCheckout = checkoutConsult as jest.Mock;
const mockCompleteTestPayment = completeTestPayment as jest.Mock;
const mockUploadReceipt = uploadPaymentReceipt as jest.Mock;
const mockGetPaymentStatus = getPaymentStatus as jest.Mock;
const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

const params = { doctorId: "doc-1", slotId: "slot-1", startAt: "2026-03-02T05:00:00.000Z" };

describe("CheckoutScreen", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: makeAuthUser() }));
    mockUseLocalSearchParams.mockReturnValue(params);
    mockGetPaymentStatus.mockResolvedValue({ status: "pending" });
  });

  it("redirects to login instead of rendering checkout when there is no authenticated user", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: null, isLoading: false }));
    await render(<CheckoutScreen />);
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
    expect(screen.queryByText("Confirm booking")).toBeNull();
  });

  it("does not fetch payment status or render checkout while auth is still resolving", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: null, isLoading: true }));
    await render(<CheckoutScreen />);
    expect(router.replace).not.toHaveBeenCalled();
    expect(mockGetPaymentStatus).not.toHaveBeenCalled();
    expect(screen.queryByText("Confirm booking")).toBeNull();
  });

  it("renders the selected slot time and a notes field", async () => {
    await render(<CheckoutScreen />);
    expect(screen.getByText(formatKarachi(params.startAt))).toBeTruthy();
    expect(screen.getByPlaceholderText("Describe your symptoms or reason for the visit")).toBeTruthy();
    expect(screen.getByText("Confirm booking")).toBeTruthy();
  });

  it("shows an error message when booking fails", async () => {
    mockCheckout.mockRejectedValue(new ApiRequestError("Slot no longer available", "SLOT_TAKEN", 409));
    await render(<CheckoutScreen />);
    await fireEvent.press(screen.getByText("Confirm booking"));
    expect(await screen.findByText("Slot no longer available")).toBeTruthy();
  });

  it("books and shows the test-mode payment confirmation button", async () => {
    mockCheckout.mockResolvedValue({ paymentId: "pay-1", appointmentId: "appt-1", amount: 2500, testMode: true });
    await render(<CheckoutScreen />);
    await fireEvent.press(screen.getByText("Confirm booking"));

    expect(await screen.findByText("Rs. 2500")).toBeTruthy();
    expect(screen.getByText("I've paid (test mode)")).toBeTruthy();
  });

  it("completes a test-mode payment and shows the success screen", async () => {
    mockCheckout.mockResolvedValue({ paymentId: "pay-1", appointmentId: "appt-1", amount: 2500, testMode: true });
    mockCompleteTestPayment.mockResolvedValue({ status: "paid" });
    await render(<CheckoutScreen />);
    await fireEvent.press(screen.getByText("Confirm booking"));
    await screen.findByText("I've paid (test mode)");

    await fireEvent.press(screen.getByText("I've paid (test mode)"));

    expect(await screen.findByText("Appointment confirmed")).toBeTruthy();
    expect(mockCompleteTestPayment).toHaveBeenCalledWith("pay-1");
  });

  it("alerts when confirming a test payment fails", async () => {
    mockCheckout.mockResolvedValue({ paymentId: "pay-1", appointmentId: "appt-1", amount: 2500, testMode: true });
    mockCompleteTestPayment.mockRejectedValue(new ApiRequestError("Payment already used", "USED", 400));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<CheckoutScreen />);
    await fireEvent.press(screen.getByText("Confirm booking"));
    await screen.findByText("I've paid (test mode)");
    await fireEvent.press(screen.getByText("I've paid (test mode)"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Couldn't confirm payment", "Payment already used");
    });
  });

  it("navigates to appointments from the success screen", async () => {
    mockCheckout.mockResolvedValue({ paymentId: "pay-1", appointmentId: "appt-1", amount: 2500, testMode: true });
    mockCompleteTestPayment.mockResolvedValue({ status: "paid" });
    await render(<CheckoutScreen />);
    await fireEvent.press(screen.getByText("Confirm booking"));
    await screen.findByText("I've paid (test mode)");
    await fireEvent.press(screen.getByText("I've paid (test mode)"));
    await screen.findByText("Appointment confirmed");

    await fireEvent.press(screen.getByText("View appointments"));
    expect(router.replace).toHaveBeenCalledWith("/(tabs)/appointments");
  });

  it("shows manual transfer instructions and lets the user submit a receipt", async () => {
    mockCheckout.mockResolvedValue({
      paymentId: "pay-1",
      appointmentId: "appt-1",
      amount: 3000,
      manualTransfer: {
        provider: "JazzCash",
        account: { accountTitle: "ZindagiCare", number: "03001234567", numberDisplay: "0300-1234567" },
        description: "Send exactly this amount.",
      },
    });
    jest.spyOn(ImagePicker, "requestMediaLibraryPermissionsAsync").mockResolvedValue({ granted: true } as never);
    jest.spyOn(ImagePicker, "launchImageLibraryAsync").mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://receipt.jpg" }],
    } as never);
    mockUploadReceipt.mockResolvedValue(undefined);

    await render(<CheckoutScreen />);
    await fireEvent.press(screen.getByText("Confirm booking"));

    expect(await screen.findByText("Pay via JazzCash")).toBeTruthy();
    expect(screen.getByText("ZindagiCare")).toBeTruthy();
    expect(screen.getByText("0300-1234567")).toBeTruthy();

    const submitButton = screen.getByText("Submit receipt");
    expect(submitButton.parent?.props.accessibilityState?.disabled ?? submitButton.parent?.props.disabled).toBeTruthy();

    await fireEvent.press(screen.getByText("Choose receipt screenshot"));
    expect(await screen.findByText("Choose a different photo")).toBeTruthy();

    await fireEvent.press(screen.getByText("Submit receipt"));

    await waitFor(() => {
      expect(mockUploadReceipt).toHaveBeenCalledWith(
        "pay-1",
        { uri: "file://receipt.jpg", name: "receipt.jpg", type: "image/jpeg" },
        undefined,
      );
    });
    expect(await screen.findByText("Appointment confirmed")).toBeTruthy();
  });

  it("alerts when photo library permission is denied", async () => {
    mockCheckout.mockResolvedValue({
      paymentId: "pay-1",
      appointmentId: "appt-1",
      amount: 3000,
      manualTransfer: { provider: "JazzCash", account: { accountTitle: "ZindagiCare", number: "0300" } },
    });
    jest.spyOn(ImagePicker, "requestMediaLibraryPermissionsAsync").mockResolvedValue({ granted: false } as never);
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

    await render(<CheckoutScreen />);
    await fireEvent.press(screen.getByText("Confirm booking"));
    await screen.findByText("Pay via JazzCash");
    await fireEvent.press(screen.getByText("Choose receipt screenshot"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Permission needed", "Allow photo library access to attach your receipt.");
    });
  });

  it("shows a waiting message for gateway payments with no manual transfer or test mode", async () => {
    mockCheckout.mockResolvedValue({ paymentId: "pay-1", appointmentId: "appt-1", amount: 3000 });
    await render(<CheckoutScreen />);
    await fireEvent.press(screen.getByText("Confirm booking"));
    expect(await screen.findByText("Waiting for payment confirmation…")).toBeTruthy();
  });
});

describe("CheckoutScreen accessibility", () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReturnValue(params);
  });

  it("exposes an accessible name for the notes field instead of relying on placeholder text alone", async () => {
    await render(<CheckoutScreen />);
    expect(screen.getByLabelText("Notes for the doctor (optional)")).toBeTruthy();
  });

  it("exposes the Confirm booking button as busy and disabled while booking is in flight", async () => {
    let resolveCheckout: (v: unknown) => void;
    mockCheckout.mockReturnValue(new Promise((r) => (resolveCheckout = r)));
    await render(<CheckoutScreen />);
    const button = screen.getByRole("button", { name: "Confirm booking" });
    fireEvent.press(button);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Confirm booking" }).props.accessibilityState).toEqual(
        expect.objectContaining({ disabled: true, busy: true }),
      ),
    );
    resolveCheckout!({ paymentId: "pay-1", appointmentId: "appt-1", amount: 1000, testMode: true });
  });

  it("announces the booking error as an alert", async () => {
    mockCheckout.mockRejectedValue(new ApiRequestError("Slot no longer available", "SLOT_TAKEN", 409));
    await render(<CheckoutScreen />);
    await fireEvent.press(screen.getByText("Confirm booking"));
    const error = await screen.findByText("Slot no longer available");
    expect(error.props.accessibilityRole).toBe("alert");
  });

  it("exposes an accessible name for the 'View appointments' button on the success screen", async () => {
    mockCheckout.mockResolvedValue({ paymentId: "pay-1", appointmentId: "appt-1", amount: 2500, testMode: true });
    mockCompleteTestPayment.mockResolvedValue({ status: "paid" });
    await render(<CheckoutScreen />);
    await fireEvent.press(screen.getByText("Confirm booking"));
    await screen.findByText("I've paid (test mode)");
    await fireEvent.press(screen.getByText("I've paid (test mode)"));
    await screen.findByText("Appointment confirmed");
    expect(screen.getByRole("button", { name: "View appointments" })).toBeTruthy();
  });
});
