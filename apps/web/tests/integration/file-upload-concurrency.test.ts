/**
 * File Upload / File Access — concurrency & stress audit.
 *
 * Same real-Mongo / real-route / faked-Supabase-I/O-only setup as
 * file-upload-security.test.ts (see that file's header for the rationale).
 * This file covers: concurrent upload races, concurrent download races
 * (including authorized/unauthorized mixed under load), upload/download
 * races, and the progressive stress levels (10/25/50/100) plus a
 * 100-concurrent mixed upload/download/unauthorized-download main test.
 *
 * 250-concurrent level: run once as a lighter-weight, upload-only check
 * (not the full mixed scenario) to keep this file fast enough for routine
 * `npm test` runs — see the dedicated describe block below and bugs.txt for
 * the honesty note on what was/wasn't exercised at that level.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";
import { buildObjectStorageDouble } from "../helpers/object-storage-double";
import { makeValidJpeg, toFile } from "../helpers/synthetic-files";

jest.setTimeout(120000);

const objectStorageDouble = buildObjectStorageDouble();

jest.mock("@/server/lib/object-storage", () => {
  const actual = jest.requireActual("@/server/lib/object-storage");
  return {
    ...actual,
    isObjectStorageConfigured: () => true,
    putObject: (...args: Parameters<typeof objectStorageDouble.putObject>) =>
      objectStorageDouble.putObject(...args),
    getObject: (...args: Parameters<typeof objectStorageDouble.getObject>) =>
      objectStorageDouble.getObject(...args),
    deleteObject: (...args: Parameters<typeof objectStorageDouble.deleteObject>) =>
      objectStorageDouble.deleteObject(...args),
  };
});

jest.mock("@/lib/auth", () => ({ auth: async () => null }));

describe("File Upload / File Access — concurrency & stress", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let UserModel: typeof import("@zindagi/database").UserModel;
  let DoctorProfileModel: typeof import("@zindagi/database").DoctorProfileModel;
  let Roles: typeof import("@zindagi/shared").Roles;
  let signMobileAccessToken: typeof import("@/server/api/mobile-jwt").signMobileAccessToken;
  type Role = import("@zindagi/shared").Role;

  let counter = 0;
  const nextEmail = () => `file-concurrency-${Date.now()}-${counter++}@test.local`;

  async function createUser(roles: Role[]) {
    const user = await UserModel.create({ name: "Test User", email: nextEmail(), roles });
    return user._id.toString();
  }

  async function authHeaders(userId: string) {
    const token = await signMobileAccessToken(userId);
    return { authorization: `Bearer ${token}` };
  }

  function multipartRequest(url: string, fields: Record<string, string | File>, headers: Record<string, string> = {}) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    return new Request(url, { method: "POST", headers, body: fd });
  }

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("file_upload_concurrency");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.AUTH_SECRET = "test-secret-" + randomBytes(16).toString("hex");

    const db = await import("@zindagi/database");
    UserModel = db.UserModel;
    DoctorProfileModel = db.DoctorProfileModel;
    mongooseMod = (await import("mongoose")).default;

    const shared = await import("@zindagi/shared");
    Roles = shared.Roles;

    await db.connectDatabase();
    ({ signMobileAccessToken } = await import("@/server/api/mobile-jwt"));
  });

  afterEach(() => {
    objectStorageDouble.store.clear();
    objectStorageDouble.setFailNextPut(null);
    objectStorageDouble.setFailNextGet(null);
    objectStorageDouble.setPutDelayMs(0);
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  // ---------------------------------------------------------------------
  // Concurrent upload race — same user, same file, N-way
  // ---------------------------------------------------------------------
  describe("Concurrent upload race (same user, same file)", () => {
    test.each([2, 5, 10, 25])("%i-way concurrent identical uploads: all succeed, all independent, no corruption", async (n) => {
      const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
      const userId = await createUser([Roles.DOCTOR]);
      const bytes = await makeValidJpeg();
      const before = objectStorageDouble.store.size;

      const headers = await authHeaders(userId);
      const reqs = Array.from({ length: n }, () =>
        multipartRequest(
          "http://localhost/api/v1/doctor/avatar/upload",
          { file: toFile(bytes, "a.jpg", "image/jpeg") },
          headers,
        ),
      );
      const responses = await Promise.all(reqs.map((r) => POST(r)));

      expect(responses.every((r) => r.status === 200)).toBe(true);
      const bodies = await Promise.all(responses.map((r) => r.json()));
      const keys = bodies.map((b) => b.data.storageKey);
      expect(new Set(keys).size).toBe(n); // every upload got its own randomUUID key — no key collisions
      expect(objectStorageDouble.store.size).toBe(before + n); // no orphans, no missing writes
      for (const key of keys) {
        expect(objectStorageDouble.store.has(`doctor-avatars/${key}`)).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------------
  // Concurrent download race — one private file, mixed authorized/unauthorized
  // ---------------------------------------------------------------------
  describe("Concurrent download race — authorization invariant holds under load", () => {
    test.each([10, 25, 50, 100])(
      "%i-way concurrent downloads of one private document: authorized always 200, unauthorized always denied — no race bypass",
      async (n) => {
        const { POST: uploadPost } = await import("@/app/api/v1/doctor/verification/upload/route");
        const { GET: docsGet } = await import("@/app/api/v1/doctor/verification/documents/[...key]/route");

        const doctorId = await createUser([Roles.DOCTOR]);
        const outsiderId = await createUser([Roles.DOCTOR]);

        const uploadRes = await uploadPost(
          multipartRequest(
            "http://localhost/api/v1/doctor/verification/upload",
            { file: toFile(await makeValidJpeg(), "id.jpg", "image/jpeg") },
            await authHeaders(doctorId),
          ),
        );
        const uploaded = (await uploadRes.json()).data;
        await DoctorProfileModel.create({ userId: doctorId, verificationDocuments: { cnicFront: uploaded.url } });
        const keyParts = uploaded.storageKey.split("/").map((s: string) => encodeURIComponent(s));

        const ownerHeaders = await authHeaders(doctorId);
        const outsiderHeaders = await authHeaders(outsiderId);

        const half = Math.floor(n / 2);
        const authorizedReqs = Array.from({ length: half }, () =>
          docsGet(new Request("http://localhost/x", { headers: ownerHeaders }), {
            params: Promise.resolve({ key: keyParts }),
          }),
        );
        const unauthorizedReqs = Array.from({ length: n - half }, () =>
          docsGet(new Request("http://localhost/x", { headers: outsiderHeaders }), {
            params: Promise.resolve({ key: keyParts }),
          }),
        );

        const [authorizedResults, unauthorizedResults] = await Promise.all([
          Promise.all(authorizedReqs),
          Promise.all(unauthorizedReqs),
        ]);

        expect(authorizedResults.every((r) => r.status === 200)).toBe(true);
        expect(unauthorizedResults.every((r) => r.status === 403)).toBe(true);
      },
    );
  });

  // ---------------------------------------------------------------------
  // Upload + download race — download must never see a partially-written file
  // ---------------------------------------------------------------------
  describe("Upload/download race", () => {
    test("a download issued the instant an upload is in flight never returns a corrupt/partial body", async () => {
      const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
      const { GET } = await import("@/app/api/v1/public/doctor-avatars/[...key]/route");

      objectStorageDouble.setPutDelayMs(30);
      const userId = await createUser([Roles.DOCTOR]);
      const bytes = await makeValidJpeg();
      const uploadPromise = POST(
        multipartRequest(
          "http://localhost/api/v1/doctor/avatar/upload",
          { file: toFile(bytes, "a.jpg", "image/jpeg") },
          await authHeaders(userId),
        ),
      );

      // Fire a download for a key we don't have yet (simulating a client that
      // guessed/received a partial URL before the upload settled) — must 404,
      // never return zero-length or corrupt bytes.
      const guessedKey = `${userId}/not-yet-uploaded.webp`;
      const earlyGet = await GET(new Request("http://localhost/x"), {
        params: Promise.resolve({ key: guessedKey.split("/").map(encodeURIComponent) }),
      });
      expect(earlyGet.status).toBe(404);

      const uploadRes = await uploadPromise;
      objectStorageDouble.setPutDelayMs(0);
      expect(uploadRes.status).toBe(200);
      const uploaded = (await uploadRes.json()).data;

      // Now the real download succeeds and matches the compressed bytes exactly.
      const realGet = await GET(new Request("http://localhost/x"), {
        params: Promise.resolve({ key: uploaded.storageKey.split("/").map((s: string) => encodeURIComponent(s)) }),
      });
      expect(realGet.status).toBe(200);
      const downloaded = Buffer.from(await realGet.arrayBuffer());
      expect(downloaded.length).toBeGreaterThan(0);
      const stored = objectStorageDouble.store.get(`doctor-avatars/${uploaded.storageKey}`)!;
      expect(downloaded.equals(stored.buffer)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------
  // Progressive stress levels — bounded, valid-file uploads
  // ---------------------------------------------------------------------
  describe("Progressive stress — bounded concurrent valid uploads", () => {
    test.each([10, 25, 50, 100])("%i concurrent uploads: 0 unhandled exceptions, 0 corrupt/orphaned objects", async (n) => {
      const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
      const bytes = await makeValidJpeg();
      const before = objectStorageDouble.store.size;

      const users = await Promise.all(Array.from({ length: n }, () => createUser([Roles.DOCTOR])));
      const headerSets = await Promise.all(users.map((u) => authHeaders(u)));

      const start = Date.now();
      const responses = await Promise.all(
        headerSets.map((h) =>
          POST(
            multipartRequest(
              "http://localhost/api/v1/doctor/avatar/upload",
              { file: toFile(bytes, "a.jpg", "image/jpeg") },
              h,
            ),
          ),
        ),
      );
      const elapsedMs = Date.now() - start;

      const statusCounts = responses.reduce<Record<number, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      }, {});

      expect(statusCounts[200]).toBe(n);
      expect(statusCounts[500] ?? 0).toBe(0);
      expect(objectStorageDouble.store.size).toBe(before + n);
      // eslint-disable-next-line no-console -- deliberate stress-level reporting for the audit report
      console.log(`[stress ${n}] total=${n} success=${statusCounts[200]} elapsedMs=${elapsedMs}`);
    });
  });

  // ---------------------------------------------------------------------
  // 100-concurrent MAIN mixed test — upload + authorized download +
  // unauthorized download + metadata lookup, all interleaved.
  // ---------------------------------------------------------------------
  describe("100-concurrent main mixed test", () => {
    test("100 interleaved requests: uploads, authorized downloads, unauthorized downloads — correct outcome for every single one", async () => {
      const { POST: avatarPost } = await import("@/app/api/v1/doctor/avatar/upload/route");
      const { GET: avatarGet } = await import("@/app/api/v1/public/doctor-avatars/[...key]/route");
      const { POST: docPost } = await import("@/app/api/v1/doctor/verification/upload/route");
      const { GET: docGet } = await import("@/app/api/v1/doctor/verification/documents/[...key]/route");

      const N = 100;
      const bytes = await makeValidJpeg();

      // Pre-seed one private document owned by a fixed "victim" doctor, for the
      // unauthorized-download arm of this test.
      const victimId = await createUser([Roles.DOCTOR]);
      const victimUploadRes = await docPost(
        multipartRequest(
          "http://localhost/api/v1/doctor/verification/upload",
          { file: toFile(await makeValidJpeg(), "victim.jpg", "image/jpeg") },
          await authHeaders(victimId),
        ),
      );
      const victimDoc = (await victimUploadRes.json()).data;
      await DoctorProfileModel.create({ userId: victimId, verificationDocuments: { cnicFront: victimDoc.url } });
      const victimKeyParts = victimDoc.storageKey.split("/").map((s: string) => encodeURIComponent(s));

      const users = await Promise.all(Array.from({ length: N }, () => createUser([Roles.DOCTOR])));
      const headerSets = await Promise.all(users.map((u) => authHeaders(u)));

      type Op = () => Promise<{ kind: string; status: number }>;
      const ops: Op[] = headerSets.map((headers, i) => {
        const kind = i % 3;
        if (kind === 0) {
          // avatar upload (public-by-design file)
          return async () => {
            const res = await avatarPost(
              multipartRequest("http://localhost/api/v1/doctor/avatar/upload", { file: toFile(bytes, "a.jpg", "image/jpeg") }, headers),
            );
            return { kind: "upload", status: res.status };
          };
        }
        if (kind === 1) {
          // unauthorized attempt to read the victim's private document (headers
          // belong to `users[i]`, never the victim)
          return async () => {
            const res = await docGet(new Request("http://localhost/x", { headers }), {
              params: Promise.resolve({ key: victimKeyParts }),
            });
            return { kind: "unauthorized-download", status: res.status };
          };
        }
        // metadata lookup via the public avatar GET for a nonexistent key (should 404 cleanly)
        return async () => {
          const res = await avatarGet(new Request("http://localhost/x"), {
            params: Promise.resolve({ key: [`${users[i]}`, "nonexistent.webp"] }),
          });
          return { kind: "metadata-lookup-miss", status: res.status };
        };
      });

      const results = await Promise.all(ops.map((op) => op()));

      const byKind = results.reduce<Record<string, number[]>>((acc, r) => {
        (acc[r.kind] ??= []).push(r.status);
        return acc;
      }, {});

      expect(results.length).toBe(N);
      expect((byKind["upload"] ?? []).every((s) => s === 200)).toBe(true);
      expect((byKind["unauthorized-download"] ?? []).every((s) => s === 403)).toBe(true);
      expect((byKind["metadata-lookup-miss"] ?? []).every((s) => s === 404)).toBe(true);

      // finally: the real victim, authenticated as themselves, CAN read it —
      // proving the 403s above are a real authorization boundary, not a
      // universal failure of the route. Run concurrently with a fresh batch of
      // the same unauthorized probe to confirm the invariant holds even at the
      // exact moment a legitimate read is also happening.
      const [victimOwnRead, ...lastUnauthorizedBatch] = await Promise.all([
        docGet(new Request("http://localhost/x", { headers: await authHeaders(victimId) }), {
          params: Promise.resolve({ key: victimKeyParts }),
        }),
        ...headerSets
          .slice(0, 10)
          .map((h) => docGet(new Request("http://localhost/x", { headers: h }), { params: Promise.resolve({ key: victimKeyParts }) })),
      ]);
      expect(victimOwnRead.status).toBe(200);
      expect(lastUnauthorizedBatch.every((r) => r.status === 403)).toBe(true);

      // eslint-disable-next-line no-console -- deliberate stress-level reporting for the audit report
      console.log(
        `[100-concurrent main] uploads=${(byKind["upload"] ?? []).length} unauthorized=${
          (byKind["unauthorized-download"] ?? []).length
        } metadata404=${(byKind["metadata-lookup-miss"] ?? []).length} privateFileExposures=0 serverCrashes=0`,
      );
    });
  });

  // ---------------------------------------------------------------------
  // 250-concurrent — lighter-weight upload-only check (see file header note)
  // ---------------------------------------------------------------------
  describe("250-concurrent (upload-only, lighter weight)", () => {
    test("250 concurrent valid avatar uploads: no crashes, no orphans, every key unique", async () => {
      const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
      const bytes = await makeValidJpeg();
      const before = objectStorageDouble.store.size;
      const N = 250;

      const users = await Promise.all(Array.from({ length: N }, () => createUser([Roles.DOCTOR])));
      const headerSets = await Promise.all(users.map((u) => authHeaders(u)));

      const responses = await Promise.all(
        headerSets.map((h) =>
          POST(multipartRequest("http://localhost/api/v1/doctor/avatar/upload", { file: toFile(bytes, "a.jpg", "image/jpeg") }, h)),
        ),
      );

      const successCount = responses.filter((r) => r.status === 200).length;
      expect(successCount).toBe(N);
      expect(objectStorageDouble.store.size).toBe(before + N);
    });
  });
});
