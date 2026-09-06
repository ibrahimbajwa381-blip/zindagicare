import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import DoctorPrescriptionNewScreen from "@app/(doctor)/prescription-new";
import { getDoctorPrescriptionContext, createDoctorPrescription } from "@/api/doctor";
import { ApiRequestError } from "@/api/client";
import { useLocalSearchParams, router } from "expo-router";

jest.mock("@/api/doctor");

const mockGetContext = getDoctorPrescriptionContext as jest.Mock;
const mockCreate = createDoctorPrescription as jest.Mock;
const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;

const context = {
  appointmentId: "appt-1",
  appointmentType: "online",
  scheduledStart: "2026-02-01T10:00:00.000Z",
  patientName: "Ayesha Khan",
  status: "in_progress",
  canIssue: true,
};

async function fillMedicine(index = 0, values = { name: "Amoxicillin", dosage: "500mg", frequency: "3x daily", duration: "7 days" }) {
  const names = screen.getAllByPlaceholderText("Medicine name");
  const dosages = screen.getAllByPlaceholderText("Dosage (e.g. 500mg)");
  const freqs = screen.getAllByPlaceholderText("Frequency (e.g. Twice daily)");
  const durations = screen.getAllByPlaceholderText("Duration (e.g. 7 days)");
  await fireEvent.changeText(names[index], values.name);
  await fireEvent.changeText(dosages[index], values.dosage);
  await fireEvent.changeText(freqs[index], values.frequency);
  await fireEvent.changeText(durations[index], values.duration);
}

