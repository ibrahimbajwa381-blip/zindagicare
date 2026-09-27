import { EventEmitter } from "events";
import { createRealtimeEmitter } from "./create-emitter";

export type UrgentConsultEvent = {
  type: "booking_updated" | "doctor_assigned" | "status_changed";
  appointmentId: string;
  patientId?: string;
  doctorId?: string;
  status?: string;
};

declare global {
  var urgentRealtimeEmitter: EventEmitter | undefined;
}

export const urgentEmitter = createRealtimeEmitter({
  get: () => global.urgentRealtimeEmitter,
  set: (emitter) => {
    global.urgentRealtimeEmitter = emitter;
  },
});

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
