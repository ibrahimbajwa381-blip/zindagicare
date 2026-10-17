/**
 * Booking confirmation emails — patient "consultation confirmed" + doctor
 * "new consultation booking".
 *
 * Pure unit tests: @zindagi/database models and the Resend-backed sendEmail
 * are mocked, so no real email is ever sent and no real data is read or
 * written. The final block exercises email.service itself with fetch mocked.
 */
const mockConnectDatabase = jest.fn();
const mockAppointmentFindById = jest.fn();
const mockDoctorProfileFindById = jest.fn();
const mockUserFindById = jest.fn();
const mockHomeVisitFindById = jest.fn();
const mockSendEmail = jest.fn();
const mockDeliverUserNotification = jest.fn();

jest.mock("@zindagi/database", () => ({
  connectDatabase: (...args: unknown[]) => mockConnectDatabase(...args),
  AppointmentModel: { findById: (...args: unknown[]) => mockAppointmentFindById(...args) },
  DoctorProfileModel: { findById: (...args: unknown[]) => mockDoctorProfileFindById(...args) },
  UserModel: { findById: (...args: unknown[]) => mockUserFindById(...args) },
  HomeVisitModel: { findById: (...args: unknown[]) => mockHomeVisitFindById(...args) },
}));
jest.mock("@/server/services/email.service", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));
jest.mock("@/lib/notifications/deliver-notification", () => ({
  deliverUserNotification: (...args: unknown[]) => mockDeliverUserNotification(...args),
}));
jest.mock("@/server/services/push.service", () => ({
  sendWebPushToUser: jest.fn(async () => undefined),
}));

import { sendBookingEmail } from "@/lib/notifications/booking-emails";
import {
  sendDoctorConsultBooked,
  sendOnlineConsultConfirmation,
} from "@/lib/notifications/consult-notifications";
import {
  bookingReference,
  consultTypeLabel,
  doctorNewBookingEmail,
  formatBookingSchedule,
  patientBookingConfirmationEmail,
  type BookingConsultType,
} from "@/server/lib/email-templates";

const APPOINTMENT_ID = "6650a1b2c3d4e5f6a7b8c9d0";
const PATIENT_ID = "6650a1b2c3d4e5f6a7b80001";
const DOCTOR_PROFILE_ID = "6650a1b2c3d4e5f6a7b80002";
const DOCTOR_USER_ID = "6650a1b2c3d4e5f6a7b80003";
const OTHER_USER_ID = "6650a1b2c3d4e5f6a7b8ffff";
// Sunday 18 Oct 2026, 15:30 in Karachi (UTC+5).
const START = new Date("2026-10-18T10:30:00.000Z");

function query<T>(value: T) {
  return { select: () => ({ lean: async () => value }) };
}

function appointment(overrides: Record<string, unknown> = {}) {
  return {
    _id: APPOINTMENT_ID,
    type: "online",
    status: "confirmed",
    patientId: PATIENT_ID,
    doctorId: DOCTOR_PROFILE_ID,
    providerRole: "doctor",
    scheduledStart: START,
    timezone: "Asia/Karachi",
    patientNotes: "Private: chest pain for 3 days",
    ...overrides,
  };
}

const users: Record<string, { name: string; email?: string; phone?: string }> = {
  [PATIENT_ID]: { name: "Ayesha Khan", email: "ayesha@example.com", phone: "+923001234567" },
  [DOCTOR_USER_ID]: { name: "Bilal Ahmed", email: "dr.bilal@example.com", phone: "+923007654321" },
};

function arrange(apt: Record<string, unknown> | null = appointment()) {
  mockAppointmentFindById.mockReturnValue(query(apt));
  mockDoctorProfileFindById.mockReturnValue(
    query({
      _id: DOCTOR_PROFILE_ID,
      userId: DOCTOR_USER_ID,
      primarySpecialty: "Cardiologist",
      specialties: ["Cardiologist"],
      hospitals: [{ name: "City Clinic", address: "12 Mall Road", city: "Lahore" }],
    }),
  );
  mockUserFindById.mockImplementation((id: string) => query(users[id] ?? null));
}

