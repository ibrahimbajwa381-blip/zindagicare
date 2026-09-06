import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Linking, Alert } from "react-native";
import HomeScreen from "@app/(tabs)/index";
import { useAuth } from "@/lib/auth-context";
import { getOnlineBooking } from "@/api/dashboard";
import { listMyHomeVisits } from "@/api/home-visits";
import { listPrescriptions } from "@/api/prescriptions";
import { joinVideoSession } from "@/api/appointments";
import { ApiRequestError } from "@/api/client";
import { router } from "expo-router";
import { makeAuthUser, makeMockAuth } from "@/test-utils/mock-auth";
import { formatKarachi } from "@/lib/format-date";

jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));
jest.mock("@/api/dashboard");
jest.mock("@/api/home-visits");
jest.mock("@/api/prescriptions");
jest.mock("@/api/appointments");

const mockUseAuth = useAuth as jest.Mock;
const mockGetOnlineBooking = getOnlineBooking as jest.Mock;
const mockListMyHomeVisits = listMyHomeVisits as jest.Mock;
const mockListPrescriptions = listPrescriptions as jest.Mock;
const mockJoinVideoSession = joinVideoSession as jest.Mock;

const booking = {
  appointmentId: "appt-1",
  scheduledStart: "2026-01-01T10:00:00.000Z",
  scheduledEnd: "2026-01-01T10:30:00.000Z",
  status: "confirmed",
  consultationFee: 1500,
  doctor: {
    doctorId: "doc-1",
    userId: "u-1",
    name: "Dr. Sara Ahmed",
    avatarUrl: undefined,
    specialty: "Cardiology",
    pmdcVerified: true,
    ratingAvg: 4.8,
    ratingCount: 20,
  },
};

const homeVisit = {
  id: "visit-1",
  serviceType: "nurse" as const,
  status: "assigned" as const,
  address: { line: "123 Main St", city: "Lahore", geo: { lat: 0, lng: 0 } },
  pricing: { base: 500, surge: 0, distance: 0, total: 500, currency: "PKR" },
  scheduledAt: "2026-01-02T09:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const rx = {
  id: "rx-1",
  doctorName: "Dr. Sara Ahmed",
  patientName: "Test Patient",
  issuedAt: "2026-01-01T00:00:00.000Z",
  medicationCount: 2,
  downloadUrl: "/rx-1.pdf",
};

