import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import DoctorRequestsScreen from "@app/(doctor)/requests";
import { listDoctorRequests } from "@/api/doctor";
import { ApiRequestError } from "@/api/client";
import { router } from "expo-router";

jest.mock("@/api/doctor");

const mockList = listDoctorRequests as jest.Mock;

function makeRequest(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "req-1",
    type: "online",
    status: "confirmed",
    outcome: "upcoming" as const,
    scheduledStart: "2026-03-02T10:00:00.000Z",
    scheduledEnd: "2026-03-02T10:30:00.000Z",
    consultationFee: 2000,
    patient: { id: "p-1", name: "Ayesha Khan", phone: "03001234567" },
    canJoin: true,
    hasPrescription: false,
    ...overrides,
  };
}

describe("DoctorRequestsScreen", () => {
  beforeEach(() => {
    mockList.mockResolvedValue([makeRequest()]);
  });

  it("renders a request card with patient, type, time, phone, and fee", async () => {
    await render(<DoctorRequestsScreen />);
    await waitFor(() => expect(screen.getByText("Ayesha Khan")).toBeTruthy());
    expect(screen.getByText("Video consult")).toBeTruthy();
    expect(screen.getByText("03001234567")).toBeTruthy();
    expect(screen.getByText("Rs. 2,000")).toBeTruthy();
    expect(screen.getByText("Upcoming")).toBeTruthy();
    expect(screen.getByText("Join on website")).toBeTruthy();
  });

  it("shows an error message when loading fails", async () => {
    mockList.mockRejectedValue(new ApiRequestError("Not authorized", "AUTH", 401));
    await render(<DoctorRequestsScreen />);
    expect(await screen.findByText("Not authorized")).toBeTruthy();
  });

  it("defaults to the active filter and shows an empty state per-filter", async () => {
    mockList.mockResolvedValue([makeRequest({ outcome: "completed" })]);
    await render(<DoctorRequestsScreen />);
    expect(await screen.findByText("No active consult requests.")).toBeTruthy();
  });

  it("does not get stuck in a permanent loading state when the API returns a malformed (null) success payload", async () => {
    mockList.mockResolvedValue(null);
    await render(<DoctorRequestsScreen />);
    expect(await screen.findByText("No active consult requests.")).toBeTruthy();
  });

  it("filters requests when a different filter chip is pressed", async () => {
    mockList.mockResolvedValue([makeRequest({ outcome: "completed" })]);
    await render(<DoctorRequestsScreen />);
    await waitFor(() => expect(screen.getByText("No active consult requests.")).toBeTruthy());

    await fireEvent.press(screen.getByText("Completed"));
    expect(await screen.findByText("Ayesha Khan")).toBeTruthy();
  });

  it("shows the patient's quoted notes when present", async () => {
    mockList.mockResolvedValue([makeRequest({ patientNotes: "Severe headache" })]);
    await render(<DoctorRequestsScreen />);
    expect(await screen.findByText("“Severe headache”")).toBeTruthy();
  });

  it("shows a 'Prescribed' tag when a prescription already exists", async () => {
    mockList.mockResolvedValue([makeRequest({ hasPrescription: true })]);
    await render(<DoctorRequestsScreen />);
    expect(await screen.findByText("Prescribed")).toBeTruthy();
    expect(screen.queryByText("Write prescription")).toBeNull();
  });

  it("shows a review with stars and comment when present", async () => {
    mockList.mockResolvedValue([
      makeRequest({ outcome: "completed", review: { rating: 4, comment: "Great doctor" } }),
    ]);
    await render(<DoctorRequestsScreen />);
    await fireEvent.press(screen.getByText("Completed"));
    expect(await screen.findByText("Great doctor")).toBeTruthy();
  });

  it("hides the Intake action for urgent online consults", async () => {
    mockList.mockResolvedValue([makeRequest({ type: "urgent_online" })]);
    await render(<DoctorRequestsScreen />);
    await waitFor(() => expect(screen.getByText("Ayesha Khan")).toBeTruthy());
    expect(screen.queryByText("Intake")).toBeNull();
  });

  it("navigates to the intake screen with the appointment id", async () => {
    await render(<DoctorRequestsScreen />);
    await waitFor(() => expect(screen.getByText("Ayesha Khan")).toBeTruthy());
    await fireEvent.press(screen.getByText("Intake"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(doctor)/intake",
      params: { appointmentId: "req-1" },
    });
  });

  it("navigates to write a prescription when eligible", async () => {
    await render(<DoctorRequestsScreen />);
    await waitFor(() => expect(screen.getByText("Write prescription")).toBeTruthy());
    await fireEvent.press(screen.getByText("Write prescription"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(doctor)/prescription-new",
      params: { appointmentId: "req-1" },
    });
  });

  it("does not offer to write a prescription for a cancelled/missed request", async () => {
    mockList.mockResolvedValue([makeRequest({ outcome: "cancelled" })]);
    await render(<DoctorRequestsScreen />);
    await fireEvent.press(screen.getByText("Cancelled"));
    await waitFor(() => expect(screen.getByText("Ayesha Khan")).toBeTruthy());
    expect(screen.queryByText("Write prescription")).toBeNull();
  });

  it("does not let a slow initial-focus response overwrite a faster, later poll response", async () => {
    jest.useFakeTimers();
    try {
      let resolveA: (v: unknown) => void;
      let resolveB: (v: unknown) => void;
      const requestA = new Promise((resolve) => {
        resolveA = resolve;
      });
      const requestB = new Promise((resolve) => {
        resolveB = resolve;
      });
      mockList.mockImplementationOnce(() => requestA).mockImplementationOnce(() => requestB);

      await render(<DoctorRequestsScreen />); // fires the initial focus load (call A), pending

      await act(async () => {
        jest.advanceTimersByTime(15000); // POLL_MS — fires the poll tick (call B), pending
      });

      await act(async () => {
        resolveB!([makeRequest({ patient: { id: "p-new", name: "New Patient", phone: "03000000000" } })]); // B (newer) resolves first
      });
      expect(await screen.findByText("New Patient")).toBeTruthy();

      await act(async () => {
        resolveA!([makeRequest({ patient: { id: "p-old", name: "Old Patient", phone: "03011111111" } })]); // A (older) resolves late
      });

      expect(await screen.findByText("New Patient")).toBeTruthy();
      expect(screen.queryByText("Old Patient")).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it("shows an error message (without losing existing data) when a refresh fails after a successful load", async () => {
    await render(<DoctorRequestsScreen />);
    await waitFor(() => expect(screen.getByText("Ayesha Khan")).toBeTruthy());

    mockList.mockRejectedValueOnce(new ApiRequestError("Network error", "NETWORK", 0));
    await act(async () => {
      screen.getByTestId("requests-list").props.refreshControl.props.onRefresh();
    });

    expect(await screen.findByText("Network error")).toBeTruthy();
    expect(screen.getByText("Ayesha Khan")).toBeTruthy();
  });

  it("stops polling after the screen unmounts (no state update on an unmounted screen)", async () => {
    jest.useFakeTimers();
    try {
      let resolveSecondCall: (v: unknown) => void;
      mockList
        .mockResolvedValueOnce([makeRequest()])
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveSecondCall = resolve;
            }),
        );

      const { unmount } = await render(<DoctorRequestsScreen />);
      await waitFor(() => expect(screen.getByText("Ayesha Khan")).toBeTruthy());

      await act(async () => {
        jest.advanceTimersByTime(15000); // POLL_MS — fires the poll tick, second call now pending
      });
      expect(mockList).toHaveBeenCalledTimes(2);

      unmount();
      // The in-flight poll response resolves AFTER the screen is gone.
      await act(async () => {
        resolveSecondCall!([makeRequest({ patient: { id: "p-2", name: "Should Not Render", phone: "0" } })]);
        await Promise.resolve();
        await Promise.resolve();
      });

      // No crash and no further poll ticks after unmount.
      await act(async () => {
        jest.advanceTimersByTime(60000);
      });
      expect(mockList).toHaveBeenCalledTimes(2);
    } finally {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
      await act(async () => {
        await Promise.resolve();
      });
    }
  });
});
