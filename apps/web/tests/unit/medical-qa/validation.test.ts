/**
 * QA-VAL — Centralized validation for the public medical Q&A feature.
 *
 * Validation's job here is shape/size/type enforcement and text
 * normalization. It deliberately does NOT strip "<script>"-looking text:
 * legitimate medical questions contain <, >, &, / and code-ish strings, and
 * XSS is prevented at render time (see rendering.test.ts), not by filtering.
 */
import {
  MEDICAL_QA_LIMITS,
  MedicalQaCategories,
  createMedicalQuestionSchema,
  createMedicalAnswerSchema,
  reportMedicalQaSchema,
  moderateMedicalQaReportSchema,
  listMedicalQuestionsQuerySchema,
  objectIdSchema,
  normalizeUserText,
} from "@zindagi/validators";

const validQuestion = {
  category: "general",
  title: "Persistent headache for two weeks",
  body: "I have had a dull headache behind my eyes every evening for two weeks.",
};

describe("normalizeUserText", () => {
  it("trims and converts CRLF to LF", () => {
    expect(normalizeUserText("  hello\r\nworld  ")).toBe("hello\nworld");
  });

  it("removes NUL and other C0 control characters but keeps tabs and newlines", () => {
    expect(normalizeUserText("a\u0000b\u0007c\td\ne")).toBe("abc\td\ne");
  });

  it("removes bidi override characters used for trojan-source style spoofing", () => {
    expect(normalizeUserText("safe‮txt.exe⁦x⁩")).toBe("safetxt.exex");
  });

  it("keeps ZWNJ/ZWJ which Urdu text legitimately needs", () => {
    const urdu = "سر‌درد اور بخار";
    expect(normalizeUserText(urdu)).toBe(urdu.normalize("NFC"));
  });

  it("collapses runs of 3+ blank lines to a single blank line", () => {
    expect(normalizeUserText("a\n\n\n\n\nb")).toBe("a\n\nb");
  });

  it("preserves clinically meaningful symbols untouched", () => {
    const clinical = "BP 140/90 mmHg; glucose <100 mg/dL & HbA1c ≥ 6.5% (Na+ 135–145 mEq/L), 1/2 tab ×2";
    expect(normalizeUserText(clinical)).toBe(clinical);
  });

  it("applies Unicode NFC normalization", () => {
    expect(normalizeUserText("café")).toBe("café");
  });
});

describe("createMedicalQuestionSchema", () => {
  it("accepts a valid question and normalizes text", () => {
    const parsed = createMedicalQuestionSchema.parse({ ...validQuestion, title: "  " + validQuestion.title + "  " });
    expect(parsed.title).toBe(validQuestion.title);
  });

  it.each([
    ["missing title", { ...validQuestion, title: undefined }],
    ["missing body", { ...validQuestion, body: undefined }],
    ["whitespace-only body", { ...validQuestion, body: "      \n\n   \t " }],
    ["title that is only control chars", { ...validQuestion, title: "\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\u0008\u000b\u000c" }],
    ["invalid category", { ...validQuestion, category: "astrology" }],
    ["category operator object", { ...validQuestion, category: { $ne: null } }],
    ["body as NoSQL operator object", { ...validQuestion, body: { $gt: "" } }],
    ["title as array", { ...validQuestion, title: ["a", "b"] }],
    ["number body", { ...validQuestion, body: 12345 }],
  ])("rejects %s", (_label, input) => {
    expect(createMedicalQuestionSchema.safeParse(input).success).toBe(false);
  });

  it.each(["authorId", "role", "isVerified", "status", "moderationStatus", "answerCount", "storageKey", "_id", "$where"])(
    "rejects client-supplied privileged field %s",
    (field) => {
      expect(createMedicalQuestionSchema.safeParse({ ...validQuestion, [field]: "x" }).success).toBe(false);
    },
  );

  it("enforces title length boundaries exactly", () => {
    const { titleMin, titleMax } = MEDICAL_QA_LIMITS;
    expect(createMedicalQuestionSchema.safeParse({ ...validQuestion, title: "a".repeat(titleMin) }).success).toBe(true);
    expect(createMedicalQuestionSchema.safeParse({ ...validQuestion, title: "a".repeat(titleMin - 1) }).success).toBe(false);
    expect(createMedicalQuestionSchema.safeParse({ ...validQuestion, title: "a".repeat(titleMax) }).success).toBe(true);
    expect(createMedicalQuestionSchema.safeParse({ ...validQuestion, title: "a".repeat(titleMax + 1) }).success).toBe(false);
  });

  it("enforces body length boundaries exactly (measured after trimming)", () => {
    const { bodyMin, bodyMax } = MEDICAL_QA_LIMITS;
    expect(createMedicalQuestionSchema.safeParse({ ...validQuestion, body: "b".repeat(bodyMax) }).success).toBe(true);
    expect(createMedicalQuestionSchema.safeParse({ ...validQuestion, body: "b".repeat(bodyMax + 1) }).success).toBe(false);
    expect(createMedicalQuestionSchema.safeParse({ ...validQuestion, body: "   " + "b".repeat(bodyMin - 1) + "   " }).success).toBe(false);
  });

  it("does not mangle script-looking text — XSS defence lives in rendering, not filtering", () => {
    const body = "My son typed <script>alert(1)</script> into my phone, is screen time bad for his eyes?";
    expect(createMedicalQuestionSchema.parse({ ...validQuestion, body }).body).toBe(body);
  });

  it("accepts an optional UUID idempotency key and rejects malformed ones", () => {
    const key = "3f1d3c8e-8a43-4d1e-9a0f-2b9b8e1c4d55";
    expect(createMedicalQuestionSchema.parse({ ...validQuestion, idempotencyKey: key }).idempotencyKey).toBe(key);
    expect(createMedicalQuestionSchema.safeParse({ ...validQuestion, idempotencyKey: { $ne: null } }).success).toBe(false);
    expect(createMedicalQuestionSchema.safeParse({ ...validQuestion, idempotencyKey: "not-a-uuid" }).success).toBe(false);
  });

  it("every category is a short slug", () => {
    for (const c of MedicalQaCategories) expect(c).toMatch(/^[a-z-]{2,30}$/);
  });
});

