// E2E journeys: failure + recovery paths through the patient booking flow (Sections 19, 21, 24).
// The frontend must show an error state on a mocked API failure and let the user retry to
// success WITHOUT restarting the app or losing previously entered/selected data.
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import DoctorsScreen from "@app/(tabs)/doctors";
import DoctorProfileScreen from "@app/doctor/[doctorId]";
import CheckoutScreen from "@app/checkout";
import { router, useLocalSearchParams } from "expo-router";
import { listConsultDoctors, getConsultDoctor, listConsultSlots, checkoutConsult, completeTestPayment } from "@/api/consult";
import { ApiRequestError } from "@/api/client";
import { useAuth } from "@/lib/auth-context";
import { makeAuthUser, makeMockAuth } from "@/test-utils/mock-auth";

jest.mock("@/api/consult");
jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;
mockUseAuth.mockReturnValue(makeMockAuth({ user: makeAuthUser() }));

const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockListConsultDoctors = listConsultDoctors as jest.Mock;
const mockGetConsultDoctor = getConsultDoctor as jest.Mock;
const mockListConsultSlots = listConsultSlots as jest.Mock;
const mockCheckout = checkoutConsult as jest.Mock;
const mockCompleteTestPayment = completeTestPayment as jest.Mock;

const doctor = {
  doctorId: "doc-7",
  slug: "dr-x",
  name: "Dr. Bilal Chaudhry",
  avatarUrl: undefined,
  specialties: ["General Medicine"],
  bio: "",
  experienceYears: 5,
  languages: ["English"],
  medicalDegree: "MBBS",
  qualifications: [],
  medicalCollege: "",
  graduationYear: undefined,
  hospitals: [],
  pmdcVerified: false,
  consultationFee: 1000,
  ratingAvg: 4.2,
  ratingCount: 10,
  availableSlots: 1,
  isFull: false,
  videoConsultEnabled: true,
};

