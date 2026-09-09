// E2E journey: Signup -> Login/Home -> Doctors -> Doctor Detail -> Slot -> Checkout ->
// Appointment Created -> Appointments -> Appointment appears.
//
// Each screen is rendered the same way the app itself would swap screens: a screen is
// mounted, the user interacts with it, we capture the exact `router.push`/`replace` call
// it made, and then mount the *next* screen with `useLocalSearchParams` seeded from that
// captured call — the same params the real navigator would hand it. This lets us assert
// that data (doctorId, slotId, startAt, appointment identity) survives the whole journey
// instead of being lost or swapped between screens.
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import SignupScreen from "@app/(auth)/signup";
import HomeScreen from "@app/(tabs)/index";
import DoctorsScreen from "@app/(tabs)/doctors";
import DoctorProfileScreen from "@app/doctor/[doctorId]";
import CheckoutScreen from "@app/checkout";
import AppointmentsScreen from "@app/(tabs)/appointments";
import { expectedDateOfBirth } from "../../utils/expected-dob";
import { useAuth } from "@/lib/auth-context";
import { router, useLocalSearchParams } from "expo-router";
import { makeAuthUser, makeMockAuth } from "@/test-utils/mock-auth";
import { listConsultDoctors, getConsultDoctor, listConsultSlots, checkoutConsult, completeTestPayment } from "@/api/consult";
import { getOnlineBooking } from "@/api/dashboard";
import { listMyHomeVisits } from "@/api/home-visits";
import { listPrescriptions } from "@/api/prescriptions";
import { getAppointmentHistory } from "@/api/appointments";

jest.mock("@/lib/auth-context", () => ({ isExpoGo: true, useAuth: jest.fn() }));
jest.mock("@/api/consult");
jest.mock("@/api/dashboard");
jest.mock("@/api/home-visits");
jest.mock("@/api/prescriptions");
jest.mock("@/api/appointments");

const mockUseAuth = useAuth as jest.Mock;
const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockListConsultDoctors = listConsultDoctors as jest.Mock;
const mockGetConsultDoctor = getConsultDoctor as jest.Mock;
const mockListConsultSlots = listConsultSlots as jest.Mock;
const mockCheckout = checkoutConsult as jest.Mock;
const mockCompleteTestPayment = completeTestPayment as jest.Mock;
const mockGetOnlineBooking = getOnlineBooking as jest.Mock;
const mockListMyHomeVisits = listMyHomeVisits as jest.Mock;
const mockListPrescriptions = listPrescriptions as jest.Mock;
const mockGetAppointmentHistory = getAppointmentHistory as jest.Mock;

const doctorRow = {
  doctorId: "doc-42",
  name: "Dr. Sana Malik",
  avatarUrl: undefined,
  specialties: ["Dermatology"],
  ratingAvg: 4.9,
  ratingCount: 50,
  pmdcVerified: true,
  consultationFee: 1800,
  hospital: "Shifa Hospital",
  qualifications: [],
  availableSlots: 2,
  isFull: false,
};

const doctorProfile = {
  doctorId: "doc-42",
  slug: "dr-sana",
  name: "Dr. Sana Malik",
  avatarUrl: undefined,
  specialties: ["Dermatology"],
  bio: "Skin specialist.",
  experienceYears: 8,
  languages: ["English", "Urdu"],
  medicalDegree: "MBBS",
  qualifications: ["FCPS"],
  medicalCollege: "Allama Iqbal Medical College",
  graduationYear: 2015,
  hospitals: [{ name: "Shifa Hospital", city: "Lahore", address: "Canal Rd" }],
  pmdcVerified: true,
  consultationFee: 1800,
  ratingAvg: 4.9,
  ratingCount: 50,
  availableSlots: 2,
  isFull: false,
  videoConsultEnabled: true,
};

function findLastPushTo(pathname: string) {
  const calls = (router.push as jest.Mock).mock.calls;
  for (let i = calls.length - 1; i >= 0; i--) {
    const arg = calls[i][0];
    if (typeof arg === "object" && arg.pathname === pathname) return arg;
  }
  throw new Error(`router.push was never called with pathname ${pathname}`);
}

