/**
 * Pure rules for "your question has an answer" notifications: wording,
 * preview boundaries, masking, the click-through link, and the
 * after-response scheduler. No database.
 */
const afterMock = jest.fn();
jest.mock("next/server", () => ({ after: (fn: () => unknown) => afterMock(fn) }));

const notifyMock = jest.fn();
jest.mock("@/server/services/medical-qa-answer-notify.service", () => ({
  notifyQuestionAnswered: (...args: unknown[]) => notifyMock(...args),
}));

import { resolveNotificationHref } from "@/lib/notifications/resolve-notification-href";
import { scheduleAnswerNotification } from "@/server/lib/schedule-answer-notification";

// The real builder, bypassing the module mock above (it only stubs the notifier).
const { buildAnswerNotificationContent } = jest.requireActual<
  typeof import("@/server/services/medical-qa-answer-notify.service")
>("@/server/services/medical-qa-answer-notify.service");

const QID = "0123456789abcdef01234567";
const AID = "89abcdef0123456789abcdef";

const build = (questionTitle: string, answererRole = "doctor") =>
  buildAnswerNotificationContent({ questionId: QID, answerId: AID, questionTitle, answererRole });

/** The preview text between the quotes in the body. */
const previewOf = (body: string) => body.match(/answered "([\s\S]*)" — tap/)?.[1];

describe("buildAnswerNotificationContent — normal cases", () => {
  test.each([
    ["doctor", "A doctor"],
    ["nurse", "A nurse"],
    ["physiotherapist", "A physiotherapist"],
  ])("names the %s role only", (role, label) => {
    const c = build("Fever and body ache for two days", role);
    expect(c.title).toBe("Your question has an answer");
    expect(c.body).toBe(`${label} answered "Fever and body ache for two days" — tap to read it.`);
  });

  test("links to the question and carries ids only", () => {
    const c = build("Fever and body ache for two days");
    expect(c.url).toBe(`/questions/${QID}`);
    expect(c.payload).toEqual({
      type: "medical_question_answered",
      questionId: QID,
      answerId: AID,
      url: `/questions/${QID}`,
    });
  });
});

describe("buildAnswerNotificationContent — role edge cases", () => {
  test.each(["patient", "admin", "", "DOCTOR"])("unexpected role %p falls back to a neutral label", (role) => {
    expect(build("Fever and body ache for two days", role).body).toMatch(/^A professional answered/);
  });

  test.each(["constructor", "__proto__", "toString", "hasOwnProperty"])(
    "prototype key %p never leaks into the text",
    (role) => {
      const { body } = build("Fever and body ache for two days", role);
      expect(body).toMatch(/^A professional answered/);
      expect(body).not.toMatch(/function|native code|\[object/);
    },
  );
});

describe("buildAnswerNotificationContent — preview boundaries", () => {
  test("exactly 80 characters is kept whole", () => {
    const title = "a".repeat(80);
    expect(previewOf(build(title).body)).toBe(title);
  });

  test("81 characters is cut to 80 with an ellipsis", () => {
    const preview = previewOf(build("a".repeat(81)).body)!;
    expect(Array.from(preview)).toHaveLength(80);
    expect(preview.endsWith("…")).toBe(true);
  });

  test("the maximum title length (150) is truncated", () => {
    const preview = previewOf(build("b".repeat(150)).body)!;
    expect(Array.from(preview).length).toBeLessThanOrEqual(80);
  });

  test("truncation never splits a multi-byte character (Urdu / emoji)", () => {
    const title = "بخار ".repeat(30) + "🤒🤒";
    const preview = previewOf(build(title).body)!;
    expect(preview).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/); // no lone high surrogate
    expect(Array.from(preview).length).toBeLessThanOrEqual(80);
  });

  test("an emoji at the cut point stays intact", () => {
    const title = "x".repeat(79) + "😷" + "y";
    const preview = previewOf(build(title).body)!;
    expect(preview).toBe("x".repeat(79) + "…");
  });

  test("whitespace and newlines collapse to single spaces", () => {
    expect(previewOf(build("  Fever\n\n\tand   cough  ").body)).toBe("Fever and cough");
  });

  test("control and bidi-override characters are stripped", () => {
    expect(previewOf(build("Fever\u0000\u0007 and ‮cough‬").body)).toBe("Fever and cough");
  });

  test("a title that is empty after normalizing uses the generic sentence", () => {
    expect(build("   \u0000  ").body).toBe("A doctor answered your question — tap to read it.");
  });

  test("HTML stays inert plain text (rendered as text by every surface)", () => {
    const { body } = build('<img src=x onerror="alert(1)"> rash');
    expect(body).toContain('<img src=x onerror="alert(1)"> rash');
  });
});

