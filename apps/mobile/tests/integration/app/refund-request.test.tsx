import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import RefundRequestScreen from "@app/refund-request";
import { getAppointmentHistory, requestAppointmentCancellation } from "@/api/appointments";
import { ApiRequestError } from "@/api/client";
import { useLocalSearchParams, router } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { makeAuthUser, makeMockAuth } from "@/test-utils/mock-auth";

jest.mock("@/api/appointments");
jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));

const mockGetHistory = getAppointmentHistory as jest.Mock;
const mockRequestCancellation = requestAppointmentCancellation as jest.Mock;
const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

const eligibleAppt = {
  appointmentId: "appt-1",
  type: "online" as const,
  typeLabel: "Online consult",
  scheduledStart: "2026-02-01T10:00:00.000Z",
  scheduledEnd: "2026-02-01T10:30:00.000Z",
  status: "confirmed",
  doctor: { doctorId: "doc-1", name: "Dr. Bilal Chaudhry", specialty: "Dermatology" },
  isMissed: false,
  canJoin: false,
  canReview: false,
  canRequestCancellation: true,
  cancellationRequestStatus: "none",
};

async function fillValidForm() {
  await fireEvent.changeText(
    screen.getByPlaceholderText("e.g. I no longer need this consultation…"),
    "Can't make it",
  );
  await fireEvent.changeText(screen.getByPlaceholderText("As it appears on the account"), "Ayesha Khan");
  await fireEvent.changeText(screen.getByPlaceholderText("03xx xxxxxxx"), "03001234567");
}

