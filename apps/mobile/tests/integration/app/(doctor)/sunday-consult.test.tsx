import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import DoctorSundayConsultScreen from "@app/(doctor)/sunday-consult";
import {
  getDoctorProfile,
  getSundayDoctorQueue,
  toggleSundayConsult,
  upsertSundayTemplate,
  updateSundayAppointmentStatus,
} from "@/api/doctor";
import { ApiRequestError } from "@/api/client";

jest.mock("@/api/doctor");

const mockGetProfile = getDoctorProfile as jest.Mock;
const mockGetQueue = getSundayDoctorQueue as jest.Mock;
const mockToggle = toggleSundayConsult as jest.Mock;
const mockUpsertTemplate = upsertSundayTemplate as jest.Mock;
const mockSetStatus = updateSundayAppointmentStatus as jest.Mock;

const profile = {
  id: "doc-1",
  user: { id: "u-1", name: "Bilal Chaudhry", memberSince: "2023-01-01" },
  pmdcVerified: true,
  qualifications: [],
  experienceYears: 5,
  additionalSpecialties: [],
  specialties: [],
  languages: [],
  hospitals: [],
  consultationFee: 2000,
  weeklyAvailability: [],
  sundayConsult: { enabled: false, startTimeLocal: "10:00", endTimeLocal: "13:00", slotDurationMins: 10, maxSlots: 15 },
  homeVisit: { enabled: false },
  verificationStatus: "approved",
  isListed: true,
  documents: {},
};

const emptyQueue = { instance: null, appointments: [], slots: [] };