describe("buildAnswerNotificationContent — identifier masking boundaries", () => {
  test("an email address is masked", () => {
    expect(previewOf(build("Contact me at someone@example.com about rash").body)).toBe(
      "Contact me at [email] about rash",
    );
  });

  test("7+ digit numbers (phones, CNIC) are masked", () => {
    expect(previewOf(build("Call 0300-1234567 please").body)).toBe("Call [number] please");
    expect(previewOf(build("CNIC 35202-1234567-1 issue").body)).toBe("CNIC [number] issue");
    expect(previewOf(build("Number +92 300 1234567 now").body)).toBe("Number [number] now");
  });

  test("exactly 7 digits is masked; 6 digits is kept", () => {
    expect(previewOf(build("ref 123 4567 here").body)).toBe("ref [number] here");
    expect(previewOf(build("ref 123 456 here").body)).toBe("ref 123 456 here");
  });

  test("ordinary medical numbers stay readable", () => {
    expect(previewOf(build("Fever 102F for 3 days, took 500mg").body)).toBe("Fever 102F for 3 days, took 500mg");
  });
});

describe("resolveNotificationHref — medical_question_answered", () => {
  const href = (questionId: unknown, roles: never[] = []) =>
    resolveNotificationHref({ type: "medical_question_answered", questionId }, roles);

  test("a valid id links to the question for any viewer role", () => {
    expect(href(QID)).toBe(`/questions/${QID}`);
    expect(resolveNotificationHref({ type: "medical_question_answered", questionId: QID }, ["patient" as never])).toBe(
      `/questions/${QID}`,
    );
  });

  test("uppercase hex is accepted", () => {
    expect(href(QID.toUpperCase())).toBe(`/questions/${QID.toUpperCase()}`);
  });

  test.each([
    ["23 chars", QID.slice(1)],
    ["25 chars", QID + "0"],
    ["non-hex", "g123456789abcdef01234567"],
    ["path traversal", "../../admin/users"],
    ["absolute URL", "https://evil.example/x"],
    ["encoded slash", "0123456789abcdef0123%2F67"],
    ["empty", ""],
  ])("rejects %s", (_label, id) => {
    expect(href(id)).toBeNull();
  });

  test.each([null, undefined, 123, {}, ["0123456789abcdef01234567"]])("rejects non-string id %p", (id) => {
    expect(href(id)).toBeNull();
  });

  test("ignores a payload-supplied url (only the id decides the link)", () => {
    expect(
      resolveNotificationHref({ type: "medical_question_answered", questionId: QID, url: "https://evil.example" }, []),
    ).toBe(`/questions/${QID}`);
  });
});

describe("scheduleAnswerNotification", () => {
  beforeEach(() => {
    afterMock.mockReset();
    notifyMock.mockReset().mockResolvedValue({ notified: true, push: "sent" });
  });

  const flush = () => new Promise((r) => setImmediate(r));

  test("defers the work with after() instead of running it inline", async () => {
    scheduleAnswerNotification(AID);
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).not.toHaveBeenCalled();
    await afterMock.mock.calls[0][0]();
    expect(notifyMock).toHaveBeenCalledWith(AID);
  });

  test("outside a request scope it runs detached", async () => {
    afterMock.mockImplementation(() => {
      throw new Error("after() called outside a request scope");
    });
    expect(() => scheduleAnswerNotification(AID)).not.toThrow();
    await flush();
    expect(notifyMock).toHaveBeenCalledWith(AID);
  });

  test("a failing notifier is contained and logged without content", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
    notifyMock.mockRejectedValue(new TypeError("db exploded with secret text"));
    scheduleAnswerNotification(AID);
    await expect(afterMock.mock.calls[0][0]()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith("[medical-qa-answer-notify] background run failed", {
      answerId: AID,
      error: "TypeError",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret text");
    log.mockRestore();
  });
});
