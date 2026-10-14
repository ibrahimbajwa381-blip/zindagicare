/**
 * Pure rules behind new-question alerts: topic fallback, topic → professional
 * matching, privacy-safe preview content, quiet hours and retry backoff.
 * No database, no network.
 */
import { SPECIALTIES } from "@zindagi/shared";
import { createMedicalQuestionSchema, MedicalQaCategories } from "@zindagi/validators";
import {
  buildQuestionAlertContent,
  isQuietHours,
  QUESTION_ALERT_CONFIG,
  retryDelayMs,
  topicRecipientRule,
} from "@/server/lib/medical-qa-alert-rules";
import { resolveNotificationHref } from "@/lib/notifications/resolve-notification-href";

const base = {
  title: "Fever for three days in my child",
  body: "Synthetic body text that is long enough to pass validation.",
};

describe("question topic — default and validation", () => {
  test.each([
    ["missing", {}],
    ["null", { category: null }],
    ["empty string", { category: "" }],
    ["whitespace only", { category: "   \t " }],
  ])("%s topic is saved as general", (_label, extra) => {
    const parsed = createMedicalQuestionSchema.parse({ ...base, ...extra });
    expect(parsed.category).toBe("general");
  });

  test.each(MedicalQaCategories.map((c) => [c]))("valid topic %s is kept", (category) => {
    expect(createMedicalQuestionSchema.parse({ ...base, category }).category).toBe(category);
  });

  test("valid topic is normalized (surrounding spaces, letter case)", () => {
    expect(createMedicalQuestionSchema.parse({ ...base, category: "  Skin " }).category).toBe("skin");
  });

  test.each([
    ["unknown string", "cardiology"],
    ["operator object", { $ne: null }],
    ["number", 42],
    ["boolean", true],
    ["array", ["skin"]],
    ["prototype key", "__proto__"],
  ])("rejects %s without throwing anything but a validation error", (_label, category) => {
    const result = createMedicalQuestionSchema.safeParse({ ...base, category });
    expect(result.success).toBe(false);
  });

  test("a valid question is never rejected only because no topic was chosen", () => {
    expect(createMedicalQuestionSchema.safeParse(base).success).toBe(true);
  });
});

describe("topic → professional matching rules", () => {
  test("every topic has a rule", () => {
    for (const c of MedicalQaCategories) expect(topicRecipientRule(c)).toBeDefined();
  });

  test("physiotherapy → physiotherapists, nursing-care → nurses", () => {
    expect(topicRecipientRule("physiotherapy")).toEqual({ kind: "staff", staffType: "physiotherapist" });
    expect(topicRecipientRule("nursing-care")).toEqual({ kind: "staff", staffType: "nurse" });
  });

  test("general, medicines and other → all doctors (no specialty filter)", () => {
    for (const c of ["general", "medicines", "other"] as const) {
      expect(topicRecipientRule(c)).toEqual({ kind: "doctors", specialties: null });
    }
  });

  test.each([
    ["skin", "Dermatologist"],
    ["mental-health", "Psychiatrist"],
    ["heart-bp", "Cardiologist"],
    ["children", "Pediatrician"],
    ["women", "Gynecologist"],
    ["diabetes", "Diabetologist"],
    ["stomach", "Gastroenterologist"],
    ["bones-joints", "Orthopedic Surgeon"],
  ] as const)("%s matches doctors with the stored specialty %s", (topic, specialty) => {
    const rule = topicRecipientRule(topic);
    expect(rule.kind).toBe("doctors");
    expect(rule.kind === "doctors" && rule.specialties).toContain(specialty);
  });

  test("every specialty used for matching exists in the platform's specialty list", () => {
    for (const c of MedicalQaCategories) {
      const rule = topicRecipientRule(c);
      if (rule.kind === "doctors" && rule.specialties) {
        for (const s of rule.specialties) expect(SPECIALTIES).toContain(s);
      }
    }
  });

  test("an unknown topic cannot widen matching", () => {
    expect(() => topicRecipientRule("__proto__" as never)).toThrow();
    expect(() => topicRecipientRule("constructor" as never)).toThrow();
  });
});

