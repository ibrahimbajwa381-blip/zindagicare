jest.mock("@/lib/notifications/deliver-notification", () => ({
  deliverUserNotification: jest.fn().mockResolvedValue(undefined),
}));

import { deliverUserNotification } from "@/lib/notifications/deliver-notification";
import {
  sendAppointmentStartNow,
  sendDoctorAppointmentStartNow,
} from "@/lib/notifications/appointment-reminders";
import { notificationEmail } from "@/server/lib/email-templates";

const deliver = deliverUserNotification as jest.Mock;

beforeEach(() => deliver.mockClear());

it("patient start-now email links to the video consult", async () => {
  await sendAppointmentStartNow({
    userId: "u1",
    doctorName: "Ali",
    appointmentId: "appt1",
    type: "online",
  });
  const input = deliver.mock.calls[0][0];
  expect(input.ctaLabel).toBe("Join consultation");
  expect(input.ctaUrl).toMatch(/^https?:\/\/[^/]+\/consult\/video\/appt1$/);
});

it("doctor start-now email links to video only for video consults", async () => {
  await sendDoctorAppointmentStartNow({
    userId: "d1",
    patientName: "Sara",
    appointmentId: "appt2",
    type: "sunday_free",
  });
  expect(deliver.mock.calls[0][0].ctaUrl).toMatch(/\/consult\/video\/appt2$/);

  await sendDoctorAppointmentStartNow({
    userId: "d1",
    patientName: "Sara",
    appointmentId: "appt3",
    type: "clinic",
  });
  expect(deliver.mock.calls[1][0].ctaUrl).toBeUndefined();
});

it("notification email renders the button when a CTA is given", () => {
  const { html, text } = notificationEmail({
    title: "Consultation starts now",
    body: "Join now.",
    ctaLabel: "Join consultation",
    ctaUrl: "https://example.com/consult/video/x",
  });
  expect(html).toContain('href="https://example.com/consult/video/x"');
  expect(html).toContain("Join consultation");
  expect(text).toContain("https://example.com/consult/video/x");
});