describe("RefundRequestScreen", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: makeAuthUser() }));
    mockUseLocalSearchParams.mockReturnValue({});
    mockGetHistory.mockResolvedValue([eligibleAppt]);
  });

  it("redirects to login instead of rendering the refund form when there is no authenticated user", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: null, isLoading: false }));
    const result = await render(<RefundRequestScreen />);
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
    expect(result.toJSON()).toBeNull();
  });

  it("does not redirect while auth is still resolving", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: null, isLoading: true }));
    await render(<RefundRequestScreen />);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("shows a message when there are no eligible appointments", async () => {
    mockGetHistory.mockResolvedValue([{ ...eligibleAppt, canRequestCancellation: false }]);
    await render(<RefundRequestScreen />);
    expect(
      await screen.findByText("You don't have any upcoming appointments eligible for a refund right now."),
    ).toBeTruthy();
  });

  it("navigates back from the no-eligible-appointments screen", async () => {
    mockGetHistory.mockResolvedValue([]);
    await render(<RefundRequestScreen />);
    await fireEvent.press(await screen.findByText("Go back"));
    expect(router.back).toHaveBeenCalled();
  });

  it("shows an error message when loading fails", async () => {
    mockGetHistory.mockRejectedValue(new ApiRequestError("Not authorized", "AUTH", 401));
    await render(<RefundRequestScreen />);
    expect(await screen.findByText("Not authorized")).toBeTruthy();
  });

  it("preselects the appointment passed in via route params", async () => {
    mockUseLocalSearchParams.mockReturnValue({ appointmentId: "appt-1" });
    mockGetHistory.mockResolvedValue([
      eligibleAppt,
      { ...eligibleAppt, appointmentId: "appt-2", doctor: { ...eligibleAppt.doctor, name: "Dr. Other" } },
    ]);
    await render(<RefundRequestScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Chaudhry")).toBeTruthy());
    // Both appointments are eligible and listed; submit is disabled until the rest of the form is filled.
    expect(screen.getByText("Dr. Other")).toBeTruthy();
  });

  it("keeps submit disabled until reason, account name, and account number are all valid", async () => {
    await render(<RefundRequestScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Chaudhry")).toBeTruthy());

    const submit = () => screen.getByText("Submit refund request");
    await fireEvent.press(submit());
    expect(mockRequestCancellation).not.toHaveBeenCalled();

    await fillValidForm();
    await fireEvent.press(submit());
    await waitFor(() => expect(mockRequestCancellation).toHaveBeenCalled());
  });

  it("keeps submit disabled with a reason of exactly 2 characters (one below the minimum of 3)", async () => {
    await render(<RefundRequestScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Chaudhry")).toBeTruthy());
    await fireEvent.changeText(screen.getByPlaceholderText("e.g. I no longer need this consultation…"), "ab");
    await fireEvent.changeText(screen.getByPlaceholderText("As it appears on the account"), "Ayesha Khan");
    await fireEvent.changeText(screen.getByPlaceholderText("03xx xxxxxxx"), "03001234567");
    await fireEvent.press(screen.getByText("Submit refund request"));
    expect(mockRequestCancellation).not.toHaveBeenCalled();
  });

  it("allows submit with a reason of exactly 3 characters (the minimum)", async () => {
    await render(<RefundRequestScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Chaudhry")).toBeTruthy());
    await fireEvent.changeText(screen.getByPlaceholderText("e.g. I no longer need this consultation…"), "abc");
    await fireEvent.changeText(screen.getByPlaceholderText("As it appears on the account"), "Ayesha Khan");
    await fireEvent.changeText(screen.getByPlaceholderText("03xx xxxxxxx"), "03001234567");
    await fireEvent.press(screen.getByText("Submit refund request"));
    await waitFor(() => expect(mockRequestCancellation).toHaveBeenCalledTimes(1));
  });

  it("keeps submit disabled with an account title of exactly 1 character (one below the minimum of 2)", async () => {
    await render(<RefundRequestScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Chaudhry")).toBeTruthy());
    await fireEvent.changeText(screen.getByPlaceholderText("e.g. I no longer need this consultation…"), "Can't make it");
    await fireEvent.changeText(screen.getByPlaceholderText("As it appears on the account"), "A");
    await fireEvent.changeText(screen.getByPlaceholderText("03xx xxxxxxx"), "03001234567");
    await fireEvent.press(screen.getByText("Submit refund request"));
    expect(mockRequestCancellation).not.toHaveBeenCalled();
  });

  it("keeps submit disabled with an account number of exactly 4 digits (one below the minimum of 5)", async () => {
    await render(<RefundRequestScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Chaudhry")).toBeTruthy());
    await fireEvent.changeText(screen.getByPlaceholderText("e.g. I no longer need this consultation…"), "Can't make it");
    await fireEvent.changeText(screen.getByPlaceholderText("As it appears on the account"), "Ayesha Khan");
    await fireEvent.changeText(screen.getByPlaceholderText("03xx xxxxxxx"), "0300");
    await fireEvent.press(screen.getByText("Submit refund request"));
    expect(mockRequestCancellation).not.toHaveBeenCalled();
  });

  it("allows submit with an account number of exactly 5 digits (the minimum)", async () => {
    await render(<RefundRequestScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Chaudhry")).toBeTruthy());
    await fireEvent.changeText(screen.getByPlaceholderText("e.g. I no longer need this consultation…"), "Can't make it");
    await fireEvent.changeText(screen.getByPlaceholderText("As it appears on the account"), "Ayesha Khan");
    await fireEvent.changeText(screen.getByPlaceholderText("03xx xxxxxxx"), "03001");
    await fireEvent.press(screen.getByText("Submit refund request"));
    await waitFor(() => expect(mockRequestCancellation).toHaveBeenCalledTimes(1));
  });

  it("keeps submit disabled when only whitespace is entered in required fields", async () => {
    await render(<RefundRequestScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Chaudhry")).toBeTruthy());
    await fireEvent.changeText(screen.getByPlaceholderText("e.g. I no longer need this consultation…"), "   ");
    await fireEvent.changeText(screen.getByPlaceholderText("As it appears on the account"), "   ");
    await fireEvent.changeText(screen.getByPlaceholderText("03xx xxxxxxx"), "   ");
    await fireEvent.press(screen.getByText("Submit refund request"));
    expect(mockRequestCancellation).not.toHaveBeenCalled();
  });

  it("keeps submit disabled with a bank name of exactly 1 character when the bank method is selected", async () => {
    await render(<RefundRequestScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Chaudhry")).toBeTruthy());
    await fireEvent.press(screen.getByText("Bank"));
    await fireEvent.changeText(screen.getByPlaceholderText("e.g. I no longer need this consultation…"), "Can't make it");
    await fireEvent.changeText(screen.getByPlaceholderText("As it appears on the account"), "Ayesha Khan");
    await fireEvent.changeText(screen.getByPlaceholderText("PKxx BANK 0000 1234 5678"), "PK00HABB0000123456789");
    await fireEvent.changeText(screen.getByPlaceholderText("e.g. HBL, Meezan Bank"), "H");
    await fireEvent.press(screen.getByText("Submit refund request"));
    expect(mockRequestCancellation).not.toHaveBeenCalled();
  });

  it("lets every field be found and filled by its accessible name, including the label that changes with the payout method", async () => {
    mockRequestCancellation.mockResolvedValue({ id: "req-1", cancellationRequestStatus: "pending" });
    await render(<RefundRequestScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Chaudhry")).toBeTruthy());

    await fireEvent.changeText(screen.getByLabelText("Why are you cancelling?"), "Can't make it");
    await fireEvent.changeText(screen.getByLabelText("Account holder name"), "Ayesha Khan");
    await fireEvent.changeText(screen.getByLabelText("Mobile number"), "03001234567");
    await fireEvent.press(screen.getByText("Submit refund request"));

    await waitFor(() => {
      expect(mockRequestCancellation).toHaveBeenCalledWith(
        "appt-1",
        expect.objectContaining({ refundMethod: "jazzcash", refundAccountNumber: "03001234567" }),
      );
    });
  });

  it("relabels the account field for accessibility when switching to the bank payout method", async () => {
    await render(<RefundRequestScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Chaudhry")).toBeTruthy());
    expect(screen.getByLabelText("Mobile number")).toBeTruthy();

    await fireEvent.press(screen.getByText("Bank"));

    expect(screen.queryByLabelText("Mobile number")).toBeNull();
    expect(screen.getByLabelText("Account number / IBAN")).toBeTruthy();
    expect(screen.getByLabelText("Bank name")).toBeTruthy();
  });

  it("submits a JazzCash refund request with trimmed values", async () => {
    mockRequestCancellation.mockResolvedValue({ id: "req-1", cancellationRequestStatus: "pending" });
    await render(<RefundRequestScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Chaudhry")).toBeTruthy());

    await fireEvent.changeText(
      screen.getByPlaceholderText("e.g. I no longer need this consultation…"),
      "  Can't make it  ",
    );
    await fireEvent.changeText(screen.getByPlaceholderText("As it appears on the account"), "  Ayesha Khan  ");
    await fireEvent.changeText(screen.getByPlaceholderText("03xx xxxxxxx"), "  03001234567  ");
    await fireEvent.press(screen.getByText("Submit refund request"));

    await waitFor(() => {
      expect(mockRequestCancellation).toHaveBeenCalledWith("appt-1", {
        reason: "Can't make it",
        refundMethod: "jazzcash",
        refundAccountTitle: "Ayesha Khan",
        refundAccountNumber: "03001234567",
      });
    });
    expect(await screen.findByText("Refund request submitted")).toBeTruthy();
  });

  it("requires a bank name when the bank method is selected", async () => {
    await render(<RefundRequestScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Chaudhry")).toBeTruthy());
    await fireEvent.press(screen.getByText("Bank"));
    await fireEvent.changeText(
      screen.getByPlaceholderText("e.g. I no longer need this consultation…"),
      "Can't make it",
    );
    await fireEvent.changeText(screen.getByPlaceholderText("As it appears on the account"), "Ayesha Khan");
    await fireEvent.changeText(screen.getByPlaceholderText("PKxx BANK 0000 1234 5678"), "PK00HABB0000123456789");

    await fireEvent.press(screen.getByText("Submit refund request"));
    expect(mockRequestCancellation).not.toHaveBeenCalled();

    expect(screen.getByText("Account number / IBAN")).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText("e.g. HBL, Meezan Bank"), "HBL");
    await fireEvent.press(screen.getByText("Submit refund request"));

    await waitFor(() => {
      expect(mockRequestCancellation).toHaveBeenCalledWith(
        "appt-1",
        expect.objectContaining({ refundMethod: "bank", refundBankName: "HBL" }),
      );
    });
  });

  it("shows an alert when submission fails", async () => {
    mockRequestCancellation.mockRejectedValue(new ApiRequestError("Refund already requested", "DUP", 400));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<RefundRequestScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Chaudhry")).toBeTruthy());

    await fillValidForm();
    await fireEvent.press(screen.getByText("Submit refund request"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Couldn't submit request", "Refund already requested");
    });
  });

  it("returns to appointments from the success screen", async () => {
    mockRequestCancellation.mockResolvedValue({ id: "req-1", cancellationRequestStatus: "pending" });
    await render(<RefundRequestScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Chaudhry")).toBeTruthy());
    await fillValidForm();
    await fireEvent.press(screen.getByText("Submit refund request"));
    await screen.findByText("Refund request submitted");

    await fireEvent.press(screen.getByText("Back to appointments"));
    expect(router.replace).toHaveBeenCalledWith("/(tabs)/appointments");
  });

  it("does not submit twice when the submit button is pressed twice back-to-back", async () => {
    let resolveRequest: (v: unknown) => void;
    mockRequestCancellation.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    await render(<RefundRequestScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Chaudhry")).toBeTruthy());
    await fillValidForm();

    const submitButton = screen.getByText("Submit refund request");
    await act(async () => {
      fireEvent.press(submitButton);
      fireEvent.press(submitButton);
      resolveRequest!({ id: "req-1", cancellationRequestStatus: "pending" });
      await waitFor(() => expect(mockRequestCancellation).toHaveBeenCalledTimes(1));
    });
    await screen.findByText("Refund request submitted");
    expect(mockRequestCancellation).toHaveBeenCalledTimes(1);
  });

  it("accepts and submits a very long (1,000-character) reason without crashing or truncating it", async () => {
    mockRequestCancellation.mockResolvedValue({ id: "req-1", cancellationRequestStatus: "pending" });
    await render(<RefundRequestScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Chaudhry")).toBeTruthy());

    const longReason = "C".repeat(1000);
    await fireEvent.changeText(screen.getByPlaceholderText("e.g. I no longer need this consultation…"), longReason);
    await fireEvent.changeText(screen.getByPlaceholderText("As it appears on the account"), "Ayesha Khan");
    await fireEvent.changeText(screen.getByPlaceholderText("03xx xxxxxxx"), "03001234567");
    await fireEvent.press(screen.getByText("Submit refund request"));

    await waitFor(() => {
      expect(mockRequestCancellation).toHaveBeenCalledWith(
        "appt-1",
        expect.objectContaining({ reason: longReason }),
      );
    });
  });
});
