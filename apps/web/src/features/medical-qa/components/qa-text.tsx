import { cn } from "@zindagi/shared";

/**
 * The only way Q&A user text reaches the page: a React text node, so the
 * browser always treats it as text (escaped), never as HTML. Deliberately no
 * Markdown, no HTML and no auto-linking — that removes the javascript:/data:
 * link and sanitizer-bypass classes entirely. Newlines are kept via CSS;
 * `dir="auto"` lets Urdu and English lines each read the right way.
 */
export function QaText({ text, className }: { text: string; className?: string }) {
  return (
    <p dir="auto" className={cn("whitespace-pre-wrap break-words", className)}>
      {text}
    </p>
  );
}
