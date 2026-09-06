import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import DoctorUrgentCallsScreen from "@app/(doctor)/urgent-calls";
import { listDoctorUrgentCalls, completeDoctorUrgentCall } from "@/api/doctor";
import { ApiRequestError } from "@/api/client";

jest.mock("@/api/doctor");

const mockList = listDoctorUrgentCalls as jest.Mock;
const mockComplete = completeDoctorUrgentCall as jest.Mock;

const call = {
  requestId: "req-1",
  patientId: "p-1",
  patientName: "Ayesha Khan",
  patientPhone: "03001234567",
  patientNotes: "Chest pain",
  status: "assigned",
  createdAt: "2026-01-01T00:00:00.000Z",
  scheduledStart: "2026-01-01T10:05:00.000Z",
  feePkr: 3000,
};

describe("DoctorUrgentCallsScreen", () => {
  beforeEach(() => {
    mockList.mockResolvedValue([call]);
  });

  it("renders a call card with patient, phone, fee, and notes", async () => {
    await render(<DoctorUrgentCallsScreen />);
    await waitFor(() => expect(screen.getByText("Ayesha Khan")).toBeTruthy());
    expect(screen.getByText("03001234567")).toBeTruthy();
    expect(screen.getByText("Rs. 3,000")).toBeTruthy();
    expect(screen.getByText("“Chest pain”")).toBeTruthy();
    expect(screen.getByText("Join on website")).toBeTruthy();
  });

  it("shows the empty state when there are no urgent calls", async () => {
    mockList.mockResolvedValue([]);
    await render(<DoctorUrgentCallsScreen />);
    expect(await screen.findByText("No urgent calls assigned right now.")).toBeTruthy();
  });

  it("shows an error message when loading fails", async () => {
    mockList.mockRejectedValue(new ApiRequestError("Not authorized", "AUTH", 401));
    await render(<DoctorUrgentCallsScreen />);
    expect(await screen.findByText("Not authorized")).toBeTruthy();
  });

  it("marks a call completed after confirming", async () => {
    mockComplete.mockResolvedValue({ status: "completed" });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorUrgentCallsScreen />);
    await waitFor(() => expect(screen.getByText("Mark completed")).toBeTruthy());

    await fireEvent.press(screen.getByText("Mark completed"));
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === "Mark completed")?.onPress?.());

    await waitFor(() => {
      expect(mockComplete).toHaveBeenCalledWith("req-1");
      expect(mockList).toHaveBeenCalledTimes(2);
    });
  });

  it("alerts when marking complete fails", async () => {
    mockComplete.mockRejectedValue(new ApiRequestError("Already completed", "DONE", 400));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorUrgentCallsScreen />);
    await waitFor(() => expect(screen.getByText("Mark completed")).toBeTruthy());

    await fireEvent.press(screen.getByText("Mark completed"));
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === "Mark completed")?.onPress?.());

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Couldn't update", "Already completed");
    });
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

      await render(<DoctorUrgentCallsScreen />); // fires the initial focus load (call A), pending

      await act(async () => {
        jest.advanceTimersByTime(15000); // POLL_MS — fires the poll tick (call B), pending
      });

      await act(async () => {
        resolveB!([{ ...call, requestId: "req-new", patientName: "New Patient" }]); // B (newer) resolves first
      });
      expect(await screen.findByText("New Patient")).toBeTruthy();

      await act(async () => {
        resolveA!([{ ...call, requestId: "req-old", patientName: "Old Patient" }]); // A (older) resolves late
      });

      expect(await screen.findByText("New Patient")).toBeTruthy();
      expect(screen.queryByText("Old Patient")).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it("shows an error message (without losing existing data) when a refresh fails after a successful load", async () => {
    await render(<DoctorUrgentCallsScreen />);
    await waitFor(() => expect(screen.getByText("Ayesha Khan")).toBeTruthy());

    mockList.mockRejectedValueOnce(new ApiRequestError("Network error", "NETWORK", 0));
    await act(async () => {
      screen.getByTestId("urgent-calls-list").props.refreshControl.props.onRefresh();
    });

    expect(await screen.findByText("Network error")).toBeTruthy();
    expect(screen.getByText("Ayesha Khan")).toBeTruthy();
  });

  it("does not get stuck in a permanent loading state when the API returns a malformed (null) success payload", async () => {
    mockList.mockResolvedValue(null);
    await render(<DoctorUrgentCallsScreen />);
    expect(await screen.findByText("No urgent calls assigned right now.")).toBeTruthy();
  });
});
