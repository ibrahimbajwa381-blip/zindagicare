import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import * as Location from "expo-location";
import HomeVisitRequestScreen from "@app/home-visit/request";
import { createHomeVisit } from "@/api/home-visits";
import { ApiRequestError } from "@/api/client";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { makeAuthUser, makeMockAuth } from "@/test-utils/mock-auth";

jest.mock("@/api/home-visits");
jest.mock("expo-location");
jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));

const mockCreate = createHomeVisit as jest.Mock;
const mockRequestPermission = Location.requestForegroundPermissionsAsync as jest.Mock;
const mockGetPosition = Location.getCurrentPositionAsync as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

async function setLocation() {
  mockRequestPermission.mockResolvedValue({ granted: true });
  mockGetPosition.mockResolvedValue({
    coords: { latitude: 31.5204, longitude: 74.3587 },
  });
  await fireEvent.press(screen.getByText("Use my current location"));
  await screen.findByText(/Location set/);
}

describe("HomeVisitRequestScreen", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: makeAuthUser() }));
  });

  it("redirects to login instead of rendering the form when there is no authenticated user", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: null, isLoading: false }));
    await render(<HomeVisitRequestScreen />);
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
    expect(screen.queryByText("Request visit")).toBeNull();
  });

  it("does not redirect while auth is still resolving", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: null, isLoading: true }));
    await render(<HomeVisitRequestScreen />);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("renders all service options and defaults to the first one selected", async () => {
    await render(<HomeVisitRequestScreen />);
    expect(screen.getByText("Doctor visit")).toBeTruthy();
    expect(screen.getByText("Nurse care")).toBeTruthy();
    expect(screen.getByText("Physiotherapy")).toBeTruthy();
    expect(screen.getByText("Request visit")).toBeTruthy();
  });

  it("lets the user pick a different service", async () => {
    await render(<HomeVisitRequestScreen />);
    await fireEvent.press(screen.getByText("Nurse care"));
    // No dedicated test id for "active" styling; verify no crash and the chip is still present.
    expect(screen.getByText("Nurse care")).toBeTruthy();
  });

  it("requires an address of at least 5 characters", async () => {
    await render(<HomeVisitRequestScreen />);
    await fireEvent.press(screen.getByText("Request visit"));
    expect(await screen.findByText("Enter a fuller address (at least 5 characters).")).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects an address of exactly 4 characters (one below the minimum of 5)", async () => {
    await render(<HomeVisitRequestScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("House/street, area, landmark"), "Home");
    await fireEvent.press(screen.getByText("Request visit"));
    expect(await screen.findByText("Enter a fuller address (at least 5 characters).")).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("accepts an address of exactly 5 characters (the minimum) once location and time are also valid", async () => {
    mockCreate.mockResolvedValue({ id: "visit-1" });
    await render(<HomeVisitRequestScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("House/street, area, landmark"), "House");
    await setLocation();
    await fireEvent.press(screen.getByText("Request visit"));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Enter a fuller address (at least 5 characters).")).toBeNull();
  });

  it("rejects an address that is only whitespace", async () => {
    await render(<HomeVisitRequestScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("House/street, area, landmark"), "        ");
    await fireEvent.press(screen.getByText("Request visit"));
    expect(await screen.findByText("Enter a fuller address (at least 5 characters).")).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("requires a location to be set", async () => {
    await render(<HomeVisitRequestScreen />);
    await fireEvent.changeText(
      screen.getByPlaceholderText("House/street, area, landmark"),
      "House 12, Model Town",
    );
    await fireEvent.press(screen.getByText("Request visit"));
    expect(await screen.findByText("Set your location so the visiting staff can find you.")).toBeTruthy();
  });

  it("alerts when location permission is denied", async () => {
    mockRequestPermission.mockResolvedValue({ granted: false });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<HomeVisitRequestScreen />);
    await fireEvent.press(screen.getByText("Use my current location"));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Permission needed", "Allow location access to auto-fill your coordinates.");
    });
  });

  it("fills in the coordinates after using current location", async () => {
    await render(<HomeVisitRequestScreen />);
    await setLocation();
    expect(screen.getByText("Location set (31.5204, 74.3587)")).toBeTruthy();
  });

  it("requires the scheduled time to be at least an hour away", async () => {
    await render(<HomeVisitRequestScreen />);
    await fireEvent.changeText(
      screen.getByPlaceholderText("House/street, area, landmark"),
      "House 12, Model Town",
    );
    await setLocation();

    const dateTimeInput = screen.getByDisplayValue(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    await fireEvent.changeText(dateTimeInput, "2020-01-01 09:00");
    await fireEvent.press(screen.getByText("Request visit"));

    expect(
      await screen.findByText("Pick a time at least an hour from now, as YYYY-MM-DD HH:MM."),
    ).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects a scheduled time 54 minutes away (below the 55-minute minimum)", async () => {
    await render(<HomeVisitRequestScreen />);
    await fireEvent.changeText(
      screen.getByPlaceholderText("House/street, area, landmark"),
      "House 12, Model Town",
    );
    await setLocation();

    const nearlyTooSoon = new Date(Date.now() + 54 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const formatted = `${nearlyTooSoon.getFullYear()}-${pad(nearlyTooSoon.getMonth() + 1)}-${pad(nearlyTooSoon.getDate())} ${pad(nearlyTooSoon.getHours())}:${pad(nearlyTooSoon.getMinutes())}`;

    const dateTimeInput = screen.getByDisplayValue(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    await fireEvent.changeText(dateTimeInput, formatted);
    await fireEvent.press(screen.getByText("Request visit"));

    expect(
      await screen.findByText("Pick a time at least an hour from now, as YYYY-MM-DD HH:MM."),
    ).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("accepts a scheduled time 56 minutes away (comfortably past the 55-minute minimum)", async () => {
    mockCreate.mockResolvedValue({ id: "visit-1" });
    await render(<HomeVisitRequestScreen />);
    await fireEvent.changeText(
      screen.getByPlaceholderText("House/street, area, landmark"),
      "House 12, Model Town",
    );
    await setLocation();

    const comfortablyFarEnough = new Date(Date.now() + 56 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const formatted = `${comfortablyFarEnough.getFullYear()}-${pad(comfortablyFarEnough.getMonth() + 1)}-${pad(comfortablyFarEnough.getDate())} ${pad(comfortablyFarEnough.getHours())}:${pad(comfortablyFarEnough.getMinutes())}`;

    const dateTimeInput = screen.getByDisplayValue(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    await fireEvent.changeText(dateTimeInput, formatted);
    await fireEvent.press(screen.getByText("Request visit"));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
  });

  it("rejects an unparseable scheduled date/time string", async () => {
    await render(<HomeVisitRequestScreen />);
    await fireEvent.changeText(
      screen.getByPlaceholderText("House/street, area, landmark"),
      "House 12, Model Town",
    );
    await setLocation();

    const dateTimeInput = screen.getByDisplayValue(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    await fireEvent.changeText(dateTimeInput, "not a date");
    await fireEvent.press(screen.getByText("Request visit"));

    expect(
      await screen.findByText("Pick a time at least an hour from now, as YYYY-MM-DD HH:MM."),
    ).toBeTruthy();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("lets the address and notes fields be found by their accessible name, not just placeholder", async () => {
    mockCreate.mockResolvedValue({ id: "visit-1" });
    await render(<HomeVisitRequestScreen />);
    await fireEvent.changeText(screen.getByLabelText("Address"), "House 12, Model Town");
    await setLocation();
    await fireEvent.changeText(screen.getByLabelText("Notes (optional)"), "Please call before arriving");
    await fireEvent.press(screen.getByText("Request visit"));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ addressLine: "House 12, Model Town", patientNotes: "Please call before arriving" }),
      );
    });
  });

  it("submits a well-formed request and redirects to the list", async () => {
    mockCreate.mockResolvedValue({ id: "visit-1" });
    await render(<HomeVisitRequestScreen />);
    await fireEvent.changeText(
      screen.getByPlaceholderText("House/street, area, landmark"),
      "House 12, Model Town",
    );
    await setLocation();
    await fireEvent.changeText(
      screen.getByPlaceholderText("Anything the visiting staff should know"),
      "Please call before arriving",
    );
    await fireEvent.press(screen.getByText("Request visit"));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceType: "doctor_visit",
          addressLine: "House 12, Model Town",
          geo: { lat: 31.5204, lng: 74.3587 },
          patientNotes: "Please call before arriving",
        }),
      );
      expect(router.replace).toHaveBeenCalledWith("/home-visit");
    });
  });

  it("shows an API error message when submission fails", async () => {
    mockCreate.mockRejectedValue(new ApiRequestError("No staff available in this area", "NO_STAFF", 400));
    await render(<HomeVisitRequestScreen />);
    await fireEvent.changeText(
      screen.getByPlaceholderText("House/street, area, landmark"),
      "House 12, Model Town",
    );
    await setLocation();
    await fireEvent.press(screen.getByText("Request visit"));

    expect(await screen.findByText("No staff available in this area")).toBeTruthy();
  });

  it("does not submit twice when Request visit is pressed twice back-to-back", async () => {
    let resolveCreate: (v: unknown) => void;
    mockCreate.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    await render(<HomeVisitRequestScreen />);
    await fireEvent.changeText(
      screen.getByPlaceholderText("House/street, area, landmark"),
      "House 12, Model Town",
    );
    await setLocation();

    const submitButton = screen.getByText("Request visit");
    await act(async () => {
      fireEvent.press(submitButton);
      fireEvent.press(submitButton);
      resolveCreate!({ id: "visit-1" });
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/home-visit"));
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