describe("createMedicalAnswerSchema", () => {
  it("accepts a plain answer", () => {
    expect(createMedicalAnswerSchema.parse({ body: "Please check your BP and drink water." }).body).toBe(
      "Please check your BP and drink water.",
    );
  });

  it.each([
    ["empty", { body: "" }],
    ["whitespace", { body: "   \n " }],
    ["too long", { body: "x".repeat(MEDICAL_QA_LIMITS.answerMax + 1) }],
    ["nested object", { body: { text: "hi" } }],
    ["unexpected questionId", { body: "fine answer", questionId: "507f1f77bcf86cd799439011" }],
    ["client verified flag", { body: "fine answer", verified: true }],
  ])("rejects %s", (_l, input) => {
    expect(createMedicalAnswerSchema.safeParse(input).success).toBe(false);
  });
});

describe("objectIdSchema", () => {
  it("accepts a 24-hex id", () => {
    expect(objectIdSchema.parse("507f1f77bcf86cd799439011")).toBe("507f1f77bcf86cd799439011");
  });
  it.each(["", "abc", "507f1f77bcf86cd79943901z", "507f1f77bcf86cd7994390111", '{"$ne":null}', "../../etc"])(
    "rejects %p",
    (v) => {
      expect(objectIdSchema.safeParse(v).success).toBe(false);
    },
  );
  it("rejects operator objects", () => {
    expect(objectIdSchema.safeParse({ $ne: null }).success).toBe(false);
  });
});

describe("listMedicalQuestionsQuerySchema", () => {
  it("applies a default page size", () => {
    expect(listMedicalQuestionsQuerySchema.parse({}).limit).toBe(MEDICAL_QA_LIMITS.pageSizeDefault);
  });
  it.each(["0", "-1", "NaN", "Infinity", "1e9", String(MEDICAL_QA_LIMITS.pageSizeMax + 1), "2.5"])(
    "rejects limit=%s",
    (limit) => {
      expect(listMedicalQuestionsQuerySchema.safeParse({ limit }).success).toBe(false);
    },
  );
  it("rejects a malformed cursor", () => {
    expect(listMedicalQuestionsQuerySchema.safeParse({ cursor: "{$gt:0}" }).success).toBe(false);
  });
  it("accepts the unanswered filter used by provider dashboards", () => {
    expect(listMedicalQuestionsQuerySchema.parse({ filter: "unanswered" }).filter).toBe("unanswered");
  });
});

describe("report and moderation schemas", () => {
  it("accepts a valid report", () => {
    expect(
      reportMedicalQaSchema.parse({ targetType: "answer", targetId: "507f1f77bcf86cd799439011", reason: "dangerous" }),
    ).toMatchObject({ targetType: "answer", reason: "dangerous" });
  });
  it.each([
    { targetType: "user", targetId: "507f1f77bcf86cd799439011", reason: "spam" },
    { targetType: "answer", targetId: { $ne: null }, reason: "spam" },
    { targetType: "answer", targetId: "507f1f77bcf86cd799439011", reason: "boring" },
    { targetType: "answer", targetId: "507f1f77bcf86cd799439011", reason: "spam", details: "x".repeat(MEDICAL_QA_LIMITS.reportDetailsMax + 1) },
  ])("rejects invalid report %#", (input) => {
    expect(reportMedicalQaSchema.safeParse(input).success).toBe(false);
  });
  it("moderation accepts only known actions", () => {
    expect(moderateMedicalQaReportSchema.safeParse({ reportId: "507f1f77bcf86cd799439011", action: "hide" }).success).toBe(true);
    expect(moderateMedicalQaReportSchema.safeParse({ reportId: "507f1f77bcf86cd799439011", action: "delete_user" }).success).toBe(false);
  });
});
