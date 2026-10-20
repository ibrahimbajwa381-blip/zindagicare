const BRAND = "ZindagiCare";
/** Darkest brand teals — white text on these clears WCAG AA contrast. */
const BRAND_COLOR = "#006B5B";
const BRAND_ACCENT = "#00B89C";
const BRAND_INK = "#004D45";
const BRAND_TINT = "#effaf8";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Shared branded wrapper every transactional email renders inside. */
function layout(options: { preheader?: string; heading: string; bodyHtml: string }): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(BRAND)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    ${options.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</div>` : ""}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:480px;width:100%;">
            <tr>
              <td style="background:${BRAND_COLOR};padding:20px 28px;">
                <span style="color:#ffffff;font-size:18px;font-weight:700;">${escapeHtml(BRAND)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a;">${escapeHtml(options.heading)}</h1>
                ${options.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:12px;">
                This is an automated message from ${escapeHtml(BRAND)}. Please don't reply directly to this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(text)}</p>`;
}

export function notificationEmail(input: {
  name?: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}) {
  const greeting = input.name ? `Hi ${input.name},` : "Hi,";
  const cta =
    input.ctaLabel && input.ctaUrl
      ? `<a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;padding:12px 20px;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${escapeHtml(input.ctaLabel)}</a>`
      : "";
  const bodyHtml = `
    ${paragraph(greeting)}
    ${paragraph(input.body)}
    ${cta}
  `;
  return {
    subject: input.title,
    html: layout({ heading: input.title, bodyHtml, preheader: input.body }),
    text: `${greeting}\n\n${input.body}${input.ctaUrl ? `\n\n${input.ctaUrl}` : ""}`,
  };
}

export function paymentConfirmationEmail(input: {
  name?: string;
  amount: number;
  description: string;
  receiptUrl?: string;
}) {
  const greeting = input.name ? `Hi ${input.name},` : "Hi,";
  const bodyHtml = `
    ${paragraph(`${greeting} we've received your payment.`)}
    <div style="margin:0 0 16px;padding:16px;background:#f0fdfa;border-radius:8px;">
      <p style="margin:0 0 4px;font-size:13px;color:#64748b;">Amount paid</p>
      <p style="margin:0 0 12px;font-size:24px;font-weight:700;color:${BRAND_COLOR};">Rs. ${input.amount.toLocaleString()}</p>
      <p style="margin:0;font-size:14px;color:#334155;">${escapeHtml(input.description)}</p>
    </div>
    ${input.receiptUrl ? `<a href="${escapeHtml(input.receiptUrl)}" style="display:inline-block;padding:12px 20px;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">View receipt</a>` : ""}
  `;
  return {
    subject: `Payment received — Rs. ${input.amount.toLocaleString()}`,
    html: layout({ heading: "Payment confirmed", bodyHtml, preheader: `We've received your payment of Rs. ${input.amount.toLocaleString()}` }),
    text: `${greeting} we've received your payment of Rs. ${input.amount.toLocaleString()} for ${input.description}.${input.receiptUrl ? ` Receipt: ${input.receiptUrl}` : ""}`,
  };
}

export function welcomeEmail(input: { name: string }) {
  const bodyHtml = `
    ${paragraph(`Hi ${input.name}, welcome to ${BRAND}!`)}
    ${paragraph("Your account is ready. You can now book consults, manage appointments, and chat with doctors from your dashboard.")}
  `;
  return {
    subject: `Welcome to ${BRAND}`,
    html: layout({ heading: `Welcome to ${BRAND}`, bodyHtml }),
    text: `Hi ${input.name}, welcome to ${BRAND}! Your account is ready.`,
  };
}

export type BookingConsultType = "online" | "clinic" | "sunday_free" | "home_visit" | "urgent_online";

/** Appointment facts shared by the patient and doctor booking emails — all from saved records. */
export type BookingEmailDetails = {
  appointmentId: string;
  type: BookingConsultType;
  status: string;
  scheduledStart: Date;
  timezone?: string;
  /** Clinic consults: hospital/clinic name and address, when on file. */
  clinicAddress?: string;
  /** Home visits: the patient's visit address, when on file. */
  homeVisitAddress?: string;
};

const CONSULT_TYPE_LABELS: Record<BookingConsultType, string> = {
  online: "Online video consultation",
  clinic: "Clinic visit (in person)",
  sunday_free: "Sunday Free Consult (video)",
  home_visit: "Home visit",
  urgent_online: "Urgent care video consultation",
};

const VIDEO_TYPES: readonly BookingConsultType[] = ["online", "sunday_free", "urgent_online"];

