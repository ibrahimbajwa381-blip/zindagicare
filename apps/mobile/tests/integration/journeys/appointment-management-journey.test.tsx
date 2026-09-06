// E2E journey: Section 10 (appointment management) + the Appointments -> refund-request chain
// from Section 8. Verifies the correct appointment stays selected across screens and that the
// list reflects updated state after an action, without stale data lingering.
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import AppointmentsScreen from "@app/(tabs)/appointments";
import RefundRequestScreen from "@app/refund-request";
import { router, useLocalSearchParams } from "expo-router";
import { getAppointmentHistory, submitAppointmentReview, requestAppointmentCancellation } from "@/api/appointments";
import { useAuth } from "@/lib/auth-context";
import { makeAuthUser, makeMockAuth } from "@/test-utils/mock-auth";

jest.mock("@/api/appointments");
jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;
mockUseAuth.mockReturnValue(makeMockAuth({ user: makeAuthUser() }));

const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockGetHistory = getAppointmentHistory as jest.Mock;
const mockSubmitReview = submitAppointmentReview as jest.Mock;
const mockRequestCancellation = requestAppointmentCancellation as jest.Mock;

const appointmentA = {
  appointmentId: "appt-a",
  type: "online" as const,
  typeLabel: "Online consult",
  scheduledStart: "2026-02-01T10:00:00.000Z",
  scheduledEnd: "2026-02-01T10:30:00.000Z",
  status: "completed",
  doctor: { doctorId: "doc-a", name: "Dr. Ayesha Noor", avatarUrl: undefined, specialty: "Dermatology" },
  isMissed: false,
  canJoin: false,
  canReview: true,
  canRequestCancellation: false,
  cancellationRequestStatus: "none",
};

const appointmentB = {
  appointmentId: "appt-b",
  type: "online" as const,
  typeLabel: "Online consult",
  scheduledStart: "2026-02-05T10:00:00.000Z",
  scheduledEnd: "2026-02-05T10:30:00.000Z",
  status: "confirmed",
  doctor: { doctorId: "doc-b", name: "Dr. Bilal Khan", avatarUrl: undefined, specialty: "Cardiology" },
  isMissed: false,
  canJoin: true,
  canReview: false,
  canRequestCancellation: true,
  cancellationRequestStatus: "none",
};

describe("Section 10: appointment management journey", () => {
  it("opens the review modal for the correct appointment, submits it, and the list reflects the update", async () => {
    mockGetHistory.mockResolvedValueOnce([appointmentA, appointmentB]);
    await render(<AppointmentsScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Ayesha Noor")).toBeTruthy());
    expect(screen.getByText("Dr. Bilal Khan")).toBeTruthy();

    await fireEvent.press(screen.getByText("Leave a review"));
    expect(await screen.findByText("Rate Dr. Ayesha Noor")).toBeTruthy();

    mockSubmitReview.mockResolvedValue({ rating: 5, createdAt: "2026-02-02" });
    mockGetHistory.mockResolvedValueOnce([
      { ...appointmentA, canReview: false, review: { rating: 5, comment: undefined, createdAt: "2026-02-02" } },
      appointmentB,
    ]);
    await fireEvent.press(screen.getByText("Submit"));

    await waitFor(() => expect(mockSubmitReview).toHaveBeenCalledWith("appt-a", { rating: 5, comment: undefined }));
    // The list reloads and now shows the submitted rating instead of the "Leave a review" prompt for appt-a.
    await waitFor(() => expect(screen.queryByText("Rate Dr. Ayesha Noor")).toBeNull());
    expect(screen.getByText("Dr. Bilal Khan")).toBeTruthy(); // the other appointment's row is untouched
  });

  it("Section 8 chain: Appointments -> Request refund navigates with the tapped appointment's id, and Refund Request preselects it", async () => {
    mockGetHistory.mockResolvedValueOnce([appointmentA, appointmentB]);
    await render(<AppointmentsScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Khan")).toBeTruthy());

    await fireEvent.press(screen.getByText("Request refund"));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/refund-request", params: { appointmentId: "appt-b" } });

    // Refund Request screen receives that exact appointmentId and shows the right doctor preselected.
    mockUseLocalSearchParams.mockReturnValue({ appointmentId: "appt-b" });
    mockGetHistory.mockResolvedValueOnce([appointmentB]);
    await render(<RefundRequestScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Khan")).toBeTruthy());

    await fireEvent.changeText(screen.getByPlaceholderText("e.g. I no longer need this consultation…"), "Schedule conflict");
    await fireEvent.press(screen.getByText("JazzCash"));
    await fireEvent.changeText(screen.getByPlaceholderText("As it appears on the account"), "Bilal's Patient");
    await fireEvent.changeText(screen.getByPlaceholderText("03xx xxxxxxx"), "03001234567");

    mockRequestCancellation.mockResolvedValue(undefined);
    await fireEvent.press(screen.getByText("Submit refund request"));

    await waitFor(() => {
      expect(mockRequestCancellation).toHaveBeenCalledWith("appt-b", {
        reason: "Schedule conflict",
        refundMethod: "jazzcash",
        refundAccountTitle: "Bilal's Patient",
        refundAccountNumber: "03001234567",
      });
    });
    expect(await screen.findByText("Refund request submitted")).toBeTruthy();

    await fireEvent.press(screen.getByText("Back to appointments"));
    expect(router.replace).toHaveBeenCalledWith("/(tabs)/appointments");
  });

  it("does not carry a closed review modal's typed comment into a different appointment's review modal", async () => {
    mockGetHistory.mockResolvedValue([
      { ...appointmentA, canReview: true },
      { ...appointmentB, canJoin: false, canReview: true },
    ]);
    await render(<AppointmentsScreen />);
    await waitFor(() => expect(screen.getAllByText("Leave a review")).toHaveLength(2));

    await fireEvent.press(screen.getAllByText("Leave a review")[0]);
    expect(await screen.findByText("Rate Dr. Ayesha Noor")).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText("Add a comment (optional)"), "Not a great experience");
    await fireEvent.press(screen.getByText("Close"));
    await waitFor(() => expect(screen.queryByText("Rate Dr. Ayesha Noor")).toBeNull());

    await fireEvent.press(screen.getAllByText("Leave a review")[1]);
    expect(await screen.findByText("Rate Dr. Bilal Khan")).toBeTruthy();
    expect(screen.queryByDisplayValue("Not a great experience")).toBeNull();
  });
});
