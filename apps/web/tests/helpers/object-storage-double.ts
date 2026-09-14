/**
 * In-memory stand-in for Supabase object storage, used only in tests.
 *
 * Real Supabase credentials live in apps/web/.env (production bucket) — tests
 * must never reach it. This double is wired in via `jest.mock("@/server/lib/object-storage", ...)`
 * with `jest.requireActual` spread in first, so the REAL validateStorageKey,
 * objectKey, and contentTypeFromKey (the actual path-traversal / content-type
 * logic under test) still run; only the network-bound putObject/getObject/
 * deleteObject are replaced by this in-memory Map.
 *
 * Because the mock replaces getObject() wholesale (not just the underlying
 * Supabase client call inside it), this double must also replicate getObject's
 * own not-found -> AppError("File not found", "NOT_FOUND", 404) translation
 * (see mapStorageError in ../../src/server/lib/object-storage.ts) — otherwise
 * tests would see a 500 here while production sees the fixed 404.
 */
import { AppError } from "@zindagi/shared";

export type StoredObject = { buffer: Buffer; contentType: string };

export function buildObjectStorageDouble() {
  const store = new Map<string, StoredObject>();
  let failNextPut: Error | null = null;
  let failNextGet: Error | null = null;
  let putDelayMs = 0;

  const notFound = () => new AppError("File not found", "NOT_FOUND", 404);

  return {
    store,
    setFailNextPut(err: Error | null) {
      failNextPut = err;
    },
    setFailNextGet(err: Error | null) {
      failNextGet = err;
    },
    setPutDelayMs(ms: number) {
      putDelayMs = ms;
    },
    async putObject(namespace: string, storageKey: string, body: Buffer, contentType: string) {
      if (putDelayMs > 0) await new Promise((r) => setTimeout(r, putDelayMs));
      if (failNextPut) {
        const err = failNextPut;
        failNextPut = null;
        throw err;
      }
      store.set(`${namespace}/${storageKey}`, { buffer: Buffer.from(body), contentType });
    },
    async getObject(namespace: string, storageKey: string) {
      if (failNextGet) {
        const err = failNextGet;
        failNextGet = null;
        throw err;
      }
      const entry = store.get(`${namespace}/${storageKey}`);
      if (!entry) throw notFound();
      return entry.buffer;
    },
    async deleteObject(namespace: string, storageKey: string) {
      store.delete(`${namespace}/${storageKey}`);
    },
  };
}
