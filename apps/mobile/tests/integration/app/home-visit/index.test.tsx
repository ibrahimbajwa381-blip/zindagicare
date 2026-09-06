import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import HomeVisitsScreen from "@app/home-visit/index";
import { listMyHomeVisits, cancelHomeVisit } from "@/api/home-visits";
import { ApiRequestError } from "@/api/client";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { makeAuthUser, makeMockAuth } from "@/test-utils/mock-auth";

jest.mock("@/api/home-visits");
jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));

const mockList = listMyHomeVisits as jest.Mock;
const mockCancel = cancelHomeVisit as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

const visit = {
  id: "visit-1",
  serviceType: "nurse" as const,
  status: "requested" as const,
  address: { line: "House 12, Model Town", city: "Lahore", geo: { lat: 0, lng: 0 } },
  pricing: { base: 1800, surge: 0, distance: 0, total: 1800, currency: "PKR" },
  scheduledAt: "2026-02-01T09:00:00.000Z",
  createdAt: "2026-01-31T00:00:00.000Z",
};

describe("HomeVisitsScreen", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: makeAuthUser() }));
    mockList.mockResolvedValue([visit]);
  });

  it("redirects to login instead of rendering home visits when there is no authenticated user", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: null, isLoading: false }));
    await render(<HomeVisitsScreen />);
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
    expect(screen.queryByText("+ Request a home visit")).toBeNull();
  });

  it("does not redirect while auth is still resolving", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: null, isLoading: true }));
    await render(<HomeVisitsScreen />);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("renders a visit card with service, status, address, and price", async () => {
    await render(<HomeVisitsScreen />);
    await waitFor(() => expect(screen.getByText("Nurse care")).toBeTruthy());
    expect(screen.getByText("Requested")).toBeTruthy();
    expect(screen.getByText("House 12, Model Town")).toBeTruthy();
    expect(screen.getByText("Rs. 1800")).toBeTruthy();
  });

  it("shows the empty state when there are no visits", async () => {
    mockList.mockResolvedValue([]);
    await render(<HomeVisitsScreen />);
    expect(await screen.findByText("No home visit requests yet.")).toBeTruthy();
  });

  it("shows an error message when loading fails", async () => {
    mockList.mockRejectedValue(new ApiRequestError("Not authorized", "AUTH", 401));
    await render(<HomeVisitsScreen />);
    expect(await screen.findByText("Not authorized")).toBeTruthy();
  });

  it("navigates to the request form", async () => {
    await render(<HomeVisitsScreen />);
    await fireEvent.press(screen.getByText("+ Request a home visit"));
    expect(router.push).toHaveBeenCalledWith("/home-visit/request");
  });

  it("only shows the cancel button for requested visits", async () => {
    mockList.mockResolvedValue([{ ...visit, status: "completed" }]);
    await render(<HomeVisitsScreen />);
    await waitFor(() => expect(screen.getByText("Nurse care")).toBeTruthy());
    expect(screen.queryByText("Cancel request")).toBeNull();
  });

  it("cancels a visit after confirming the alert", async () => {
    mockCancel.mockResolvedValue({ ...visit, status: "cancelled" });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<HomeVisitsScreen />);
    await waitFor(() => expect(screen.getByText("Cancel request")).toBeTruthy());

    await fireEvent.press(screen.getByText("Cancel request"));
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === "Cancel visit")?.onPress?.());

    await waitFor(() => {
      expect(mockCancel).toHaveBeenCalledWith("visit-1");
      expect(mockList).toHaveBeenCalledTimes(2);
    });
  });

  it("alerts when cancelling fails", async () => {
    mockCancel.mockRejectedValue(new ApiRequestError("Too late to cancel", "TOO_LATE", 400));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<HomeVisitsScreen />);
    await waitFor(() => expect(screen.getByText("Cancel request")).toBeTruthy());

    await fireEvent.press(screen.getByText("Cancel request"));
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === "Cancel visit")?.onPress?.());

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Couldn't cancel", "Too late to cancel");
    });
  });

  it("does not let a slow refresh response overwrite a faster, second refresh response", async () => {
    await render(<HomeVisitsScreen />);
    await waitFor(() => expect(screen.getByTestId("home-visits-list")).toBeTruthy());

    let resolveA: (v: unknown) => void;
    let resolveB: (v: unknown) => void;
    const requestA = new Promise((resolve) => {
      resolveA = resolve;
    });
    const requestB = new Promise((resolve) => {
      resolveB = resolve;
    });
    mockList.mockImplementationOnce(() => requestA).mockImplementationOnce(() => requestB);

    const doRefresh = () => screen.getByTestId("home-visits-list").props.refreshControl.props.onRefresh();
    doRefresh(); // call A, pending
    doRefresh(); // call B (rapid second pull), pending

    await act(async () => {
      resolveB!([{ ...visit, id: "visit-new", address: { ...visit.address, line: "New Address Line" } }]); // B (newer) resolves first
    });
    expect(await screen.findByText("New Address Line")).toBeTruthy();

    await act(async () => {
      resolveA!([{ ...visit, id: "visit-old", address: { ...visit.address, line: "Old Address Line" } }]); // A (older) resolves late
    });

    expect(await screen.findByText("New Address Line")).toBeTruthy();
    expect(screen.queryByText("Old Address Line")).toBeNull();
  });

  it("shows an error message (without losing existing data) when a refresh fails after a successful load", async () => {
    await render(<HomeVisitsScreen />);
    await waitFor(() => expect(screen.getByTestId("home-visits-list")).toBeTruthy());
    await screen.findByText("House 12, Model Town");

    mockList.mockRejectedValueOnce(new ApiRequestError("Network error", "NETWORK", 0));
    await act(async () => {
      screen.getByTestId("home-visits-list").props.refreshControl.props.onRefresh();
    });

    expect(await screen.findByText("Network error")).toBeTruthy();
    expect(screen.getByText("House 12, Model Town")).toBeTruthy();
  });

  it("does not get stuck in a permanent loading state when the API returns a malformed (null) success payload", async () => {
    mockList.mockResolvedValue(null);
    await render(<HomeVisitsScreen />);
    expect(await screen.findByText("No home visit requests yet.")).toBeTruthy();
  });
});