describe("DoctorSundayConsultScreen", () => {
  beforeEach(() => {
    mockGetProfile.mockResolvedValue(profile);
    mockGetQueue.mockResolvedValue(emptyQueue);
  });

  it("shows an error message when loading fails", async () => {
    mockGetProfile.mockRejectedValue(new ApiRequestError("Not authorized", "AUTH", 401));
    await render(<DoctorSundayConsultScreen />);
    expect(await screen.findByText("Not authorized")).toBeTruthy();
  });

  it("shows the empty queue message", async () => {
    await render(<DoctorSundayConsultScreen />);
    expect(await screen.findByText("No bookings for this Sunday yet.")).toBeTruthy();
  });

  it("toggles Sunday consult on", async () => {
    mockToggle.mockResolvedValue({ sundayConsultEnabled: true });
    await render(<DoctorSundayConsultScreen />);
    await waitFor(() => expect(screen.getByRole("switch")).toBeTruthy());
    await fireEvent(screen.getByRole("switch"), "valueChange", true);
    await waitFor(() => expect(mockToggle).toHaveBeenCalledWith(true));
  });

  it("alerts when toggling fails", async () => {
    mockToggle.mockRejectedValue(new ApiRequestError("Server error", "ERR", 500));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorSundayConsultScreen />);
    await waitFor(() => expect(screen.getByRole("switch")).toBeTruthy());
    await fireEvent(screen.getByRole("switch"), "valueChange", true);
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Couldn't update", "Server error"));
  });

  it("pre-fills the schedule form from the profile", async () => {
    await render(<DoctorSundayConsultScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("10:00")).toBeTruthy());
    expect(screen.getByDisplayValue("13:00")).toBeTruthy();
    expect(screen.getByDisplayValue("10")).toBeTruthy();
    expect(screen.getByDisplayValue("15")).toBeTruthy();
  });

  it("rejects a slot duration under 5 minutes", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorSundayConsultScreen />);
    const durationInput = await screen.findByDisplayValue("10");
    await fireEvent.changeText(durationInput, "2");
    await fireEvent.press(screen.getByText("Save schedule"));

    expect(alertSpy).toHaveBeenCalledWith("Invalid duration", "Slot duration must be at least 5 minutes.");
    expect(mockUpsertTemplate).not.toHaveBeenCalled();
  });

  it("rejects fewer than 1 max slot", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorSundayConsultScreen />);
    const maxSlotsInput = await screen.findByDisplayValue("15");
    await fireEvent.changeText(maxSlotsInput, "0");
    await fireEvent.press(screen.getByText("Save schedule"));

    expect(alertSpy).toHaveBeenCalledWith("Invalid slots", "Max slots must be at least 1.");
    expect(mockUpsertTemplate).not.toHaveBeenCalled();
  });

  it("lets every schedule field be found and edited by its accessible name", async () => {
    mockUpsertTemplate.mockResolvedValue({});
    await render(<DoctorSundayConsultScreen />);
    await screen.findByDisplayValue("10:00");

    await fireEvent.changeText(screen.getByLabelText("Start (HH:mm)"), "11:00");
    await fireEvent.changeText(screen.getByLabelText("End (HH:mm)"), "14:00");
    await fireEvent.changeText(screen.getByLabelText("Slot duration (mins)"), "20");
    await fireEvent.changeText(screen.getByLabelText("Max slots"), "5");
    await fireEvent.press(screen.getByText("Save schedule"));

    await waitFor(() => {
      expect(mockUpsertTemplate).toHaveBeenCalledWith({
        startTimeLocal: "11:00",
        endTimeLocal: "14:00",
        slotDurationMins: 20,
        maxSlots: 5,
        isActive: true,
      });
    });
  });

  it("saves a valid schedule", async () => {
    mockUpsertTemplate.mockResolvedValue({});
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorSundayConsultScreen />);
    await screen.findByDisplayValue("10:00");
    await fireEvent.press(screen.getByText("Save schedule"));

    await waitFor(() => {
      expect(mockUpsertTemplate).toHaveBeenCalledWith({
        startTimeLocal: "10:00",
        endTimeLocal: "13:00",
        slotDurationMins: 10,
        maxSlots: 15,
        isActive: true,
      });
      expect(alertSpy).toHaveBeenCalledWith("Saved", "Your Sunday consult schedule has been updated.");
    });
  });

  it("shows the queue with patient details and status actions", async () => {
    mockGetQueue.mockResolvedValue({
      instance: null,
      slots: [],
      appointments: [
        {
          _id: "apt-1",
          scheduledStart: "2026-02-01T10:00:00.000Z",
          scheduledEnd: "2026-02-01T10:10:00.000Z",
          status: "confirmed",
          patientId: { name: "Ayesha Khan", phone: "0300" },
          patientNotes: "Fever",
        },
      ],
    });
    await render(<DoctorSundayConsultScreen />);
    await waitFor(() => expect(screen.getByText("Ayesha Khan")).toBeTruthy());
    expect(screen.getByText("“Fever”")).toBeTruthy();
    expect(screen.getByText("Completed")).toBeTruthy();
    expect(screen.getByText("No-show")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("updates the appointment status when a status action is pressed", async () => {
    mockGetQueue.mockResolvedValue({
      instance: null,
      slots: [],
      appointments: [
        {
          _id: "apt-1",
          scheduledStart: "2026-02-01T10:00:00.000Z",
          scheduledEnd: "2026-02-01T10:10:00.000Z",
          status: "confirmed",
          patientId: { name: "Ayesha Khan" },
        },
      ],
    });
    mockSetStatus.mockResolvedValue({ status: "completed" });
    await render(<DoctorSundayConsultScreen />);
    await waitFor(() => expect(screen.getByText("Completed")).toBeTruthy());
    await fireEvent.press(screen.getByText("Completed"));

    await waitFor(() => {
      expect(mockSetStatus).toHaveBeenCalledWith("apt-1", "completed");
    });
  });

  it("alerts when a status update fails", async () => {
    mockGetQueue.mockResolvedValue({
      instance: null,
      slots: [],
      appointments: [
        {
          _id: "apt-1",
          scheduledStart: "2026-02-01T10:00:00.000Z",
          scheduledEnd: "2026-02-01T10:10:00.000Z",
          status: "pending",
          patientId: { name: "Ayesha Khan" },
        },
      ],
    });
    mockSetStatus.mockRejectedValue(new ApiRequestError("Already updated", "DONE", 400));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorSundayConsultScreen />);
    await waitFor(() => expect(screen.getByText("Cancel")).toBeTruthy());
    await fireEvent.press(screen.getByText("Cancel"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Couldn't update", "Already updated");
    });
  });

  it("hides status actions for completed/cancelled appointments", async () => {
    mockGetQueue.mockResolvedValue({
      instance: null,
      slots: [],
      appointments: [
        {
          _id: "apt-1",
          scheduledStart: "2026-02-01T10:00:00.000Z",
          scheduledEnd: "2026-02-01T10:10:00.000Z",
          status: "completed",
          patientId: { name: "Ayesha Khan" },
        },
      ],
    });
    await render(<DoctorSundayConsultScreen />);
    await waitFor(() => expect(screen.getByText("Ayesha Khan")).toBeTruthy());
    expect(screen.queryByText("Completed")).toBeNull();
  });

  it("does not let a slow initial-focus response overwrite a faster, later poll response", async () => {
    jest.useFakeTimers();
    try {
      let resolveA: (v: unknown) => void;
      let resolveB: (v: unknown) => void;
      const requestA = new Promise((resolve) => {
        resolveA = resolve;
      });
      const requestB = new Promise((resolve) => {
        resolveB = resolve;
      });
      mockGetQueue.mockImplementationOnce(() => requestA).mockImplementationOnce(() => requestB);

      await render(<DoctorSundayConsultScreen />); // fires the initial focus load (call A), pending

      await act(async () => {
        jest.advanceTimersByTime(15000); // POLL_MS — fires the poll tick (call B), pending
      });

      const queueWithNewPatient = {
        instance: null,
        slots: [],
        appointments: [
          {
            _id: "apt-new",
            scheduledStart: "2026-02-01T10:00:00.000Z",
            scheduledEnd: "2026-02-01T10:10:00.000Z",
            status: "assigned",
            patientId: { name: "New Patient" },
          },
        ],
      };
      await act(async () => {
        resolveB!(queueWithNewPatient); // B (newer) resolves first
      });
      expect(await screen.findByText("New Patient")).toBeTruthy();

      const queueWithOldPatient = {
        instance: null,
        slots: [],
        appointments: [
          {
            _id: "apt-old",
            scheduledStart: "2026-02-01T09:00:00.000Z",
            scheduledEnd: "2026-02-01T09:10:00.000Z",
            status: "assigned",
            patientId: { name: "Old Patient" },
          },
        ],
      };
      await act(async () => {
        resolveA!(queueWithOldPatient); // A (older) resolves late
      });

      expect(await screen.findByText("New Patient")).toBeTruthy();
      expect(screen.queryByText("Old Patient")).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
