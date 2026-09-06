// E2E journey: Section 14 — the doctor role's own journeys.
// Dashboard -> Requests -> write a prescription -> it appears in Prescriptions.
// Dashboard -> Patients. Dashboard -> Messages -> conversation -> send message.
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import DoctorDashboardScreen from "@app/(doctor)/index";
import DoctorRequestsScreen from "@app/(doctor)/requests";
import DoctorPrescriptionNewScreen from "@app/(doctor)/prescription-new";
import DoctorPrescriptionsScreen from "@app/(doctor)/prescriptions";
import DoctorPatientsScreen from "@app/(doctor)/patients";
import DoctorMessagesScreen from "@app/(doctor)/messages";
import { router, useLocalSearchParams } from "expo-router";
import {
  getDoctorSummary,
  getDoctorProfile,
  listDoctorRequests,
  getDoctorPrescriptionContext,
  createDoctorPrescription,
  listDoctorPrescriptions,
  listDoctorPatients,
} from "@/api/doctor";
import { listChatThreads, listChatMessages, sendChatMessage, markChatThreadRead } from "@/api/chat";

jest.mock("@/api/doctor");
jest.mock("@/api/chat");

const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockGetDoctorSummary = getDoctorSummary as jest.Mock;
const mockGetDoctorProfile = getDoctorProfile as jest.Mock;
const mockListDoctorRequests = listDoctorRequests as jest.Mock;
const mockGetPrescriptionContext = getDoctorPrescriptionContext as jest.Mock;
const mockCreatePrescription = createDoctorPrescription as jest.Mock;
const mockListDoctorPrescriptions = listDoctorPrescriptions as jest.Mock;
const mockListDoctorPatients = listDoctorPatients as jest.Mock;
const mockListChatThreads = listChatThreads as jest.Mock;
const mockListChatMessages = listChatMessages as jest.Mock;
const mockSendChatMessage = sendChatMessage as jest.Mock;
const mockMarkChatThreadRead = markChatThreadRead as jest.Mock;

const summary = {
  patients: 12,
  pendingRequests: 2,
  todayAppointments: 3,
  upcomingThisWeek: 5,
  ratingAvg: 4.7,
  ratingCount: 40,
  completionRate: 92,
  earningsThisMonth: 50000,
  availableBalance: 20000,
  prescriptionsWritten: 30,
  returningPatients: 6,
};

const doctorProfile = {
  user: { name: "Dr. Kamran Aziz" },
  verificationStatus: "approved",
};

describe("Section 14: doctor dashboard -> requests -> write prescription -> prescriptions", () => {
  it("navigates from the dashboard to Requests via the quick action", async () => {
    mockGetDoctorSummary.mockResolvedValue(summary);
    mockGetDoctorProfile.mockResolvedValue(doctorProfile);
    await render(<DoctorDashboardScreen />);
    await waitFor(() => expect(screen.getByText("Hi, Dr.")).toBeTruthy());

    await fireEvent.press(screen.getByText("Consult requests"));
    expect(router.push).toHaveBeenCalledWith("/(doctor)/requests");
  });

  it("writes a prescription for the correct appointment from Requests, and it then appears in Prescriptions", async () => {
    mockListDoctorRequests.mockResolvedValue([
      {
        id: "appt-1",
        patient: { name: "Patient Faisal", phone: "0300", },
        outcome: "in_progress",
        type: "online",
        scheduledStart: "2026-02-01T10:00:00.000Z",
        patientNotes: "Fever for 2 days",
        consultationFee: 1500,
        hasPrescription: false,
        canJoin: false,
        review: undefined,
      },
    ]);
    await render(<DoctorRequestsScreen />);
    await waitFor(() => expect(screen.getByText("Patient Faisal")).toBeTruthy());

    await fireEvent.press(screen.getByText("Write prescription"));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/(doctor)/prescription-new", params: { appointmentId: "appt-1" } });

    mockUseLocalSearchParams.mockReturnValue({ appointmentId: "appt-1" });
    mockGetPrescriptionContext.mockResolvedValue({
      patientName: "Patient Faisal",
      appointmentType: "Online consult",
      scheduledStart: "2026-02-01T10:00:00.000Z",
      canIssue: true,
      existingPrescription: null,
    });
    await render(<DoctorPrescriptionNewScreen />);
    await waitFor(() => expect(screen.getByText("Patient Faisal")).toBeTruthy());

    await fireEvent.changeText(screen.getByPlaceholderText("Medicine name"), "Paracetamol");
    await fireEvent.changeText(screen.getByPlaceholderText("Dosage (e.g. 500mg)"), "500mg");
    await fireEvent.changeText(screen.getByPlaceholderText("Frequency (e.g. Twice daily)"), "Twice daily");
    await fireEvent.changeText(screen.getByPlaceholderText("Duration (e.g. 7 days)"), "5 days");

    mockCreatePrescription.mockResolvedValue(undefined);
    await fireEvent.press(screen.getByText("Issue prescription"));

    await waitFor(() => {
      expect(mockCreatePrescription).toHaveBeenCalledWith({
        appointmentId: "appt-1",
        medications: [{ name: "Paracetamol", dosage: "500mg", frequency: "Twice daily", duration: "5 days" }],
        notes: undefined,
      });
    });
    expect(router.replace).toHaveBeenCalledWith("/(doctor)/prescriptions");

    mockListDoctorPrescriptions.mockResolvedValue([
      { id: "rx-1", patientName: "Patient Faisal", issuedAt: "2026-02-01T10:10:00.000Z", medicationCount: 1, downloadUrl: "/rx-1.pdf" },
    ]);
    await render(<DoctorPrescriptionsScreen />);
    expect(await screen.findByText("Patient Faisal")).toBeTruthy();
    expect(screen.getByText("1 medicine")).toBeTruthy();
  });

  it("blocks issuing a prescription with an incomplete medicine and shows the app's own validation alert", async () => {
    mockUseLocalSearchParams.mockReturnValue({ appointmentId: "appt-2" });
    mockGetPrescriptionContext.mockResolvedValue({
      patientName: "Patient Zainab",
      appointmentType: "Online consult",
      scheduledStart: "2026-02-01T10:00:00.000Z",
      canIssue: true,
      existingPrescription: null,
    });
    const { Alert } = require("react-native");
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorPrescriptionNewScreen />);
    await waitFor(() => expect(screen.getByText("Patient Zainab")).toBeTruthy());

    await fireEvent.changeText(screen.getByPlaceholderText("Medicine name"), "Amoxicillin");
    await fireEvent.press(screen.getByText("Issue prescription"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Missing details", "Each medicine needs a dosage, frequency, and duration.");
    });
    expect(mockCreatePrescription).not.toHaveBeenCalled();
  });
});