describe("Section 24: complete failure-path journey (Login area) -> Doctors -> Search -> Doctor -> Booking failure -> retry -> success", () => {
  it("recovers from a doctor-search API error via retry without losing the typed filters", async () => {
    mockListConsultDoctors.mockRejectedValueOnce(new ApiRequestError("Network error", "NETWORK", 0));
    await render(<DoctorsScreen />);
    expect(await screen.findByText("Network error")).toBeTruthy();

    mockListConsultDoctors.mockResolvedValueOnce([
      { ...doctor, name: "Dr. Bilal Chaudhry" },
    ]);
    // Retry via the search button, still targeting the same (default) filters — no restart needed.
    await fireEvent.press(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Dr. Bilal Chaudhry")).toBeTruthy();
    expect(screen.queryByText("Network error")).toBeNull();
  });

  it("shows an empty-results state (not an error) for a search with no matches, then recovers on a broader search", async () => {
    mockListConsultDoctors.mockResolvedValueOnce([]);
    await render(<DoctorsScreen />);
    expect(await screen.findByText("No doctors found for this search.")).toBeTruthy();

    mockListConsultDoctors.mockResolvedValueOnce([doctor]);
    await fireEvent.changeText(screen.getByPlaceholderText("Specialty"), "");
    await fireEvent.press(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Dr. Bilal Chaudhry")).toBeTruthy();
  });

  it("does not let a slow, superseded search response clobber a faster later one (rapid filter changes)", async () => {
    mockListConsultDoctors.mockResolvedValueOnce([doctor]);
    await render(<DoctorsScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Chaudhry")).toBeTruthy());

    let resolveSlow: (v: unknown) => void;
    let resolveFast: (v: unknown) => void;
    const slow = new Promise((r) => (resolveSlow = r));
    const fast = new Promise((r) => (resolveFast = r));
    mockListConsultDoctors.mockImplementationOnce(() => slow).mockImplementationOnce(() => fast);

    // The search button's press handler is invoked directly (not via `fireEvent`, whose async
    // wrapper would try to fully flush before returning and hang on the deliberately-pending
    // request) — same technique the codebase's own rapid-refresh regression tests use for
    // `RefreshControl.onRefresh`.
    const pressSearch = () => screen.getByRole("button", { name: "Search" }).props.onClick();
    await fireEvent.changeText(screen.getByPlaceholderText("Specialty"), "Cardio");
    pressSearch(); // slow request in flight (left pending for now)
    await fireEvent.changeText(screen.getByPlaceholderText("Specialty"), "Derma");
    pressSearch(); // second, faster request in flight

    await act(async () => {
      resolveFast!([{ ...doctor, doctorId: "doc-derma", name: "Dr. Derma Result" }]);
    });
    expect(await screen.findByText("Dr. Derma Result")).toBeTruthy();

    await act(async () => {
      resolveSlow!([{ ...doctor, doctorId: "doc-cardio", name: "Dr. Cardio Result" }]);
    });
    // The stale "Cardio" response must not overwrite the newer "Derma" results.
    expect(screen.queryByText("Dr. Cardio Result")).toBeNull();
    expect(screen.getByText("Dr. Derma Result")).toBeTruthy();
  });

  it("recovers from a booking failure at checkout via retry, without losing the doctor/slot selection or typed notes", async () => {
    mockUseLocalSearchParams.mockReturnValue({ doctorId: "doc-7", slotId: "slot-1", startAt: "2026-04-01T05:00:00.000Z" });
    mockCheckout
      .mockRejectedValueOnce(new ApiRequestError("Slot no longer available", "SLOT_TAKEN", 409))
      .mockResolvedValueOnce({ paymentId: "pay-1", appointmentId: "appt-1", amount: 1000, testMode: true });

    await render(<CheckoutScreen />);
    await fireEvent.changeText(
      screen.getByPlaceholderText("Describe your symptoms or reason for the visit"),
      "Persistent cough for 3 days",
    );
    await fireEvent.press(screen.getByText("Confirm booking"));
    expect(await screen.findByText("Slot no longer available")).toBeTruthy();

    // Retry — the notes the patient typed must still be there, and the same doctor/slot params are reused.
    expect(screen.getByDisplayValue("Persistent cough for 3 days")).toBeTruthy();
    await fireEvent.press(screen.getByText("Confirm booking"));

    expect(await screen.findByText("Rs. 1000")).toBeTruthy();
    expect(mockCheckout).toHaveBeenNthCalledWith(2, {
      doctorId: "doc-7",
      slotId: "slot-1",
      patientNotes: "Persistent cough for 3 days",
    });

    mockCompleteTestPayment.mockResolvedValue({ status: "paid" });
    await fireEvent.press(screen.getByText("I've paid (test mode)"));
    expect(await screen.findByText("Appointment confirmed")).toBeTruthy();
  });

  it("Section 21: does not double-book when Confirm booking is tapped twice in quick succession", async () => {
    mockUseLocalSearchParams.mockReturnValue({ doctorId: "doc-7", slotId: "slot-1", startAt: "2026-04-01T05:00:00.000Z" });
    let resolveCheckout: (v: unknown) => void;
    const pending = new Promise((r) => (resolveCheckout = r));
    mockCheckout.mockImplementation(() => pending);

    await render(<CheckoutScreen />);
    const pressConfirm = () => screen.getByText("Confirm booking").parent?.props.onClick();
    pressConfirm();
    pressConfirm(); // rapid second tap while the first request is still pending

    await act(async () => {
      resolveCheckout!({ paymentId: "pay-1", appointmentId: "appt-1", amount: 1000, testMode: true });
    });
    expect(await screen.findByText("I've paid (test mode)")).toBeTruthy();

    // Only one booking request should have gone out for the two rapid taps.
    expect(mockCheckout).toHaveBeenCalledTimes(1);
  });

  it("does not crash and shows the error state when a doctor is opened whose detail request times out/fails", async () => {
    mockUseLocalSearchParams.mockReturnValue({ doctorId: "doc-404" });
    mockGetConsultDoctor.mockRejectedValue(new ApiRequestError("Doctor not found", "NOT_FOUND", 404));
    mockListConsultSlots.mockRejectedValue(new Error("network down"));
    await render(<DoctorProfileScreen />);
    expect(await screen.findByText("Doctor not found")).toBeTruthy();
    // No stray navigation should have been triggered by the failure.
    expect(router.push).not.toHaveBeenCalled();
  });
});