describe("alert content — privacy-safe preview", () => {
  const id = "65f000000000000000000001";

  test("title names the topic; body previews the public title only; link is the public question page", () => {
    const c = buildQuestionAlertContent({ id, category: "skin", title: "Itchy rash on arm" });
    expect(c.title).toBe("New question · Skin & hair");
    expect(c.body).toContain("Itchy rash on arm");
    expect(c.url).toBe(`/questions/${id}`);
    expect(c.payload).toEqual({ type: "medical_question_new", questionId: id, category: "skin", url: `/questions/${id}` });
  });

  test("long titles are cut to the preview limit on a character boundary", () => {
    const title = "ب".repeat(300);
    const c = buildQuestionAlertContent({ id, category: "general", title });
    const preview = c.body.match(/"(.*)"/)![1];
    expect(Array.from(preview).length).toBeLessThanOrEqual(QUESTION_ALERT_CONFIG.previewMaxChars);
    expect(preview.endsWith("…")).toBe(true);
  });

  test("phone numbers, CNICs and emails typed into the title are masked", () => {
    const c = buildQuestionAlertContent({
      id,
      category: "general",
      title: "Call me 0300-1234567 or +92 321 7654321, CNIC 35202-1234567-1, mail a.b@x.com",
    });
    expect(c.body).not.toMatch(/0300|1234567|7654321|35202|a\.b@x\.com/);
    expect(c.body).toContain("[number]");
    expect(c.body).toContain("[email]");
  });

  test("markup stays inert text and control/bidi characters are stripped", () => {
    const c = buildQuestionAlertContent({ id, category: "general", title: "<img src=x onerror=alert(1)>‮\u0007 pain" });
    expect(c.body).toContain("<img src=x onerror=alert(1)>");
    expect(c.body).not.toMatch(/[‮\u0007]/);
  });

  test("newlines collapse to single spaces", () => {
    const c = buildQuestionAlertContent({ id, category: "general", title: "line one\n\nline two" });
    expect(c.body).toContain("line one line two");
  });

  test("an empty preview falls back to a generic sentence", () => {
    const c = buildQuestionAlertContent({ id, category: "general", title: "   " });
    expect(c.body).toBe("A new question is waiting in your area of expertise.");
  });

  test("the notification link opens the public question page", () => {
    const c = buildQuestionAlertContent({ id, category: "general", title: "x" });
    expect(resolveNotificationHref(c.payload, [])).toBe(`/questions/${id}`);
  });

  test("a tampered payload id never produces a link", () => {
    expect(resolveNotificationHref({ type: "medical_question_new", questionId: "../admin" }, [])).toBeNull();
    expect(resolveNotificationHref({ type: "medical_question_new", questionId: { $ne: 1 } }, [])).toBeNull();
  });
});

describe("quiet hours (Asia/Karachi, UTC+5)", () => {
  // 22:00–08:00 PKT == 17:00–03:00 UTC
  test.each([
    ["2026-10-14T16:59:00Z", false], // 21:59 PKT
    ["2026-10-14T17:00:00Z", true], // 22:00 PKT
    ["2026-10-14T21:30:00Z", true], // 02:30 PKT
    ["2026-10-15T02:59:00Z", true], // 07:59 PKT
    ["2026-10-15T03:00:00Z", false], // 08:00 PKT
    ["2026-10-15T09:00:00Z", false], // 14:00 PKT
  ])("%s → quiet=%s", (iso, quiet) => {
    expect(isQuietHours(new Date(iso))).toBe(quiet);
  });
});

describe("retry backoff", () => {
  test("grows with each attempt and is bounded", () => {
    const delays = [1, 2, 3, 4, 10].map(retryDelayMs);
    expect(delays[0]).toBeLessThan(delays[1]);
    expect(delays[1]).toBeLessThan(delays[2]);
    expect(Math.max(...delays)).toBeLessThanOrEqual(60 * 60 * 1000);
  });
});
