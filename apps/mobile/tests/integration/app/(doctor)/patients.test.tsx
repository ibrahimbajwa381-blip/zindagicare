import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react-native";
import DoctorPatientsScreen from "@app/(doctor)/patients";
import { listDoctorPatients } from "@/api/doctor";
import { ApiRequestError } from "@/api/client";

jest.mock("@/api/doctor");

const mockList = listDoctorPatients as jest.Mock;

const patient = {
  id: "p-1",
  name: "Ayesha Khan",
  phone: "03001234567",
  lastVisitAt: "2026-01-15T10:00:00.000Z",
  lastOutcome: "completed" as const,
  appointmentCount: 3,
  completedCount: 2,
  missedCount: 0,
  cancelledCount: 1,
  upcomingCount: 0,
  prescriptionCount: 2,
};

describe("DoctorPatientsScreen", () => {
  beforeEach(() => {
    mockList.mockResolvedValue([patient]);
  });

  it("renders a patient card with phone, last visit, and visit stats", async () => {
    await render(<DoctorPatientsScreen />);
    await waitFor(() => expect(screen.getByText("Ayesha Khan")).toBeTruthy());
    expect(screen.getByText("03001234567")).toBeTruthy();
    expect(screen.getByText("3 visits")).toBeTruthy();
    expect(screen.getByText("2 completed")).toBeTruthy();
    expect(screen.getByText("2 prescriptions")).toBeTruthy();
    expect(screen.getByText("completed")).toBeTruthy();
  });

  it("shows a review with a comment when present", async () => {
    mockList.mockResolvedValue([{ ...patient, review: { rating: 5, comment: "Very helpful", createdAt: "2026-01-16" } }]);
    await render(<DoctorPatientsScreen />);
    expect(await screen.findByText("Very helpful")).toBeTruthy();
  });

  it("shows the empty state when there are no patients", async () => {
    mockList.mockResolvedValue([]);
    await render(<DoctorPatientsScreen />);
    expect(await screen.findByText("No patients yet.")).toBeTruthy();
  });

  it("shows an error message when loading fails", async () => {
    mockList.mockRejectedValue(new ApiRequestError("Not authorized", "AUTH", 401));
    await render(<DoctorPatientsScreen />);
    expect(await screen.findByText("Not authorized")).toBeTruthy();
  });

  it("does not let a slow refresh response overwrite a faster, second refresh response", async () => {
    await render(<DoctorPatientsScreen />);
    await waitFor(() => expect(screen.getByTestId("patients-list")).toBeTruthy());

    let resolveA: (v: unknown) => void;
    let resolveB: (v: unknown) => void;
    const requestA = new Promise((resolve) => {
      resolveA = resolve;
    });
    const requestB = new Promise((resolve) => {
      resolveB = resolve;
    });
    mockList.mockImplementationOnce(() => requestA).mockImplementationOnce(() => requestB);

    const doRefresh = () => screen.getByTestId("patients-list").props.refreshControl.props.onRefresh();
    doRefresh(); // call A, pending
    doRefresh(); // call B (rapid second pull), pending

    await act(async () => {
      resolveB!([{ ...patient, id: "p-new", name: "New Patient" }]); // B (newer) resolves first
    });
    expect(await screen.findByText("New Patient")).toBeTruthy();

    await act(async () => {
      resolveA!([{ ...patient, id: "p-old", name: "Old Patient" }]); // A (older) resolves late
    });

    expect(await screen.findByText("New Patient")).toBeTruthy();
    expect(screen.queryByText("Old Patient")).toBeNull();
  });

  it("shows an error message (without losing existing data) when a refresh fails after a successful load", async () => {
    await render(<DoctorPatientsScreen />);
    await waitFor(() => expect(screen.getByText("Ayesha Khan")).toBeTruthy());

    mockList.mockRejectedValueOnce(new ApiRequestError("Network error", "NETWORK", 0));
    await act(async () => {
      screen.getByTestId("patients-list").props.refreshControl.props.onRefresh();
    });

    expect(await screen.findByText("Network error")).toBeTruthy();
    expect(screen.getByText("Ayesha Khan")).toBeTruthy();
  });

  it("does not get stuck in a permanent loading state when the API returns a malformed (null) success payload", async () => {
    mockList.mockResolvedValue(null);
    await render(<DoctorPatientsScreen />);
    expect(await screen.findByText("No patients yet.")).toBeTruthy();
  });
});
