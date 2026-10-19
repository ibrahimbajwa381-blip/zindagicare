/**
 * QA-XSS — Stored/DOM XSS in public medical Q&A rendering.
 *
 * Questions and answers are written by one user and viewed by every other
 * visitor, so any rendering bug is stored XSS against the whole site. These
 * tests server-render the real components (react-dom/server, same bytes a
 * browser would receive) with attacker-controlled text and assert nothing
 * becomes markup. Text is never linkified or parsed as Markdown/HTML.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { en } from "@/i18n/dictionaries/en";

jest.mock("@/i18n/locale-provider", () => ({
  useTranslations: () => jest.requireActual("@/i18n/dictionaries/en").en,
  useLocale: () => ({ locale: "en" }),
}));

import { QaText } from "@/features/medical-qa/components/qa-text";
import { AnswerItem } from "@/features/medical-qa/components/answer-item";
import { QuestionCard } from "@/features/medical-qa/components/question-card";

const PAYLOADS = [
  "<script>alert(1)</script>",
  "<ScRiPt>alert(1)</sCrIpT>",
  "<img src=x onerror=alert(1)>",
  "<IMG SRC=x OnErRoR=alert(1)>",
  '<svg onload=alert(1)><script>alert(2)</script></svg>',
  "<svg><animate onbegin=alert(1) attributeName=x dur=1s>",
  '<iframe src="javascript:alert(1)"></iframe>',
  "<div><p><b><i><a href=javascript:alert(1)>nested</a></i></b></p>",
  "<<script>alert(1)//<</script>",
  "&lt;script&gt;alert(1)&lt;/script&gt;",
  "%3Cscript%3Ealert(1)%3C/script%3E",
  "[click me](javascript:alert(document.cookie))",
  "[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)",
  '"><script>alert(1)</script>',
  "' onmouseover='alert(1)",
  "</p></div><script>alert(1)</script>",
];

/**
 * Inspects only REAL tags in the markup. Escaped user text (`&lt;img …&gt;`)
 * contains no raw `<`, so every `<…>` here was produced by our components.
 * Icon SVGs from lucide-react are the only SVGs allowed.
 */
const FORBIDDEN_TAGS = new Set(["script", "img", "iframe", "animate", "object", "embed", "style", "link", "meta", "base", "form"]);

function assertInert(html: string, payload?: string) {
  const tags = html.match(/<\/?[a-zA-Z][^>]*>/g) ?? [];
  let insideIcon = 0;
  for (const tag of tags) {
    const name = /^<\/?([a-zA-Z0-9-]+)/.exec(tag)![1].toLowerCase();
    expect(FORBIDDEN_TAGS.has(name) ? tag : null).toBeNull();
    if (name === "svg" && !tag.startsWith("</")) {
      expect(tag).toMatch(/class="lucide /);
      insideIcon += 1;
    }
    if (name === "svg" && tag.startsWith("</")) insideIcon -= 1;
    if (insideIcon === 0 && !["svg", "path", "circle", "rect", "line", "polyline"].includes(name)) {
      // no event-handler attributes on any element
      expect(tag).not.toMatch(/\son[a-z]+\s*=/i);
    }
    expect(tag).not.toMatch(/(href|src|action|formaction)\s*=\s*["']?\s*(javascript|data|vbscript):/i);
  }
  if (payload?.includes("<")) {
    // The payload's angle brackets must have been escaped, not interpreted.
    expect(html).toContain(payload.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;"));
  }
}

const baseAnswer = {
  id: "507f1f77bcf86cd799439011",
  kind: "answer" as const,
  createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
  author: { displayName: "Dr. Test", role: "doctor" as const, verified: true },
};

const baseQuestion = {
  id: "507f1f77bcf86cd799439012",
  category: "general" as const,
  answerCount: 1,
  photoCount: 0,
  createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
};

describe("QaText", () => {
  it.each(PAYLOADS)("renders %p as inert text", (payload) => {
    const html = renderToStaticMarkup(createElement(QaText, { text: payload }));
    assertInert(html, payload);
  });

  it("keeps newlines as text (no <br> injection needed) and preserves medical symbols", () => {
    const text = "BP 140/90 & glucose <100 mg/dL\nTake ½ tab ≥ 2×/day";
    const html = renderToStaticMarkup(createElement(QaText, { text }));
    expect(html).toContain("BP 140/90 &amp; glucose &lt;100 mg/dL\nTake ½ tab ≥ 2×/day");
  });

  it("never creates clickable links, even from URL-looking or Markdown text", () => {
    const html = renderToStaticMarkup(
      createElement(QaText, { text: "see https://evil.test and [a](javascript:alert(1))" }),
    );
    expect(html).not.toMatch(/<a\s/i);
  });
});

describe("AnswerItem & QuestionCard — persistent payload viewed by another user", () => {
  it.each(PAYLOADS)("answer body %p is inert", (payload) => {
    assertInert(renderToStaticMarkup(createElement(AnswerItem, { answer: { ...baseAnswer, body: payload } })), payload);
  });

  it.each(PAYLOADS)("provider display name %p is inert", (payload) => {
    const answer = { ...baseAnswer, body: "ok", author: { ...baseAnswer.author, displayName: payload } };
    assertInert(renderToStaticMarkup(createElement(AnswerItem, { answer })), payload);
  });

  it.each(PAYLOADS)("question title/excerpt %p is inert", (payload) => {
    assertInert(
      renderToStaticMarkup(createElement(QuestionCard, { question: { ...baseQuestion, title: payload, excerpt: payload } })),
      payload,
    );
  });

  it("shows the verified badge only when the server says the provider is verified", () => {
    const verified = renderToStaticMarkup(createElement(AnswerItem, { answer: { ...baseAnswer, body: "ok" } }));
    const unverified = renderToStaticMarkup(
      createElement(AnswerItem, {
        answer: { ...baseAnswer, body: "ok", author: { ...baseAnswer.author, verified: false } },
      }),
    );
    expect(verified).toContain(en.medicalQa.verifiedBadge);
    expect(unverified).not.toContain(en.medicalQa.verifiedBadge);
  });
});

describe("static guard — no raw HTML sinks in the Q&A feature", () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  }

  it("never uses dangerouslySetInnerHTML, innerHTML or eval-like sinks", () => {
    const root = join(__dirname, "../../../src");
    const files = [
      ...walk(join(root, "features/medical-qa")),
      ...walk(join(root, "app/(marketing)/questions")),
    ].filter((f) => /\.(tsx?|jsx?)$/.test(f));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      expect({ file, hit: /dangerouslySetInnerHTML|\.innerHTML\s*=|outerHTML|insertAdjacentHTML|new Function\(|\beval\(/.test(src) }).toEqual({
        file,
        hit: false,
      });
    }
  });
});