function sentEmail(index = 0) {
  return mockSendEmail.mock.calls[index][0] as {
    to: string;
    subject: string;
    html: string;
    text: string;
    idempotencyKey: string;
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSendEmail.mockResolvedValue({ ok: true, id: "email_123" });
  mockDeliverUserNotification.mockResolvedValue(undefined);
  jest.spyOn(console, "info").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  arrange();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("sendBookingEmail — patient confirmation", () => {
  it("sends one email to the patient's saved address with the confirmation subject", async () => {
    await expect(
      sendBookingEmail({ appointmentId: APPOINTMENT_ID, recipient: "patient", expectedUserId: PATIENT_ID }),
    ).resolves.toBe("sent");

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const email = sentEmail();
    expect(email.to).toBe("ayesha@example.com");
    expect(email.subject).toBe("Your Consultation Is Confirmed | ZindagiCare");
  });

  it("includes the doctor, specialization, schedule, type, reference, status and links", async () => {
    await sendBookingEmail({ appointmentId: APPOINTMENT_ID, recipient: "patient", expectedUserId: PATIENT_ID });
    const { html, text } = sentEmail();

    for (const body of [html, text]) {
      expect(body).toContain("Dr. Bilal Ahmed");
      expect(body).toContain("Cardiologist");
      expect(body).toContain("Sunday, 18 October 2026");
      expect(body).toContain("3:30 PM PKT");
      expect(body).toContain("Online video consultation");
      expect(body).toContain(bookingReference(APPOINTMENT_ID));
      expect(body).toContain("Confirmed");
      expect(body).toContain("/dashboard");
      expect(body).toContain(`/consult/video/${APPOINTMENT_ID}`);
      expect(body).toContain("info.zindagicare@gmail.com");
    }
  });

  it("never leaks the doctor's email or phone, or the patient's notes", async () => {
    await sendBookingEmail({ appointmentId: APPOINTMENT_ID, recipient: "patient", expectedUserId: PATIENT_ID });
    const { html, text } = sentEmail();
    for (const body of [html, text]) {
      expect(body).not.toContain("dr.bilal@example.com");
      expect(body).not.toContain("7654321");
      expect(body).not.toContain("chest pain");
    }
  });

  it("shows the clinic address for a clinic consult and no video link", async () => {
    arrange(appointment({ type: "clinic", isOnline: false }));
    await sendBookingEmail({ appointmentId: APPOINTMENT_ID, recipient: "patient", expectedUserId: PATIENT_ID });
    const { html } = sentEmail();
    expect(html).toContain("Clinic visit (in person)");
    expect(html).toContain("City Clinic, 12 Mall Road, Lahore");
    expect(html).not.toContain("/consult/video/");
  });

  it("shows the visit address for a home visit", async () => {
    arrange(appointment({ type: "home_visit", homeVisitId: "6650a1b2c3d4e5f6a7b80009" }));
    mockHomeVisitFindById.mockReturnValue(query({ address: { line: "House 5, Street 2, DHA", city: "Lahore" } }));
    await sendBookingEmail({ appointmentId: APPOINTMENT_ID, recipient: "patient", expectedUserId: PATIENT_ID });
    expect(sentEmail().html).toContain("House 5, Street 2, DHA, Lahore");
  });
});

describe("sendBookingEmail — doctor notification", () => {
  it("sends one email to the assigned doctor's saved address", async () => {
    await expect(
      sendBookingEmail({ appointmentId: APPOINTMENT_ID, recipient: "doctor", expectedUserId: DOCTOR_USER_ID }),
    ).resolves.toBe("sent");

    const email = sentEmail();
    expect(email.to).toBe("dr.bilal@example.com");
    expect(email.subject).toBe("New Consultation Booking | ZindagiCare");
  });

  it("includes the patient name, schedule, type, reference, status and dashboard link", async () => {
    await sendBookingEmail({ appointmentId: APPOINTMENT_ID, recipient: "doctor", expectedUserId: DOCTOR_USER_ID });
    const { html, text } = sentEmail();
    for (const body of [html, text]) {
      expect(body).toContain("Ayesha Khan");
      expect(body).toContain("Sunday, 18 October 2026");
      expect(body).toContain("3:30 PM PKT");
      expect(body).toContain("Online video consultation");
      expect(body).toContain(bookingReference(APPOINTMENT_ID));
      expect(body).toContain("Confirmed");
      expect(body).toContain(`/doctor/intake/${APPOINTMENT_ID}`);
    }
  });

  it("does not expose the patient's email, phone or notes to the doctor", async () => {
    await sendBookingEmail({ appointmentId: APPOINTMENT_ID, recipient: "doctor", expectedUserId: DOCTOR_USER_ID });
    const { html, text } = sentEmail();
    for (const body of [html, text]) {
      expect(body).not.toContain("ayesha@example.com");
      expect(body).not.toContain("1234567");
      expect(body).not.toContain("chest pain");
    }
  });

  it("links urgent consults to the urgent-calls board", async () => {
    arrange(appointment({ type: "urgent_online" }));
    await sendBookingEmail({ appointmentId: APPOINTMENT_ID, recipient: "doctor", expectedUserId: DOCTOR_USER_ID });
    expect(sentEmail().html).toContain(`/doctor/urgent-calls?requestId=${APPOINTMENT_ID}`);
  });

  it("refuses to email a doctor who is not assigned to the appointment", async () => {
    await expect(
      sendBookingEmail({ appointmentId: APPOINTMENT_ID, recipient: "doctor", expectedUserId: OTHER_USER_ID }),
    ).resolves.toBe("recipient_mismatch");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("refuses to send the patient email to anyone but the appointment's patient", async () => {
    await expect(
      sendBookingEmail({ appointmentId: APPOINTMENT_ID, recipient: "patient", expectedUserId: DOCTOR_USER_ID }),
    ).resolves.toBe("recipient_mismatch");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe("sendBookingEmail — safety", () => {
  it.each(["pending", "cancelled", "completed", "no_show"])(
    "sends nothing for a %s appointment",
    async (status) => {
      arrange(appointment({ status }));
      await expect(
        sendBookingEmail({ appointmentId: APPOINTMENT_ID, recipient: "patient", expectedUserId: PATIENT_ID }),
      ).resolves.toBe("not_confirmed");
      expect(mockSendEmail).not.toHaveBeenCalled();
    },
  );

  it("sends nothing for a missing or deleted appointment", async () => {
    arrange(null);
    await expect(
      sendBookingEmail({ appointmentId: APPOINTMENT_ID, recipient: "patient", expectedUserId: PATIENT_ID }),
    ).resolves.toBe("not_found");
    arrange(appointment({ deletedAt: new Date() }));
    await expect(
      sendBookingEmail({ appointmentId: APPOINTMENT_ID, recipient: "doctor", expectedUserId: DOCTOR_USER_ID }),
    ).resolves.toBe("not_found");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("sends nothing for herbalist / nutritionist appointments", async () => {
    arrange(appointment({ providerRole: "herbalist" }));
    await expect(
      sendBookingEmail({ appointmentId: APPOINTMENT_ID, recipient: "patient", expectedUserId: PATIENT_ID }),
    ).resolves.toBe("not_doctor_booking");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("skips safely when the recipient has no email on file", async () => {
    mockUserFindById.mockImplementation((id: string) =>
      query(id === PATIENT_ID ? { name: "WhatsApp Patient" } : users[id]),
    );
    await expect(
      sendBookingEmail({ appointmentId: APPOINTMENT_ID, recipient: "patient", expectedUserId: PATIENT_ID }),
    ).resolves.toBe("no_email");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("reports a provider failure without throwing", async () => {
    mockSendEmail.mockResolvedValue({ ok: false, error: "resend_500" });
    await expect(
      sendBookingEmail({ appointmentId: APPOINTMENT_ID, recipient: "patient", expectedUserId: PATIENT_ID }),
    ).resolves.toBe("failed");
  });

  it("reports a database or network error without throwing", async () => {
    mockSendEmail.mockRejectedValue(new Error("socket hang up"));
    await expect(
      sendBookingEmail({ appointmentId: APPOINTMENT_ID, recipient: "doctor", expectedUserId: DOCTOR_USER_ID }),
    ).resolves.toBe("failed");
    mockAppointmentFindById.mockImplementation(() => {
      throw new Error("connection refused");
    });
    await expect(
      sendBookingEmail({ appointmentId: APPOINTMENT_ID, recipient: "doctor", expectedUserId: DOCTOR_USER_ID }),
    ).resolves.toBe("failed");
  });

  it("logs ids and outcome only — no addresses or names", async () => {
    const info = jest.spyOn(console, "info").mockImplementation(() => undefined);
    await sendBookingEmail({ appointmentId: APPOINTMENT_ID, recipient: "patient", expectedUserId: PATIENT_ID });
    const logged = info.mock.calls.flat().join(" ");
    expect(logged).toContain(APPOINTMENT_ID);
    expect(logged).not.toMatch(/ayesha|bilal|example\.com/i);
  });

  it("gives a retried or replayed event the same idempotency key, per recipient", async () => {
    await sendBookingEmail({ appointmentId: APPOINTMENT_ID, recipient: "patient", expectedUserId: PATIENT_ID });
    await sendBookingEmail({ appointmentId: APPOINTMENT_ID, recipient: "patient", expectedUserId: PATIENT_ID });
    await sendBookingEmail({ appointmentId: APPOINTMENT_ID, recipient: "doctor", expectedUserId: DOCTOR_USER_ID });

    const keys = mockSendEmail.mock.calls.map((call) => (call[0] as { idempotencyKey: string }).idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).not.toBe(keys[2]);
    expect(keys[0]).toContain(APPOINTMENT_ID);
  });
});

describe("booking notification helpers", () => {
  it("send the detailed email instead of the generic notification email", async () => {
    await sendOnlineConsultConfirmation({
      userId: PATIENT_ID,
      doctorName: "Bilal Ahmed",
      slotStart: START,
      amount: 2000,
      appointmentId: APPOINTMENT_ID,
    });
    await sendDoctorConsultBooked({
      userId: DOCTOR_USER_ID,
      patientName: "Ayesha Khan",
      slotStart: START,
      appointmentId: APPOINTMENT_ID,
      type: "online",
    });

    for (const [call] of mockDeliverUserNotification.mock.calls) {
      expect(call).toMatchObject({ skipEmail: true });
    }
    expect(mockSendEmail.mock.calls.map((call) => (call[0] as { to: string }).to)).toEqual([
      "ayesha@example.com",
      "dr.bilal@example.com",
    ]);
  });

  it("still resolve when the email provider fails, so the booking flow carries on", async () => {
    mockSendEmail.mockRejectedValue(new Error("provider down"));
    await expect(
      sendOnlineConsultConfirmation({
        userId: PATIENT_ID,
        doctorName: "Bilal Ahmed",
        slotStart: START,
        amount: 2000,
        appointmentId: APPOINTMENT_ID,
      }),
    ).resolves.toBeUndefined();
    expect(mockDeliverUserNotification).toHaveBeenCalledTimes(1);
  });
});

describe("booking email templates", () => {
  const details = {
    appointmentId: APPOINTMENT_ID,
    status: "confirmed",
    scheduledStart: START,
    timezone: "Asia/Karachi",
  };
  const support = { email: "help@example.com", phone: "0300 0000000" };

  it.each<[BookingConsultType, string]>([
    ["online", "Online video consultation"],
    ["clinic", "Clinic visit (in person)"],
    ["sunday_free", "Sunday Free Consult (video)"],
    ["home_visit", "Home visit"],
    ["urgent_online", "Urgent care video consultation"],
  ])("labels %s consults as %s in both emails", (type, label) => {
    expect(consultTypeLabel(type)).toBe(label);
    const patient = patientBookingConfirmationEmail({
      doctorName: "Dr. Bilal",
      details: { ...details, type },
      dashboardUrl: "https://zindagicare.com/dashboard",
      support,
    });
    const doctor = doctorNewBookingEmail({
      doctorName: "Dr. Bilal",
      patientName: "Ayesha",
      details: { ...details, type },
      dashboardUrl: "https://zindagicare.com/doctor/intake/x",
      support,
    });
    expect(patient.html).toContain(label);
    expect(patient.text).toContain(label);
    expect(doctor.html).toContain(label);
    expect(doctor.text).toContain(label);
  });

  it("formats the date, weekday and time in Pakistan time", () => {
    expect(formatBookingSchedule(START)).toEqual({
      date: "Sunday, 18 October 2026",
      time: "3:30 PM PKT",
    });
    // 20:00 UTC Saturday is already 01:00 Sunday in Karachi.
    expect(formatBookingSchedule(new Date("2026-10-17T20:00:00.000Z"))).toEqual({
      date: "Sunday, 18 October 2026",
      time: "1:00 AM PKT",
    });
  });

  it("escapes names so they cannot inject HTML", () => {
    const { html } = doctorNewBookingEmail({
      doctorName: "Dr. Bilal",
      patientName: '<img src=x onerror="alert(1)">',
      details: { ...details, type: "online" },
      dashboardUrl: "https://zindagicare.com/doctor/intake/x",
      support,
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
  });
});

describe("email.service", () => {
  const env = process.env as Record<string, string | undefined>;
  const saved = { NODE_ENV: env.NODE_ENV, RESEND_API_KEY: env.RESEND_API_KEY, EMAIL_FROM: env.EMAIL_FROM };
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "email_1" }), { status: 200 }),
    );
  });

  afterEach(() => {
    Object.assign(env, saved);
  });

  function realSendEmail() {
    return jest.requireActual<typeof import("@/server/services/email.service")>(
      "@/server/services/email.service",
    ).sendEmail;
  }

  it("never calls the provider while running under tests", async () => {
    const result = await realSendEmail()({ to: "a@example.com", subject: "s", html: "h" });
    expect(result).toEqual({ ok: false, skipped: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends the idempotency key to Resend as a header, with a single recipient", async () => {
    Object.assign(env, {
      NODE_ENV: "production",
      RESEND_API_KEY: "re_test_dummy",
      EMAIL_FROM: "ZindagiCare <noreply@send.zindagicare.com>",
    });
    const result = await realSendEmail()({
      to: "a@example.com",
      subject: "s",
      html: "h",
      idempotencyKey: "booking-confirmed/abc/patient/u1",
    });
    expect(result).toEqual({ ok: true, id: "email_1" });

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe(
      "booking-confirmed/abc/patient/u1",
    );
    const body = JSON.parse(init.body as string);
    expect(body.to).toEqual(["a@example.com"]);
    expect(body.from).toBe("ZindagiCare <noreply@send.zindagicare.com>");
    expect(body).not.toHaveProperty("cc");
    expect(body).not.toHaveProperty("bcc");
  });
});
