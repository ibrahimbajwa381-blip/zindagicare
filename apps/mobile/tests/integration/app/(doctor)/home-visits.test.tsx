import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import DoctorHomeVisitsScreen from "@app/(doctor)/home-visits";
import { listDoctorHomeVisits, updateDoctorHomeVisitStatus } from "@/api/doctor";
import { ApiRequestError } from "@/api/client";

jest.mock("@/api/doctor");

const mockList = listDoctorHomeVisits as jest.Mock;
const mockUpdateStatus = updateDoctorHomeVisitStatus as jest.Mock;

const visit = {
  id: "visit-1",
  serviceType: "nurse",
  status: "assigned" as const,
  scheduledAt: "2026-02-01T09:00:00.000Z",
  address: { line: "House 12, Model Town", city: "Lahore", geo: { lng: 0, lat: 0 } },
  pricing: { base: 1800, surge: 0, distance: 0, total: 1800, currency: "PKR" },
  patient: { id: "p-1", name: "Ayesha Khan", phone: "03001234567" },
};

describe("DoctorHomeVisitsScreen", () => {
  beforeEach(() => {
    mockList.mockResolvedValue([visit]);
  });

  it("loads the active tab by default", async () => {
    await render(<DoctorHomeVisitsScreen />);
    await waitFor(() => expect(mockList).toHaveBeenCalledWith("assigned"));
    expect(screen.getByText("Ayesha Khan")).toBeTruthy();
    expect(screen.getByText("Assigned")).toBeTruthy();
    expect(screen.getByText("Rs. 1,800")).toBeTruthy();
    expect(screen.getByText("03001234567")).toBeTruthy();
  });

  it("switches to the history tab", async () => {
    await render(<DoctorHomeVisitsScreen />);
    await waitFor(() => expect(mockList).toHaveBeenCalledWith("assigned"));
    await fireEvent.press(screen.getByText("History"));
    await waitFor(() => expect(mockList).toHaveBeenCalledWith("assigned-history"));
  });

  it("shows the empty state per tab", async () => {
    mockList.mockResolvedValue([]);
    await render(<DoctorHomeVisitsScreen />);
    expect(await screen.findByText("No active home visits.")).toBeTruthy();
  });

  it("shows an error message when loading fails", async () => {
    mockList.mockRejectedValue(new ApiRequestError("Not authorized", "AUTH", 401));
    await render(<DoctorHomeVisitsScreen />);
    expect(await screen.findByText("Not authorized")).toBeTruthy();
  });

  it("advances the visit to the next status", async () => {
    mockUpdateStatus.mockResolvedValue({ ...visit, status: "en_route" });
    await render(<DoctorHomeVisitsScreen />);
    await waitFor(() => expect(screen.getByText("Mark on the way")).toBeTruthy());
    await fireEvent.press(screen.getByText("Mark on the way"));

    await waitFor(() => {
      expect(mockUpdateStatus).toHaveBeenCalledWith("visit-1", "en_route");
    });
  });

  it("shows the correct next-status label at each stage", async () => {
    mockList.mockResolvedValue([{ ...visit, status: "en_route" }]);
    await render(<DoctorHomeVisitsScreen />);
    expect(await screen.findByText("Mark arrived")).toBeTruthy();
  });

  it("hides advance/cancel actions once completed", async () => {
    mockList.mockResolvedValue([{ ...visit, status: "completed" }]);
    await render(<DoctorHomeVisitsScreen />);
    await waitFor(() => expect(screen.getByText("Ayesha Khan")).toBeTruthy());
    expect(screen.queryByText("Cancel")).toBeNull();
  });

  it("alerts when advancing fails", async () => {
    mockUpdateStatus.mockRejectedValue(new ApiRequestError("Server error", "ERR", 500));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorHomeVisitsScreen />);
    await waitFor(() => expect(screen.getByText("Mark on the way")).toBeTruthy());
    await fireEvent.press(screen.getByText("Mark on the way"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Couldn't update", "Server error");
    });
  });

  it("cancels a visit after confirming", async () => {
    mockUpdateStatus.mockResolvedValue({ ...visit, status: "cancelled" });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorHomeVisitsScreen />);
    await waitFor(() => expect(screen.getByText("Cancel")).toBeTruthy());
    await fireEvent.press(screen.getByText("Cancel"));

    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === "Cancel visit")?.onPress?.());

    await waitFor(() => {
      expect(mockUpdateStatus).toHaveBeenCalledWith("visit-1", "cancelled");
    });
  });

  it("alerts when cancelling fails", async () => {
    mockUpdateStatus.mockRejectedValue(new ApiRequestError("Too late", "LATE", 400));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorHomeVisitsScreen />);
    await waitFor(() => expect(screen.getByText("Cancel")).toBeTruthy());
    await fireEvent.press(screen.getByText("Cancel"));

    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === "Cancel visit")?.onPress?.());

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Couldn't cancel", "Too late");
    });
  });
});
