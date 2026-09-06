import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import DoctorIntakeScreen from "@app/(doctor)/intake";
import { getAppointmentIntakeForDoctor } from "@/api/doctor";
import { ApiRequestError } from "@/api/client";
import { useLocalSearchParams } from "expo-router";

jest.mock("@/api/doctor");

const mockGetIntake = getAppointmentIntakeForDoctor as jest.Mock;
const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;

const intake = {
  id: "intake-1",
  appointmentId: "appt-1",
  status: "in_progress",
  locale: "en",
  questions: [
    { key: "q1", text: "What symptoms are you experiencing?", answer: "Fever and cough" },
    { key: "q2", text: "Any known allergies?" },
  ],
};

describe("DoctorIntakeScreen", () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReturnValue({ appointmentId: "appt-1" });
  });

  it("loads intake using the appointmentId route param and shows only answered questions", async () => {
    mockGetIntake.mockResolvedValue(intake);
    await render(<DoctorIntakeScreen />);
    await waitFor(() => expect(mockGetIntake).toHaveBeenCalledWith("appt-1"));
    expect(screen.getByText("What symptoms are you experiencing?")).toBeTruthy();
    expect(screen.getByText("Fever and cough")).toBeTruthy();
    expect(screen.queryByText("Any known allergies?")).toBeNull();
    expect(screen.getByText("in progress")).toBeTruthy();
  });

  it("shows a message when there is no intake for the appointment", async () => {
    mockGetIntake.mockResolvedValue(null);
    await render(<DoctorIntakeScreen />);
    expect(await screen.findByText("No intake responses for this appointment.")).toBeTruthy();
  });

  it("shows a message when intake exists but nothing has been answered", async () => {
    mockGetIntake.mockResolvedValue({ ...intake, questions: [{ key: "q1", text: "Q1" }] });
    await render(<DoctorIntakeScreen />);
    expect(await screen.findByText("Patient hasn't answered any intake questions yet.")).toBeTruthy();
  });

  it("shows an error message when loading fails", async () => {
    mockGetIntake.mockRejectedValue(new ApiRequestError("Appointment not found", "NOT_FOUND", 404));
    await render(<DoctorIntakeScreen />);
    expect(await screen.findByText("Appointment not found")).toBeTruthy();
  });
});
