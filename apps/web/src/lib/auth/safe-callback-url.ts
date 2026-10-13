const PLACEHOLDER_ORIGIN = "http://callback.invalid";

/**
 * Returns `value` as a same-site path (pathname + search + hash) when it is safe
 * to redirect to, otherwise undefined. Only root-relative paths are accepted, so
 * `https://evil.com`, `//evil.com`, `/\evil.com` and `javascript:` URLs — which
 * would send a user off-site after auth — are all rejected.
 */
export function safeCallbackUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return undefined;
  // Browsers treat `\` as `/`, and control characters can hide either.
  if (/[\\\u0000-\u001f\u007f]/.test(trimmed)) return undefined;

  let url: URL;
  try {
    url = new URL(trimmed, PLACEHOLDER_ORIGIN);
  } catch {
    return undefined;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return undefined;
  return `${url.pathname}${url.search}${url.hash}`;
}
