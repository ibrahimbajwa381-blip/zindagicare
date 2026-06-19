import { EventEmitter } from "events";

export type UrgentConsultEvent = {
  type: "booking_updated" | "doctor_assigned" | "status_changed";
  appointmentId: string;
  patientId?: string;
  doctorId?: string;
  status?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var urgentRealtimeEmitter: EventEmitter | undefined;
}

export const urgentEmitter =
  global.urgentRealtimeEmitter ?? new EventEmitter();

if (process.env.NODE_ENV !== "production") {
  global.urgentRealtimeEmitter = urgentEmitter;
}

export function publishUrgentEvent(event: UrgentConsultEvent) {
  urgentEmitter.emit(`urgent:${event.appointmentId}`, event);
  if (event.patientId) {
    urgentEmitter.emit(`urgent:patient:${event.patientId}`, event);
  }
  if (event.doctorId) {
    urgentEmitter.emit(`urgent:doctor:${event.doctorId}`, event);
  }
  urgentEmitter.emit("urgent:global", event);
}

export function urgentPatientRoom(patientId: string) {
  return `urgent:patient:${patientId}`;
}

export function urgentDoctorRoom(doctorId: string) {
  return `urgent:doctor:${doctorId}`;
}

export function urgentAppointmentRoom(appointmentId: string) {
  return `urgent:${appointmentId}`;
}
