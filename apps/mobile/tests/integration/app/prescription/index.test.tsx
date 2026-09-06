import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import PrescriptionsScreen from "@app/prescription/index";
import { listPrescriptions } from "@/api/prescriptions";
import { ApiRequestError } from "@/api/client";
import { router } from "expo-router";
import { formatKarachi } from "@/lib/format-date";
import { useAuth } from "@/lib/auth-context";
import { makeAuthUser, makeMockAuth } from "@/test-utils/mock-auth";

jest.mock("@/api/prescriptions");
jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));

const mockList = listPrescriptions as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

const rx = {
  id: "rx-1",
  doctorName: "Dr. Sara Ahmed",
  patientName: "Test Patient",
  issuedAt: "2026-01-01T00:00:00.000Z",
  medicationCount: 1,
  downloadUrl: "/rx-1.pdf",
};

describe("PrescriptionsScreen", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: makeAuthUser() }));
    mockList.mockResolvedValue([rx]);
  });

  it("redirects to login instead of rendering prescriptions when there is no authenticated user", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: null, isLoading: false }));
    const result = await render(<PrescriptionsScreen />);
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
    expect(result.toJSON()).toBeNull();
  });

  it("does not redirect while auth is still resolving", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: null, isLoading: true }));
    await render(<PrescriptionsScreen />);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("renders a prescription card with doctor, date, and singular medicine count", async () => {
    await render(<PrescriptionsScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Sara Ahmed")).toBeTruthy());
    expect(screen.getByText(formatKarachi(rx.issuedAt))).toBeTruthy();
    expect(screen.getByText("1 medicine")).toBeTruthy();
  });

  it("pluralizes the medicine count when more than one", async () => {
    mockList.mockResolvedValue([{ ...rx, medicationCount: 3 }]);
    await render(<PrescriptionsScreen />);
    expect(await screen.findByText("3 medicines")).toBeTruthy();
  });

  it("shows the empty state when there are no prescriptions", async () => {
    mockList.mockResolvedValue([]);
    await render(<PrescriptionsScreen />);
    expect(await screen.findByText("No prescriptions yet.")).toBeTruthy();
  });

  it("shows an error message when loading fails", async () => {
    mockList.mockRejectedValue(new ApiRequestError("Not authorized", "AUTH", 401));
    await render(<PrescriptionsScreen />);
    expect(await screen.findByText("Not authorized")).toBeTruthy();
  });

  it("navigates to the prescription detail when pressed", async () => {
    await render(<PrescriptionsScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Sara Ahmed")).toBeTruthy());
    await fireEvent.press(screen.getByText("Dr. Sara Ahmed"));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/prescription/[id]", params: { id: "rx-1" } });
  });

  it("does not let a slow refresh response overwrite a faster, second refresh response", async () => {
    await render(<PrescriptionsScreen />);
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
      resolveB!([{ ...rx, id: "rx-new", doctorName: "Dr. New" }]); // B (newer) resolves first
    });
    expect(await screen.findByText("Dr. New")).toBeTruthy();

    await act(async () => {
      resolveA!([{ ...rx, id: "rx-old", doctorName: "Dr. Old" }]); // A (older) resolves late
    });

    expect(await screen.findByText("Dr. New")).toBeTruthy();
    expect(screen.queryByText("Dr. Old")).toBeNull();
  });

  it("shows an error message (without losing existing data) when a refresh fails after a successful load", async () => {
    await render(<PrescriptionsScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Sara Ahmed")).toBeTruthy());

    mockList.mockRejectedValueOnce(new ApiRequestError("Network error", "NETWORK", 0));
    await act(async () => {
      screen.getByTestId("prescriptions-list").props.refreshControl.props.onRefresh();
    });

    expect(await screen.findByText("Network error")).toBeTruthy();
    expect(screen.getByText("Dr. Sara Ahmed")).toBeTruthy();
  });

  it("does not get stuck in a permanent loading state when the API returns a malformed (null) success payload", async () => {
    mockList.mockResolvedValue(null);
    await render(<PrescriptionsScreen />);
    expect(await screen.findByText("No prescriptions yet.")).toBeTruthy();
  });
});