describe("HomeScreen", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: makeAuthUser({ name: "Ayesha Khan" }) }));
    mockGetOnlineBooking.mockResolvedValue(null);
    mockListMyHomeVisits.mockResolvedValue([]);
    mockListPrescriptions.mockResolvedValue([]);
  });

  it("greets the user by first name", async () => {
    await render(<HomeScreen />);
    await waitFor(() => expect(screen.getByText("Ayesha")).toBeTruthy());
  });

  it("falls back to a generic name when the user has none", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: makeAuthUser({ name: undefined }) }));
    await render(<HomeScreen />);
    await waitFor(() => expect(screen.getByText("there")).toBeTruthy());
  });

  it("shows the empty consultation and home-visit states when there is no activity", async () => {
    await render(<HomeScreen />);
    await waitFor(() => {
      expect(screen.getByText("No upcoming consultation")).toBeTruthy();
      expect(screen.getByText("No home visits scheduled")).toBeTruthy();
    });
    expect(screen.getByText("Your consultations, home visits, and prescriptions — all in one place.")).toBeTruthy();
  });

  it("shows a load error state and lets the user retry by pull-to-refresh", async () => {
    mockGetOnlineBooking.mockRejectedValueOnce(new Error("network down"));
    await render(<HomeScreen />);
    await waitFor(() => expect(screen.getByText("Couldn't load this")).toBeTruthy());
    expect(screen.getByText("Pull down to try again.")).toBeTruthy();
  });

  it("renders the active booking card with a join button when confirmed", async () => {
    mockGetOnlineBooking.mockResolvedValue(booking);
    await render(<HomeScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Sara Ahmed")).toBeTruthy());
    expect(screen.getByText("Cardiology")).toBeTruthy();
    expect(screen.getByText("Confirmed")).toBeTruthy();
    expect(screen.getByText("Join call")).toBeTruthy();
  });

  it("hides the join button when the booking isn't joinable yet", async () => {
    mockGetOnlineBooking.mockResolvedValue({ ...booking, status: "pending" });
    await render(<HomeScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Sara Ahmed")).toBeTruthy());
    expect(screen.queryByText("Join call")).toBeNull();
    expect(screen.getByText("Payment pending")).toBeTruthy();
  });

  it("opens the video join URL when Join call succeeds", async () => {
    mockGetOnlineBooking.mockResolvedValue(booking);
    mockJoinVideoSession.mockResolvedValue({ joinUrl: "https://call.example.com/room" });
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(true as never);
    await render(<HomeScreen />);
    await waitFor(() => expect(screen.getByText("Join call")).toBeTruthy());

    await fireEvent.press(screen.getByText("Join call"));

    await waitFor(() => {
      expect(mockJoinVideoSession).toHaveBeenCalledWith("appt-1");
      expect(openURLSpy).toHaveBeenCalledWith("https://call.example.com/room");
    });
  });

  it("shows an alert with the server message when joining fails", async () => {
    mockGetOnlineBooking.mockResolvedValue(booking);
    mockJoinVideoSession.mockRejectedValue(new ApiRequestError("Too early to join", "TOO_EARLY", 400));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<HomeScreen />);
    await waitFor(() => expect(screen.getByText("Join call")).toBeTruthy());

    await fireEvent.press(screen.getByText("Join call"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Can't join yet", "Too early to join");
    });
  });

  it("shows a generic alert message when joining fails with a non-API error", async () => {
    mockGetOnlineBooking.mockResolvedValue(booking);
    mockJoinVideoSession.mockRejectedValue(new Error("boom"));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<HomeScreen />);
    await waitFor(() => expect(screen.getByText("Join call")).toBeTruthy());

    await fireEvent.press(screen.getByText("Join call"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Can't join yet", "Please try again closer to your appointment time.");
    });
  });

  it("renders the next home visit with formatted date and status", async () => {
    mockListMyHomeVisits.mockResolvedValue([homeVisit]);
    await render(<HomeScreen />);
    await waitFor(() => expect(screen.getByText("nurse")).toBeTruthy());
    expect(screen.getByText("Assigned")).toBeTruthy();
    expect(screen.getByText("123 Main St")).toBeTruthy();
    expect(screen.getByText(formatKarachi(homeVisit.scheduledAt))).toBeTruthy();
  });

  it("only shows recent prescriptions when there are any, capped at two", async () => {
    mockListPrescriptions.mockResolvedValue([rx, { ...rx, id: "rx-2" }, { ...rx, id: "rx-3" }]);
    await render(<HomeScreen />);
    await waitFor(() => expect(screen.getByText("Recent prescriptions")).toBeTruthy());
    expect(screen.getAllByText("Dr. Sara Ahmed").length).toBeGreaterThanOrEqual(2);
  });

  it("hides the recent prescriptions section when there are none", async () => {
    await render(<HomeScreen />);
    await waitFor(() => expect(screen.getByText("No upcoming consultation")).toBeTruthy());
    expect(screen.queryByText("Recent prescriptions")).toBeNull();
  });

  it("navigates to doctor booking from the quick action and empty-state action", async () => {
    await render(<HomeScreen />);
    await fireEvent.press(screen.getByText("Book\nconsult"));
    expect(router.push).toHaveBeenCalledWith("/(tabs)/doctors");

    await waitFor(() => expect(screen.getByText("Find a doctor")).toBeTruthy());
    await fireEvent.press(screen.getByText("Find a doctor"));
    expect(router.push).toHaveBeenCalledWith("/(tabs)/doctors");
  });
});

describe("HomeScreen accessibility", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: makeAuthUser({ name: "Test Patient" }) }));
    mockGetOnlineBooking.mockResolvedValue(null);
    mockListMyHomeVisits.mockResolvedValue([]);
    mockListPrescriptions.mockResolvedValue([]);
  });

  it("exposes a quick-action tile's accessible name without the raw line break used for the visual label", async () => {
    await render(<HomeScreen />);
    expect(screen.getByRole("button", { name: "Book consult" })).toBeTruthy();
  });

  it("exposes the empty-state action as an accessible button", async () => {
    await render(<HomeScreen />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Find a doctor" })).toBeTruthy());
  });
});
