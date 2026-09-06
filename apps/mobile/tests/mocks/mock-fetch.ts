type Envelope<T> = { success: true; data: T; error: null } | { success: false; data: null; error: { code: string; message: string } };

export function okEnvelope<T>(data: T): Envelope<T> {
  return { success: true, data, error: null };
}

export function errEnvelope(message: string, code = "ERROR"): Envelope<never> {
  return { success: false, data: null, error: { code, message } };
}

/** Installs globalThis.fetch to resolve `body` (JSON-stringified) for every call, once. */
export function mockFetchOnce(body: unknown, status = 200) {
  const mock = globalThis.fetch as jest.Mock;
  mock.mockImplementationOnce(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as Response),
  );
}

/** Installs globalThis.fetch to resolve `body` for every subsequent call (no queueing). */
export function mockFetchAlways(body: unknown, status = 200) {
  const mock = globalThis.fetch as jest.Mock;
  mock.mockImplementation(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as Response),
  );
}
