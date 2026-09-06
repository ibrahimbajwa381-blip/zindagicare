import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import IntakeFormScreen from "@app/intake/[appointmentId]";
import { getPatientIntake, submitPatientIntakeForm } from "@/api/intake";
import { ApiRequestError } from "@/api/client";
import { useLocalSearchParams, router } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { makeAuthUser, makeMockAuth } from "@/test-utils/mock-auth";

jest.mock("@/api/intake");
jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));

const mockGetIntake = getPatientIntake as jest.Mock;
const mockSubmitIntake = submitPatientIntakeForm as jest.Mock;
const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;

const intake = {
  id: "intake-1",
  appointmentId: "appt-1",
  status: "pending",
  locale: "en",
  questions: [
    { key: "q1", text: "What symptoms are you experiencing?" },
    { key: "q2", text: "Any known allergies?", answer: "Penicillin" },
  ],
};

describe("IntakeFormScreen", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: makeAuthUser() }));
    mockUseLocalSearchParams.mockReturnValue({ appointmentId: "appt-1" });
    mockGetIntake.mockResolvedValue(intake);
  });

  it("redirects to login instead of rendering the intake form when there is no authenticated user", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: null, isLoading: false }));
    await render(<IntakeFormScreen />);
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
    expect(screen.queryByText("Submit")).toBeNull();
  });

  it("does not redirect while auth is still resolving", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: null, isLoading: true }));
    await render(<IntakeFormScreen />);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("loads the form using the appointmentId route param and pre-fills known answers", async () => {
    await render(<IntakeFormScreen />);
    await waitFor(() => expect(mockGetIntake).toHaveBeenCalledWith("appt-1"));
    expect(screen.getByText("What symptoms are you experiencing?")).toBeTruthy();
    expect(screen.getByDisplayValue("Penicillin")).toBeTruthy();
  });

  it("shows an error message when loading fails", async () => {
    mockGetIntake.mockRejectedValue(new ApiRequestError("Appointment not found", "NOT_FOUND", 404));
    await render(<IntakeFormScreen />);
    expect(await screen.findByText("Appointment not found")).toBeTruthy();
  });

  it("shows a completed message instead of the form when already submitted", async () => {
    mockGetIntake.mockResolvedValue({ ...intake, status: "completed" });
    await render(<IntakeFormScreen />);
    expect(
      await screen.findByText("You've already shared your medical history for this consultation."),
    ).toBeTruthy();
    expect(screen.queryByText("Submit")).toBeNull();
  });

  it("requires every question to be answered before submitting", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<IntakeFormScreen />);
    await waitFor(() => expect(screen.getByText("Submit")).toBeTruthy());

    await fireEvent.press(screen.getByText("Submit"));

    expect(alertSpy).toHaveBeenCalledWith("Answer required", "Please answer every question before submitting.");
    expect(mockSubmitIntake).not.toHaveBeenCalled();
  });

  it("labels each answer field with its own question so a screen reader user can tell them apart", async () => {
    await render(<IntakeFormScreen />);
    await waitFor(() => expect(screen.getByText("Submit")).toBeTruthy());

    await fireEvent.changeText(screen.getByLabelText("What symptoms are you experiencing?"), "Fever");
    expect(screen.getByLabelText("Any known allergies?")).toHaveDisplayValue("Penicillin");
    expect(screen.getByDisplayValue("Fever")).toBeTruthy();
  });

  it("submits trimmed answers and confirms with the user", async () => {
    mockSubmitIntake.mockResolvedValue({ intake: { ...intake, status: "completed" } });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<IntakeFormScreen />);
    await waitFor(() => expect(screen.getByText("Submit")).toBeTruthy());

    const q1Input = screen.getAllByPlaceholderText("Your answer")[0];
    await fireEvent.changeText(q1Input, "  Fever and cough  ");
    await fireEvent.press(screen.getByText("Submit"));

    await waitFor(() => {
      expect(mockSubmitIntake).toHaveBeenCalledWith("appt-1", [
        { key: "q1", answer: "Fever and cough" },
        { key: "q2", answer: "Penicillin" },
      ]);
    });
    expect(alertSpy).toHaveBeenCalledWith(
      "Thanks!",
      "Your medical history has been shared with your doctor.",
      expect.any(Array),
    );

    const buttons = alertSpy.mock.calls.find((c) => c[0] === "Thanks!")![2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === "Done")?.onPress?.());
    expect(router.back).toHaveBeenCalled();
  });

  it("shows a submit error message when the request fails", async () => {
    mockSubmitIntake.mockRejectedValue(new ApiRequestError("Server error", "ERR", 500));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<IntakeFormScreen />);
    await waitFor(() => expect(screen.getByText("Submit")).toBeTruthy());

    await fireEvent.changeText(screen.getByDisplayValue(""), "Some answer");
    await fireEvent.press(screen.getByText("Submit"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Couldn't submit", "Server error");
    });
    expect(await screen.findByText("Server error")).toBeTruthy();
  });
});