export function consultTypeLabel(type: BookingConsultType): string {
  return CONSULT_TYPE_LABELS[type];
}

/** Short human-quotable reference, e.g. "ZC-3F9A21BC" (last 8 hex of the appointment id). */
export function bookingReference(appointmentId: string): string {
  return `ZC-${appointmentId.slice(-8).toUpperCase()}`;
}

/** "Sunday, 19 October 2026" + "3:30 PM PKT" in the appointment's own timezone. */
export function formatBookingSchedule(start: Date, timezone = "Asia/Karachi") {
  const date = start.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: timezone,
  });
  const time = start
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone,
    })
    .toUpperCase();
  const zone = timezone === "Asia/Karachi" ? "PKT" : timezone;
  return { date, time: `${time} ${zone}` };
}

function statusLabel(status: string): string {
  const spaced = status.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function button(label: string, url: string): string {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 22px;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">${escapeHtml(label)}</a>`;
}

function summaryTable(rows: [string, string][]): string {
  const body = rows
    .map(
      ([label, value]) => `<tr>
        <td style="padding:8px 0;font-size:13px;color:#475569;vertical-align:top;width:40%;">${escapeHtml(label)}</td>
        <td style="padding:8px 0;font-size:14px;color:${BRAND_INK};font-weight:600;vertical-align:top;">${escapeHtml(value)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;padding:8px 16px;background:${BRAND_TINT};border-left:4px solid ${BRAND_ACCENT};border-radius:8px;">${body}</table>`;
}

function supportLine(support: { email: string; phone: string }) {
  return {
    html: `<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#475569;">Need help? Email <a href="mailto:${escapeHtml(support.email)}" style="color:${BRAND_COLOR};">${escapeHtml(support.email)}</a> or WhatsApp ${escapeHtml(support.phone)}.</p>`,
    text: `Need help? Email ${support.email} or WhatsApp ${support.phone}.`,
  };
}

function textBlock(rows: [string, string][]): string {
  return rows.map(([label, value]) => `${label}: ${value}`).join("\n");
}

/** Reminder to a doctor who signed up but never submitted the verification form. */
export function doctorCompleteProfileReminderEmail(input: {
  name?: string;
  verificationUrl: string;
  support: { email: string; phone: string };
}) {
  const greeting = input.name ? `Dear ${input.name},` : "Dear Doctor,";
  const intro = `Thank you for signing up with ${BRAND}. Your doctor profile is not complete yet, so we can't review your application or list you for patients.`;
  const steps = [
    "Sign in to your ZindagiCare account",
    "Fill in your specialty, PMDC number and experience",
    "Upload your PMDC certificate and CNIC",
    "Submit the form for review",
  ];
  const outro = "Once you submit, our team will review your documents and contact you for the next step.";
  const support = supportLine(input.support);

  const bodyHtml = `
    ${paragraph(greeting)}
    ${paragraph(intro)}
    <ol style="margin:0 0 20px;padding-left:20px;font-size:15px;line-height:1.7;color:#334155;">
      ${steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
    </ol>
    <p style="margin:0 0 20px;">${button("Complete my profile", input.verificationUrl)}</p>
    ${paragraph(outro)}
    ${support.html}
  `;

  const subject = `Complete your profile to join ${BRAND}`;
  return {
    subject,
    html: layout({
      heading: "Complete your doctor profile",
      bodyHtml,
      preheader: "A few minutes is all it takes to finish your registration.",
    }),
    text: [
      greeting,
      intro,
      steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
      `Complete your profile: ${input.verificationUrl}`,
      outro,
      support.text,
    ].join("\n\n"),
  };
}

/** Patient-facing "your consultation is confirmed" email. */
export function patientBookingConfirmationEmail(input: {
  patientName?: string;
  doctorName: string;
  doctorSpecialty?: string;
  details: BookingEmailDetails;
  dashboardUrl: string;
  /** Video consults: authenticated join page (the live link opens near start time). */
  joinUrl?: string;
  support: { email: string; phone: string };
}) {
  const { details } = input;
  const { date, time } = formatBookingSchedule(details.scheduledStart, details.timezone);
  const greeting = input.patientName ? `Hi ${input.patientName},` : "Hi,";
  const rows: [string, string][] = [
    ["Doctor", input.doctorName],
    ...(input.doctorSpecialty ? ([["Specialization", input.doctorSpecialty]] as [string, string][]) : []),
    ["Date", date],
    ["Time", time],
    ["Consultation type", consultTypeLabel(details.type)],
    ["Booking reference", bookingReference(details.appointmentId)],
    ["Status", statusLabel(details.status)],
  ];

  const instructions: string[] = [];
  if (VIDEO_TYPES.includes(details.type)) {
    instructions.push(
      details.type === "urgent_online"
        ? "Your doctor is ready now. Open your dashboard to join the video call."
        : "Join the video call from your dashboard a few minutes before the start time. The join button becomes active shortly before your consultation.",
    );
  }
  if (details.type === "clinic") {
    instructions.push(
      details.clinicAddress
        ? `Please arrive 10 minutes early at: ${details.clinicAddress}.`
        : "Please arrive 10 minutes early. The clinic address is shown on your dashboard.",
    );
  }
  if (details.type === "home_visit") {
    instructions.push(
      details.homeVisitAddress
        ? `Your provider will visit you at: ${details.homeVisitAddress}. Please keep your phone reachable on the day.`
        : "Your provider will confirm the visit address with you. Please keep your phone reachable on the day.",
    );
  }

  const support = supportLine(input.support);
  const bodyHtml = `
    ${paragraph(greeting)}
    ${paragraph(`Your consultation with ${input.doctorName} is confirmed. Here are your booking details:`)}
    ${summaryTable(rows)}
    ${instructions.map(paragraph).join("")}
    <p style="margin:0 0 12px;">${button("View appointment", input.dashboardUrl)}</p>
    ${input.joinUrl ? `<p style="margin:0 0 12px;">${button("Join video consultation", input.joinUrl)}</p>` : ""}
    ${support.html}
  `;

  const subject = `Your Consultation Is Confirmed | ${BRAND}`;
  return {
    subject,
    html: layout({
      heading: "Your consultation is confirmed",
      bodyHtml,
      preheader: `${input.doctorName} · ${date}, ${time}`,
    }),
    text: [
      greeting,
      "",
      `Your consultation with ${input.doctorName} is confirmed.`,
      "",
      textBlock(rows),
      ...(instructions.length ? ["", ...instructions] : []),
      "",
      `View appointment: ${input.dashboardUrl}`,
      ...(input.joinUrl ? [`Join video consultation: ${input.joinUrl}`] : []),
      "",
      support.text,
    ].join("\n"),
  };
}

/**
 * Doctor-facing "new consultation booking" email. Deliberately carries no
 * patient email, phone, notes or medical history — the doctor reads those in
 * the authenticated dashboard. A home-visit address is included because the
 * doctor needs it to travel.
 */
export function doctorNewBookingEmail(input: {
  doctorName: string;
  patientName: string;
  details: BookingEmailDetails;
  dashboardUrl: string;
  support: { email: string; phone: string };
}) {
  const { details } = input;
  const { date, time } = formatBookingSchedule(details.scheduledStart, details.timezone);
  const rows: [string, string][] = [
    ["Patient", input.patientName],
    ["Date", date],
    ["Time", time],
    ["Consultation type", consultTypeLabel(details.type)],
    ["Booking reference", bookingReference(details.appointmentId)],
    ["Status", statusLabel(details.status)],
    ...(details.type === "home_visit" && details.homeVisitAddress
      ? ([["Visit location", details.homeVisitAddress]] as [string, string][])
      : []),
    ...(details.type === "clinic" && details.clinicAddress
      ? ([["Clinic", details.clinicAddress]] as [string, string][])
      : []),
  ];

  const instruction =
    details.type === "urgent_online"
      ? "This patient is waiting now — please join the video call within 5–10 minutes."
      : VIDEO_TYPES.includes(details.type)
        ? "Review the patient's intake in your dashboard before the call and join on time."
        : details.type === "home_visit"
          ? "Review the visit details in your dashboard and contact the patient through ZindagiCare before you travel."
          : "Review the patient's intake in your dashboard before the visit.";

  const greeting = `Hi ${input.doctorName},`;
  const support = supportLine(input.support);
  const bodyHtml = `
    ${paragraph(greeting)}
    ${paragraph(`${input.patientName} has booked a consultation with you.`)}
    ${summaryTable(rows)}
    ${paragraph(instruction)}
    <p style="margin:0 0 12px;">${button("View in dashboard", input.dashboardUrl)}</p>
    ${support.html}
  `;

  return {
    subject: `New Consultation Booking | ${BRAND}`,
    html: layout({
      heading: "New consultation booking",
      bodyHtml,
      preheader: `${input.patientName} · ${date}, ${time}`,
    }),
    text: [
      greeting,
      "",
      `${input.patientName} has booked a consultation with you.`,
      "",
      textBlock(rows),
      "",
      instruction,
      "",
      `View in dashboard: ${input.dashboardUrl}`,
      "",
      support.text,
    ].join("\n"),
  };
}