describe("Section 14: doctor -> patients", () => {
  it("shows the doctor's patient list with visit stats", async () => {
    mockListDoctorPatients.mockResolvedValue([
      { id: "pat-1", name: "Patient Faisal", phone: "0300", lastOutcome: "completed", lastVisitAt: "2026-01-20T00:00:00.000Z", appointmentCount: 3, completedCount: 3, prescriptionCount: 2 },
    ]);
    await render(<DoctorPatientsScreen />);
    expect(await screen.findByText("Patient Faisal")).toBeTruthy();
    expect(screen.getByText("3 visits")).toBeTruthy();
    expect(screen.getByText("2 prescriptions")).toBeTruthy();
  });
});

describe("Section 14: doctor -> messages -> conversation -> send", () => {
  it("opens the correct patient conversation and sends a message", async () => {
    mockListChatThreads.mockResolvedValue([
      { id: "thread-9", otherParticipant: { id: "pat-1", name: "Patient Faisal", avatarUrl: undefined }, lastMessagePreview: "Thank you doctor", lastMessageAt: "2026-02-01T09:00:00.000Z", unreadCount: 1 },
    ]);
    await render(<DoctorMessagesScreen />);
    await waitFor(() => expect(screen.getByText("Patient Faisal")).toBeTruthy());
    await fireEvent.press(screen.getByText("Patient Faisal"));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(doctor)/messages-thread",
      params: { threadId: "thread-9", name: "Patient Faisal" },
    });

    mockUseLocalSearchParams.mockReturnValue({ threadId: "thread-9", name: "Patient Faisal" });
    mockMarkChatThreadRead.mockResolvedValue(undefined);
    mockListChatMessages.mockResolvedValue({ messages: [{ id: "m1", body: "Thank you doctor", createdAt: "2026-02-01T09:00:00.000Z", isMine: false }] });
    const MessagesThreadScreen = require("@app/(doctor)/messages-thread").default;
    await render(<MessagesThreadScreen />);
    await waitFor(() => expect(mockMarkChatThreadRead).toHaveBeenCalledWith("thread-9"));
    expect(screen.getByText("Thank you doctor")).toBeTruthy();

    mockSendChatMessage.mockResolvedValue({ id: "m2", body: "You're welcome", createdAt: "2026-02-01T09:05:00.000Z", isMine: true });
    mockListChatMessages.mockResolvedValueOnce({
      messages: [
        { id: "m1", body: "Thank you doctor", createdAt: "2026-02-01T09:00:00.000Z", isMine: false },
        { id: "m2", body: "You're welcome", createdAt: "2026-02-01T09:05:00.000Z", isMine: true },
      ],
    });
    await fireEvent.changeText(screen.getByPlaceholderText("Type a message"), "You're welcome");
    await fireEvent.press(screen.getByTestId("chat-send-button"));
    expect(await screen.findByText("You're welcome")).toBeTruthy();
    expect(mockSendChatMessage).toHaveBeenCalledWith("thread-9", "You're welcome");
  });
});
