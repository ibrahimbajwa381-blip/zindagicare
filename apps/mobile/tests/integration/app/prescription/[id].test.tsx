import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import PrescriptionDetailScreen from "@app/prescription/[id]";
import { getPrescriptionDetail } from "@/api/prescriptions";
import { ApiRequestError } from "@/api/client";
import { downloadAndOpenFile } from "@/lib/download-file";
import { useLocalSearchParams, router } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { makeAuthUser, makeMockAuth } from "@/test-utils/mock-auth";

jest.mock("@/api/prescriptions");
jest.mock("@/lib/download-file");
jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));

const mockGetDetail = getPrescriptionDetail as jest.Mock;
const mockDownload = downloadAndOpenFile as jest.Mock;
const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

const detail = {
  id: "rx-1",
  doctorName: "Dr. Sara Ahmed",
  patientName: "Test Patient",
  issuedAt: "2026-01-01T00:00:00.000Z",
  medicationCount: 2,
  downloadUrl: "/rx-1.pdf",
  medications: [
    { name: "Amoxicillin", dosage: "500mg", frequency: "3x daily", duration: "7 days" },
    { name: "Paracetamol", dosage: "500mg", frequency: "as needed", duration: "5 days" },
  ],
  notes: "Take with food.",
};

describe("PrescriptionDetailScreen", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: makeAuthUser() }));
    mockUseLocalSearchParams.mockReturnValue({ id: "rx-1" });
    mockGetDetail.mockResolvedValue(detail);
  });

  it("redirects to login instead of rendering the prescription when there is no authenticated user", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: null, isLoading: false }));
    const result = await render(<PrescriptionDetailScreen />);
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
    expect(result.toJSON()).toBeNull();
  });

  it("does not redirect while auth is still resolving", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: null, isLoading: true }));
    await render(<PrescriptionDetailScreen />);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("loads the prescription using the id route param and renders medications", async () => {
    await render(<PrescriptionDetailScreen />);
    await waitFor(() => expect(mockGetDetail).toHaveBeenCalledWith("rx-1"));
    expect(screen.getByText("Dr. Sara Ahmed")).toBeTruthy();
    expect(screen.getByText("Amoxicillin")).toBeTruthy();
    expect(screen.getByText("500mg · 3x daily · 7 days")).toBeTruthy();
    expect(screen.getByText("Paracetamol")).toBeTruthy();
    expect(screen.getByText("Take with food.")).toBeTruthy();
  });

  it("hides the notes card when there are none", async () => {
    mockGetDetail.mockResolvedValue({ ...detail, notes: undefined });
    await render(<PrescriptionDetailScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Sara Ahmed")).toBeTruthy());
    expect(screen.queryByText("Notes")).toBeNull();
  });

  it("shows an error message when loading fails", async () => {
    mockGetDetail.mockRejectedValue(new ApiRequestError("Prescription not found", "NOT_FOUND", 404));
    await render(<PrescriptionDetailScreen />);
    expect(await screen.findByText("Prescription not found")).toBeTruthy();
  });

  it("downloads and opens the prescription PDF", async () => {
    mockDownload.mockResolvedValue("file://rx-1.pdf");
    await render(<PrescriptionDetailScreen />);
    await waitFor(() => expect(screen.getByText("Download / Share PDF")).toBeTruthy());

    await fireEvent.press(screen.getByText("Download / Share PDF"));

    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalledWith("/rx-1.pdf", "Dr.-Sara-Ahmed-prescription.pdf");
    });
  });

  it("alerts when the download fails", async () => {
    mockDownload.mockRejectedValue(new Error("Disk full"));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<PrescriptionDetailScreen />);
    await waitFor(() => expect(screen.getByText("Download / Share PDF")).toBeTruthy());

    await fireEvent.press(screen.getByText("Download / Share PDF"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Couldn't open prescription", "Disk full");
    });
  });
});