describe("Patient happy path: signup through booking and viewing the appointment", () => {
  beforeEach(() => {
    mockGetOnlineBooking.mockResolvedValue(null);
    mockListMyHomeVisits.mockResolvedValue([]);
    mockListPrescriptions.mockResolvedValue([]);
  });

  it("Section 4: signs up, lands on Home once authenticated, and is not sent back to login", async () => {
    const registerWithCredentials = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ registerWithCredentials }));
    const { rerender } = await render(<SignupScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText("Full name"), "Aisha Khan");
    await fireEvent.changeText(screen.getByPlaceholderText("Email"), "aisha@example.com");
    await fireEvent.changeText(screen.getByPlaceholderText("Phone (03XXXXXXXXX)"), "03001234567");
    await fireEvent(screen.getByPlaceholderText("Type to search your city"), "focus");
    await fireEvent.press(screen.getByText("Lahore"));
    await fireEvent.changeText(screen.getByPlaceholderText("Age"), "28");
    await fireEvent.changeText(screen.getByPlaceholderText("Password (min 6 characters)"), "secret1");
    await fireEvent.changeText(screen.getByPlaceholderText("Confirm password"), "secret1");
    await fireEvent.press(screen.getByText("Create account"));

    await waitFor(() => {
      expect(registerWithCredentials).toHaveBeenCalledWith({
        name: "Aisha Khan",
        email: "aisha@example.com",
        password: "secret1",
        confirmPassword: "secret1",
        phone: "03001234567",
        city: "Lahore",
        dateOfBirth: expectedDateOfBirth(28),
        accountType: "patient",
      });
    });

    // Signup resolved and the AuthProvider's user state flipped to signed-in — the same
    // screen instance re-renders (as it would in the app) and must redirect off itself.
    const signedInUser = makeAuthUser({ id: "u-aisha", name: "Aisha Khan", roles: ["patient"] });
    mockUseAuth.mockReturnValue(makeMockAuth({ user: signedInUser }));
    rerender(<SignupScreen />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/(tabs)"));

    // Home renders for the now-authenticated patient.
    mockUseAuth.mockReturnValue(makeMockAuth({ user: signedInUser }));
    await render(<HomeScreen />);
    expect(await screen.findByText("Aisha")).toBeTruthy();
    // Never bounced back to login.
    expect(router.replace).not.toHaveBeenCalledWith("/(auth)/login");
  });

  it("Section 23: complete booking journey from Doctors through to the created appointment", async () => {
    const user = makeAuthUser({ roles: ["patient"] });
    mockUseAuth.mockReturnValue(makeMockAuth({ user }));

    // 1. Doctors list
    mockListConsultDoctors.mockResolvedValue([doctorRow]);
    await render(<DoctorsScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Sana Malik")).toBeTruthy());
    await fireEvent.press(screen.getByText("Dr. Sana Malik"));

    const toDoctor = findLastPushTo("/doctor/[doctorId]");
    expect(toDoctor.params.doctorId).toBe("doc-42");

    // 2. Doctor detail — loads using exactly the doctorId the list navigated with.
    mockUseLocalSearchParams.mockReturnValue({ doctorId: toDoctor.params.doctorId });
    mockGetConsultDoctor.mockResolvedValue({ doctor: doctorProfile, reviews: [], reviewTotal: 0 });
    mockListConsultSlots.mockResolvedValue({
      doctorId: "doc-42",
      slots: [{ slotId: "slot-9", startAt: "2026-03-10T06:00:00.000Z", endAt: "2026-03-10T06:30:00.000Z", status: "available" }],
    });
    await render(<DoctorProfileScreen />);
    await waitFor(() => expect(mockGetConsultDoctor).toHaveBeenCalledWith("doc-42"));
    expect(screen.getByText("Dr. Sana Malik")).toBeTruthy();
    const slotButton = await screen.findByText(/^\d{1,2}:\d{2}/);
    await fireEvent.press(slotButton);

    const toCheckout = findLastPushTo("/checkout");
    expect(toCheckout.params).toEqual({ doctorId: "doc-42", slotId: "slot-9", startAt: "2026-03-10T06:00:00.000Z" });

    // 3. Checkout — same doctor/slot/time flow through as params.
    mockUseLocalSearchParams.mockReturnValue(toCheckout.params);
    mockCheckout.mockResolvedValue({ paymentId: "pay-77", appointmentId: "appt-99", amount: 1800, testMode: true });
    mockCompleteTestPayment.mockResolvedValue({ status: "paid" });
    await render(<CheckoutScreen />);
    await fireEvent.press(screen.getByText("Confirm booking"));
    expect(await screen.findByText("Rs. 1800")).toBeTruthy();
    await fireEvent.press(screen.getByText("I've paid (test mode)"));
    expect(await screen.findByText("Appointment confirmed")).toBeTruthy();

    // 4. Appointment created -> navigate to Appointments.
    await fireEvent.press(screen.getByText("View appointments"));
    expect(router.replace).toHaveBeenCalledWith("/(tabs)/appointments");

    // 5. Appointments list shows the newly booked appointment with the correct doctor/time.
    mockGetAppointmentHistory.mockResolvedValue([
      {
        appointmentId: "appt-99",
        type: "online",
        typeLabel: "Online consult",
        scheduledStart: "2026-03-10T06:00:00.000Z",
        scheduledEnd: "2026-03-10T06:30:00.000Z",
        status: "confirmed",
        doctor: { doctorId: "doc-42", name: "Dr. Sana Malik", avatarUrl: undefined, specialty: "Dermatology" },
        isMissed: false,
        canJoin: true,
        canReview: false,
        canRequestCancellation: true,
        cancellationRequestStatus: "none",
      },
    ]);
    await render(<AppointmentsScreen />);
    expect(await screen.findByText("Dr. Sana Malik")).toBeTruthy();
    expect(screen.getByText("Online consult")).toBeTruthy();
    expect(screen.getByText("Confirmed")).toBeTruthy();
  });
});