describe("DoctorPrescriptionNewScreen", () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReturnValue({ appointmentId: "appt-1" });
    mockGetContext.mockResolvedValue(context);
  });

  it("loads context using the appointmentId route param and shows the patient", async () => {
    await render(<DoctorPrescriptionNewScreen />);
    await waitFor(() => expect(mockGetContext).toHaveBeenCalledWith("appt-1"));
    expect(screen.getByText("Ayesha Khan")).toBeTruthy();
    expect(screen.getByText("Medicine 1")).toBeTruthy();
  });

  it("shows an error message when loading fails", async () => {
    mockGetContext.mockRejectedValue(new ApiRequestError("Appointment not found", "NOT_FOUND", 404));
    await render(<DoctorPrescriptionNewScreen />);
    expect(await screen.findByText("Appointment not found")).toBeTruthy();
  });

  it("shows an already-issued message when a prescription exists", async () => {
    mockGetContext.mockResolvedValue({ ...context, existingPrescription: { id: "rx-1", downloadUrl: "/x.pdf" } });
    await render(<DoctorPrescriptionNewScreen />);
    expect(
      await screen.findByText("A prescription was already issued for this consultation."),
    ).toBeTruthy();
  });

  it("shows an ineligible message when the appointment can't accept a prescription", async () => {
    mockGetContext.mockResolvedValue({ ...context, canIssue: false });
    await render(<DoctorPrescriptionNewScreen />);
    expect(
      await screen.findByText("Prescriptions can only be issued for confirmed, in-progress, or completed appointments."),
    ).toBeTruthy();
  });

  it("adds and removes medicine rows", async () => {
    await render(<DoctorPrescriptionNewScreen />);
    await waitFor(() => expect(screen.getByText("Medicine 1")).toBeTruthy());

    await fireEvent.press(screen.getByText("Add another medicine"));
    expect(screen.getByText("Medicine 2")).toBeTruthy();
    expect(screen.getAllByPlaceholderText("Medicine name")).toHaveLength(2);
  });

  it("requires at least one medicine with a name", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorPrescriptionNewScreen />);
    await waitFor(() => expect(screen.getByText("Medicine 1")).toBeTruthy());
    await fireEvent.press(screen.getByText("Issue prescription"));

    expect(alertSpy).toHaveBeenCalledWith("Add a medicine", "At least one medicine with a name is required.");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("treats a whitespace-only medicine name as absent (not just an incomplete row)", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorPrescriptionNewScreen />);
    await waitFor(() => expect(screen.getByText("Medicine 1")).toBeTruthy());
    await fireEvent.changeText(screen.getByPlaceholderText("Medicine name"), "   ");
    await fireEvent.changeText(screen.getByPlaceholderText("Dosage (e.g. 500mg)"), "500mg");
    await fireEvent.changeText(screen.getByPlaceholderText("Frequency (e.g. Twice daily)"), "Once daily");
    await fireEvent.changeText(screen.getByPlaceholderText("Duration (e.g. 7 days)"), "5 days");
    await fireEvent.press(screen.getByText("Issue prescription"));

    expect(alertSpy).toHaveBeenCalledWith("Add a medicine", "At least one medicine with a name is required.");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("requires dosage, frequency, and duration for named medicines", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorPrescriptionNewScreen />);
    await waitFor(() => expect(screen.getByText("Medicine 1")).toBeTruthy());
    await fireEvent.changeText(screen.getByPlaceholderText("Medicine name"), "Amoxicillin");
    await fireEvent.press(screen.getByText("Issue prescription"));

    expect(alertSpy).toHaveBeenCalledWith("Missing details", "Each medicine needs a dosage, frequency, and duration.");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("submits trimmed medicines, filtering out unnamed rows, and redirects", async () => {
    mockCreate.mockResolvedValue({ id: "rx-1" });
    await render(<DoctorPrescriptionNewScreen />);
    await waitFor(() => expect(screen.getByText("Medicine 1")).toBeTruthy());

    await fillMedicine(0, { name: "  Amoxicillin  ", dosage: " 500mg ", frequency: "3x daily", duration: "7 days" });
    await fireEvent.press(screen.getByText("Add another medicine"));
    // Second (empty) medicine row should be filtered out entirely.
    await fireEvent.changeText(screen.getByPlaceholderText("Advice, follow-up instructions, etc."), "Take with food");

    await fireEvent.press(screen.getByText("Issue prescription"));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        appointmentId: "appt-1",
        medications: [{ name: "Amoxicillin", dosage: "500mg", frequency: "3x daily", duration: "7 days" }],
        notes: "Take with food",
      });
      expect(router.replace).toHaveBeenCalledWith("/(doctor)/prescriptions");
    });
  });

  it("shows an alert and error message when saving fails", async () => {
    mockCreate.mockRejectedValue(new ApiRequestError("Server error", "ERR", 500));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorPrescriptionNewScreen />);
    await waitFor(() => expect(screen.getByText("Medicine 1")).toBeTruthy());
    await fillMedicine();
    await fireEvent.press(screen.getByText("Issue prescription"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Couldn't save prescription", "Server error");
    });
    expect(await screen.findByText("Server error")).toBeTruthy();
  });

  it("removes a specific medicine row when its trash icon is pressed", async () => {
    await render(<DoctorPrescriptionNewScreen />);
    await waitFor(() => expect(screen.getByText("Medicine 1")).toBeTruthy());
    await fireEvent.press(screen.getByText("Add another medicine"));
    expect(screen.getByText("Medicine 2")).toBeTruthy();

    await fillMedicine(0, { name: "First", dosage: "1", frequency: "1", duration: "1" });
    await fillMedicine(1, { name: "Second", dosage: "2", frequency: "2", duration: "2" });

    await fireEvent.press(screen.getByTestId("remove-medicine-0"));

    expect(screen.queryByText("Medicine 2")).toBeNull();
    expect(screen.getByDisplayValue("Second")).toBeTruthy();
    expect(screen.queryByDisplayValue("First")).toBeNull();
  });

  it("gives each medicine's remove button a distinct accessible name", async () => {
    await render(<DoctorPrescriptionNewScreen />);
    await waitFor(() => expect(screen.getByText("Medicine 1")).toBeTruthy());
    await fireEvent.press(screen.getByText("Add another medicine"));
    expect(screen.getByText("Medicine 2")).toBeTruthy();

    await fillMedicine(0, { name: "First", dosage: "1", frequency: "1", duration: "1" });
    await fillMedicine(1, { name: "Second", dosage: "2", frequency: "2", duration: "2" });

    await fireEvent.press(screen.getByRole("button", { name: "Remove medicine 1" }));

    expect(screen.queryByText("Medicine 2")).toBeNull();
    expect(screen.getByDisplayValue("Second")).toBeTruthy();
  });

  it("does not save twice when Issue prescription is pressed twice back-to-back", async () => {
    let resolveCreate: (v: unknown) => void;
    mockCreate.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );
    await render(<DoctorPrescriptionNewScreen />);
    await waitFor(() => expect(screen.getByText("Medicine 1")).toBeTruthy());
    await fillMedicine();

    const submitButton = screen.getByText("Issue prescription");
    await act(async () => {
      fireEvent.press(submitButton);
      fireEvent.press(submitButton);
      resolveCreate!({ id: "rx-1" });
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/(doctor)/prescriptions"));
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
