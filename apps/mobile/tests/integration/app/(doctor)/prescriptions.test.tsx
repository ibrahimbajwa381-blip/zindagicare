import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import DoctorPrescriptionsScreen from "@app/(doctor)/prescriptions";
import { listDoctorPrescriptions } from "@/api/doctor";
import { ApiRequestError } from "@/api/client";
import { downloadAndOpenFile } from "@/lib/download-file";

jest.mock("@/api/doctor");
jest.mock("@/lib/download-file");

const mockList = listDoctorPrescriptions as jest.Mock;
const mockDownload = downloadAndOpenFile as jest.Mock;

const rx = {
  id: "rx-1",
  doctorName: "Dr. Bilal Chaudhry",
  patientName: "Ayesha Khan",
  issuedAt: "2026-01-01T00:00:00.000Z",
  medicationCount: 1,
  downloadUrl: "/rx-1.pdf",
};

describe("DoctorPrescriptionsScreen", () => {
  beforeEach(() => {
    mockList.mockResolvedValue([rx]);
  });

  it("renders a prescription card with patient, date, and singular medicine count", async () => {
    await render(<DoctorPrescriptionsScreen />);
    await waitFor(() => expect(screen.getByText("Ayesha Khan")).toBeTruthy());
    expect(screen.getByText("1 medicine")).toBeTruthy();
  });

  it("shows the empty state when there are none", async () => {
    mockList.mockResolvedValue([]);
    await render(<DoctorPrescriptionsScreen />);
    expect(await screen.findByText("No prescriptions written yet.")).toBeTruthy();
  });

  it("shows an error message when loading fails", async () => {
    mockList.mockRejectedValue(new ApiRequestError("Not authorized", "AUTH", 401));
    await render(<DoctorPrescriptionsScreen />);
    expect(await screen.findByText("Not authorized")).toBeTruthy();
  });

  it("downloads the prescription when pressed", async () => {
    mockDownload.mockResolvedValue("file://rx-1.pdf");
    await render(<DoctorPrescriptionsScreen />);
    await waitFor(() => expect(screen.getByText("Ayesha Khan")).toBeTruthy());
    await fireEvent.press(screen.getByText("Ayesha Khan"));

    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalledWith("/rx-1.pdf", "Ayesha-Khan-prescription.pdf");
    });
  });

  it("alerts when the download fails", async () => {
    mockDownload.mockRejectedValue(new Error("Disk full"));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorPrescriptionsScreen />);
    await waitFor(() => expect(screen.getByText("Ayesha Khan")).toBeTruthy());
    await fireEvent.press(screen.getByText("Ayesha Khan"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Couldn't open prescription", "Disk full");
    });
  });

  it("does not let a slow refresh response overwrite a faster, second refresh response", async () => {
    await render(<DoctorPrescriptionsScreen />);
    await waitFor(() => expect(screen.getByTestId("prescriptions-list")).toBeTruthy());

    let resolveA: (v: unknown) => void;
    let resolveB: (v: unknown) => void;
    const requestA = new Promise((resolve) => {
      resolveA = resolve;
    });
    const requestB = new Promise((resolve) => {
      resolveB = resolve;
    });
    mockList.mockImplementationOnce(() => requestA).mockImplementationOnce(() => requestB);

    const doRefresh = () => screen.getByTestId("prescriptions-list").props.refreshControl.props.onRefresh();
    doRefresh(); // call A, pending
    doRefresh(); // call B (rapid second pull), pending

    await act(async () => {
      resolveB!([{ ...rx, id: "rx-new", patientName: "New Patient" }]); // B (newer) resolves first
    });
    expect(await screen.findByText("New Patient")).toBeTruthy();

    await act(async () => {
      resolveA!([{ ...rx, id: "rx-old", patientName: "Old Patient" }]); // A (older) resolves late
    });

    expect(await screen.findByText("New Patient")).toBeTruthy();
    expect(screen.queryByText("Old Patient")).toBeNull();
  });

  it("shows an error message (without losing existing data) when a refresh fails after a successful load", async () => {
    await render(<DoctorPrescriptionsScreen />);
    await waitFor(() => expect(screen.getByText("Ayesha Khan")).toBeTruthy());

    mockList.mockRejectedValueOnce(new ApiRequestError("Network error", "NETWORK", 0));
    await act(async () => {
      screen.getByTestId("prescriptions-list").props.refreshControl.props.onRefresh();
    });

    expect(await screen.findByText("Network error")).toBeTruthy();
    expect(screen.getByText("Ayesha Khan")).toBeTruthy();
  });

  it("does not get stuck in a permanent loading state when the API returns a malformed (null) success payload", async () => {
    mockList.mockResolvedValue(null);
    await render(<DoctorPrescriptionsScreen />);
    expect(await screen.findByText("No prescriptions written yet.")).toBeTruthy();
  });
});
