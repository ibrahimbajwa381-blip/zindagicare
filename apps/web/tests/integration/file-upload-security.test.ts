/**
 * FILE-001..009 — P0 File Upload / File Access audit.
 *
 * Real local MongoDB (mongodb-memory-server, ephemeral — never Atlas, never
 * production) + REAL route handlers (imported and invoked directly, exactly
 * as Next.js would call them) + REAL auth (resolveSession / mobile JWT,
 * signed with a test-only AUTH_SECRET) + REAL storage-service validation
 * logic (object-storage.ts's validateStorageKey/objectKey/contentTypeFromKey
 * run unmocked). Only the actual network call to Supabase is replaced with
 * an in-memory double (tests/helpers/object-storage-double.ts) — see that
 * file's header comment for why that boundary, not a higher one, is faked.
 *
 * Covers two of the app's distinct authorization models:
 *   - ownership-based private files (doctor verification documents, gated by
 *     DoctorProfileModel.verificationDocuments via canDoctorAccessDocument)
 *   - participant-based private files (chat attachments, gated by
 *     ChatThreadModel.participantIds via ChatService.assertParticipant)
 * plus the public-by-design avatar flow (doctor-avatars, no auth on GET).
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";
import { buildObjectStorageDouble } from "../helpers/object-storage-double";
import {
  makeValidJpeg,
  makeValidPng,
  makeValidWebp,
  makeValidPdf,
  makeGarbageBytes,
  makeTruncatedPdf,
  makeTruncatedImage,
  makeOversizedBuffer,
  toFile,
} from "../helpers/synthetic-files";

jest.setTimeout(60000);

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

// next-auth/@auth/core is ESM-only and this jest config only special-cases
// `jose` in transformIgnorePatterns (see jest.config.js) — the same reason
// tests/unit/security/resolve-session.test.ts mocks @/lib/auth rather than
// importing it for real. We only need the mobile Bearer-token path here, so
// stub the (unused, cookie-only) auth() and let resolveSession's real logic,
// real verifyMobileToken (jose), and real DB-backed loadAuthUserPayload run
// unmocked — JWT-mechanics correctness itself is already covered end-to-end
// by tests/unit/security/mobile-jwt.test.ts + resolve-session.test.ts; this
// suite focuses on file-route authorization built on top of a resolved session.
jest.mock("@/lib/auth", () => ({ auth: async () => null }));

describe("File Upload / File Access — P0 audit (real Mongo, real routes, faked Supabase I/O only)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let UserModel: typeof import("@zindagi/database").UserModel;
  let DoctorProfileModel: typeof import("@zindagi/database").DoctorProfileModel;
  let ChatThreadModel: typeof import("@zindagi/database").ChatThreadModel;
  let Roles: typeof import("@zindagi/shared").Roles;
  let ChatThreadTypes: typeof import("@zindagi/shared").ChatThreadTypes;
  let signMobileAccessToken: typeof import("@/server/api/mobile-jwt").signMobileAccessToken;
  type Role = import("@zindagi/shared").Role;

  let counter = 0;
  const nextEmail = () => `file-audit-${Date.now()}-${counter++}@test.local`;

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
    process.env.MONGODB_URI = mongod.getUri("file_upload_audit");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.AUTH_SECRET = "test-secret-" + randomBytes(16).toString("hex");

    const db = await import("@zindagi/database");
    UserModel = db.UserModel;
    DoctorProfileModel = db.DoctorProfileModel;
    ChatThreadModel = db.ChatThreadModel;
    mongooseMod = (await import("mongoose")).default;

    const shared = await import("@zindagi/shared");
    Roles = shared.Roles;
    ChatThreadTypes = shared.ChatThreadTypes;

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
  // FILE-001 — Valid image upload (doctor avatar: public-by-design)
  // ---------------------------------------------------------------------
  describe("FILE-001: valid image upload (doctor avatar)", () => {
    test("JPEG/PNG/WEBP all accepted; response matches persisted state; content is a real decodable image", async () => {
      const sharp = (await import("sharp")).default;
      const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
      const { GET } = await import("@/app/api/v1/public/doctor-avatars/[...key]/route");

      for (const [make, name, type] of [
        [makeValidJpeg, "photo.jpg", "image/jpeg"],
        [makeValidPng, "photo.png", "image/png"],
        [makeValidWebp, "photo.webp", "image/webp"],
      ] as const) {
        const userId = await createUser([Roles.DOCTOR]);
        const file = toFile(await make(), name, type);
        const req = multipartRequest("http://localhost/api/v1/doctor/avatar/upload", { file }, await authHeaders(userId));

        const res = await POST(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.storageKey).toMatch(new RegExp(`^${userId}/`));
        expect(body.data.url).toContain("/api/v1/public/doctor-avatars/");

        // storage-layer truth matches the API response
        const stored = objectStorageDouble.store.get(`doctor-avatars/${body.data.storageKey}`);
        expect(stored).toBeDefined();
        expect(stored!.buffer.length).toBeGreaterThan(0);

        // the actual bytes are a valid, decodable image (compressed to webp)
        const meta = await sharp(stored!.buffer).metadata();
        expect(meta.format).toBe("webp");

        // downloadable by anyone (avatars are intentionally public, no auth header)
        const keyParts = body.data.storageKey.split("/").map((s: string) => encodeURIComponent(s));
        const getReq = new Request(`http://localhost/api/v1/public/doctor-avatars/${keyParts.join("/")}`);
        const getRes = await GET(getReq, { params: Promise.resolve({ key: keyParts }) });
        expect(getRes.status).toBe(200);
        expect(getRes.headers.get("Content-Type")).toBe("image/webp");
        const downloaded = Buffer.from(await getRes.arrayBuffer());
        expect(downloaded.equals(stored!.buffer)).toBe(true);
      }
    });

    test("requires authentication and the doctor role", async () => {
      const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");

      const noAuthReq = multipartRequest("http://localhost/api/v1/doctor/avatar/upload", {
        file: toFile(await makeValidJpeg(), "a.jpg", "image/jpeg"),
      });
      expect((await POST(noAuthReq)).status).toBe(401);

      const patientId = await createUser([Roles.PATIENT]);
      const wrongRoleReq = multipartRequest(
        "http://localhost/api/v1/doctor/avatar/upload",
        { file: toFile(await makeValidJpeg(), "a.jpg", "image/jpeg") },
        await authHeaders(patientId),
      );
      expect((await POST(wrongRoleReq)).status).toBe(403);
      expect(objectStorageDouble.store.size).toBe(0);
    });
  });

  // ---------------------------------------------------------------------
  // FILE-002 — Valid PDF (doctor verification document, private)
  // ---------------------------------------------------------------------
  describe("FILE-002: valid PDF upload + private-file authorization", () => {
    test("authorized owner can upload and later download; unauthorized user cannot", async () => {
      const { POST: uploadPost } = await import("@/app/api/v1/doctor/verification/upload/route");
      const { GET: docsGet } = await import("@/app/api/v1/doctor/verification/documents/[...key]/route");

      const doctorA = await createUser([Roles.DOCTOR]);
      const doctorB = await createUser([Roles.DOCTOR]);

      const uploadReq = multipartRequest(
        "http://localhost/api/v1/doctor/verification/upload",
        { file: toFile(makeValidPdf(), "pmdc.pdf", "application/pdf") },
        await authHeaders(doctorA),
      );
      const uploadRes = await uploadPost(uploadReq);
      expect(uploadRes.status).toBe(200);
      const uploaded = (await uploadRes.json()).data;
      expect(uploaded.mimeType).toBe("application/pdf");

      // Not yet accessible to A — canDoctorAccessDocument requires the key to be
      // attached to the doctor's own verificationDocuments, matching the real
      // submit-for-verification flow (not just "uploaded under my userId").
      const keyParts = uploaded.storageKey.split("/").map((s: string) => encodeURIComponent(s));
      const notYetAttached = await docsGet(
        new Request("http://localhost/x", { headers: await authHeaders(doctorA) }),
        { params: Promise.resolve({ key: keyParts }) },
      );
      expect(notYetAttached.status).toBe(403);

      // Attach it the way real verification submission would (direct DB write —
      // exercising the real canDoctorAccessDocument authorization function below,
      // not re-deriving the full profile-submission business flow).
      await DoctorProfileModel.create({
        userId: doctorA,
        verificationDocuments: { pmdcCertificate: uploaded.url },
      });

      const authorizedRes = await docsGet(
        new Request("http://localhost/x", { headers: await authHeaders(doctorA) }),
        { params: Promise.resolve({ key: keyParts }) },
      );
      expect(authorizedRes.status).toBe(200);
      expect(authorizedRes.headers.get("Content-Type")).toBe("application/pdf");
      const downloadedBytes = Buffer.from(await authorizedRes.arrayBuffer());
      expect(downloadedBytes.equals(makeValidPdf())).toBe(true);

      // FILE-008: a second doctor (B) — not the owner, no attachment — is denied.
      const unauthorizedRes = await docsGet(
        new Request("http://localhost/x", { headers: await authHeaders(doctorB) }),
        { params: Promise.resolve({ key: keyParts }) },
      );
      expect(unauthorizedRes.status).toBe(403);

      // Unauthenticated request is denied.
      const noAuthRes = await docsGet(new Request("http://localhost/x"), {
        params: Promise.resolve({ key: keyParts }),
      });
      expect(noAuthRes.status).toBe(401);
    });
  });

  // ---------------------------------------------------------------------
  // FILE-003 — Invalid extension / MIME
  // ---------------------------------------------------------------------
  describe("FILE-003: invalid file type is rejected with a controlled 4xx, no storage/DB side effects", () => {
    test.each([
      ["application/x-msdownload", "virus.exe"],
      ["application/javascript", "script.js"],
      ["text/html", "page.html"],
      ["application/x-php", "shell.php"],
      ["image/svg+xml", "vector.svg"],
      ["application/zip", "archive.zip"],
    ])("MIME %s (%s) is rejected", async (mimeType, filename) => {
      const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
      const userId = await createUser([Roles.DOCTOR]);
      const req = multipartRequest(
        "http://localhost/api/v1/doctor/avatar/upload",
        { file: toFile(makeGarbageBytes(512), filename, mimeType) },
        await authHeaders(userId),
      );
      const res = await POST(req);
      // BUG-FILE-002 (fixed): this used to be a raw 500 for every one of these —
      // apiError() only recognized AppError/ZodError and the storage service's
      // own validation threw a plain Error. Now a controlled 400.
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(objectStorageDouble.store.size).toBe(0);
    });

    test("double-extension filenames (photo.jpg.php) do not bypass the MIME check", async () => {
      const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
      const userId = await createUser([Roles.DOCTOR]);
      const req = multipartRequest(
        "http://localhost/api/v1/doctor/avatar/upload",
        { file: toFile(makeGarbageBytes(256), "photo.jpg.php", "application/x-php") },
        await authHeaders(userId),
      );
      expect((await POST(req)).status).toBe(400);
      expect(objectStorageDouble.store.size).toBe(0);
    });
  });

  // ---------------------------------------------------------------------
  // FILE-004 — Oversized file
  // ---------------------------------------------------------------------
  describe("FILE-004: oversized file handling (doctor avatar, 3MB limit)", () => {
    const LIMIT = 3 * 1024 * 1024;

    test("just below limit is accepted, 1 byte above is rejected with a controlled 4xx", async () => {
      const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");

      // A real, decodable JPEG (so this exercises the size boundary, not the
      // FILE-006 sharp-content-validation path) sized just under the limit.
      const sharp = (await import("sharp")).default;
      const validLargeJpeg = await sharp({
        create: { width: 1500, height: 1500, channels: 3, background: { r: 0, g: 0, b: 0 }, noise: { type: "gaussian", mean: 128, sigma: 40 } },
      })
        .jpeg({ quality: 100 })
        .toBuffer();
      expect(validLargeJpeg.length).toBeLessThan(LIMIT);

      const okUserId = await createUser([Roles.DOCTOR]);
      const validReq = multipartRequest(
        "http://localhost/api/v1/doctor/avatar/upload",
        { file: toFile(validLargeJpeg, "big.jpg", "image/jpeg") },
        await authHeaders(okUserId),
      );
      expect((await POST(validReq)).status).toBe(200);

      const overUserId = await createUser([Roles.DOCTOR]);
      const overReq = multipartRequest(
        "http://localhost/api/v1/doctor/avatar/upload",
        { file: toFile(makeOversizedBuffer(LIMIT + 1), "huge.jpg", "image/jpeg") },
        await authHeaders(overUserId),
      );
      const overRes = await POST(overReq);
      expect(overRes.status).toBe(400);
      const overBody = await overRes.json();
      expect(overBody.error.code).toBe("VALIDATION_ERROR");
    });

    test("size is validated before any storage write (no orphaned object on rejection)", async () => {
      const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
      const before = objectStorageDouble.store.size;
      const userId = await createUser([Roles.DOCTOR]);
      const req = multipartRequest(
        "http://localhost/api/v1/doctor/avatar/upload",
        { file: toFile(makeOversizedBuffer(10 * 1024 * 1024), "huge.jpg", "image/jpeg") },
        await authHeaders(userId),
      );
      await POST(req);
      expect(objectStorageDouble.store.size).toBe(before);
    });
  });

  // ---------------------------------------------------------------------
  // FILE-005 — Empty file
  // ---------------------------------------------------------------------
  describe("FILE-005: empty file handling", () => {
    test("0-byte avatar upload is rejected with a controlled 4xx, not a crash", async () => {
      const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
      const userId = await createUser([Roles.DOCTOR]);
      const req = multipartRequest(
        "http://localhost/api/v1/doctor/avatar/upload",
        { file: toFile(Buffer.alloc(0), "empty.jpg", "image/jpeg") },
        await authHeaders(userId),
      );
      const res = await POST(req);
      // BUG-FILE-003 (fixed): sharp throws a plain Error on an empty buffer;
      // previously that bubbled to a raw 500. Now a controlled 400.
      expect(res.status).toBe(400);
      expect(objectStorageDouble.store.size).toBe(0);
    });

    test("0-byte verification document upload is rejected", async () => {
      const { POST } = await import("@/app/api/v1/doctor/verification/upload/route");
      const userId = await createUser([Roles.DOCTOR]);
      const req = multipartRequest(
        "http://localhost/api/v1/doctor/verification/upload",
        { file: toFile(Buffer.alloc(0), "empty.pdf", "application/pdf") },
        await authHeaders(userId),
      );
      const res = await POST(req);
      expect(res.status).toBe(400);
      expect(objectStorageDouble.store.size).toBe(0);
    });

    test("missing file field is rejected without reaching storage", async () => {
      const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
      const userId = await createUser([Roles.DOCTOR]);
      const fd = new FormData();
      const req = new Request("http://localhost/api/v1/doctor/avatar/upload", {
        method: "POST",
        headers: await authHeaders(userId),
        body: fd,
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      expect(objectStorageDouble.store.size).toBe(0);
    });
  });

  // ---------------------------------------------------------------------
  // FILE-006 — Malformed file / MIME spoofing
  // ---------------------------------------------------------------------
  describe("FILE-006: malformed content is rejected with a controlled 4xx", () => {
    test("garbage bytes declared as image/jpeg (MIME spoofing) do not crash the server", async () => {
      const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
      const userId = await createUser([Roles.DOCTOR]);
      const req = multipartRequest(
        "http://localhost/api/v1/doctor/avatar/upload",
        { file: toFile(makeGarbageBytes(4096), "fake.jpg", "image/jpeg") },
        await authHeaders(userId),
      );
      const res = await POST(req);
      // BUG-FILE-003 (fixed): sharp throws on non-image bytes even though the
      // declared MIME passed ALLOWED_TYPES — previously a raw 500.
      expect(res.status).toBe(400);
      expect(objectStorageDouble.store.size).toBe(0);
    });

    test("truncated/corrupt image header is rejected, not crashed", async () => {
      const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
      const userId = await createUser([Roles.DOCTOR]);
      const req = multipartRequest(
        "http://localhost/api/v1/doctor/avatar/upload",
        { file: toFile(await makeTruncatedImage(), "broken.jpg", "image/jpeg") },
        await authHeaders(userId),
      );
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    test("garbage bytes declared as application/pdf are accepted (extension/MIME-only trust — documented, not fixed, see bugs.txt)", async () => {
      // The app does not claim content-sniffing/magic-byte validation anywhere
      // (only extension allowlist + declared MIME + size). This is intentionally
      // NOT patched — adding real PDF parsing would be a new validation rule,
      // out of scope per the audit's "do not invent business rules" constraint.
      // Verified here so the behavior is documented and regression-tested as-is.
      const { POST } = await import("@/app/api/v1/doctor/verification/upload/route");
      const userId = await createUser([Roles.DOCTOR]);
      const req = multipartRequest(
        "http://localhost/api/v1/doctor/verification/upload",
        { file: toFile(makeGarbageBytes(2048), "fake.pdf", "application/pdf") },
        await authHeaders(userId),
      );
      const res = await POST(req);
      expect(res.status).toBe(200); // accepted — documented gap, not a crash
    });

    test("truncated PDF (header only, no valid trailer) is still accepted — no content parser exists", async () => {
      const { POST } = await import("@/app/api/v1/doctor/verification/upload/route");
      const userId = await createUser([Roles.DOCTOR]);
      const req = multipartRequest(
        "http://localhost/api/v1/doctor/verification/upload",
        { file: toFile(makeTruncatedPdf(), "broken.pdf", "application/pdf") },
        await authHeaders(userId),
      );
      expect((await POST(req)).status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------
  // FILE-007 — Unauthorized upload
  // ---------------------------------------------------------------------
  describe("FILE-007: unauthorized upload is rejected across auth failure modes", () => {
    test("expired/malformed/forged tokens are all rejected", async () => {
      const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
      const file = toFile(await makeValidJpeg(), "a.jpg", "image/jpeg");

      const malformed = multipartRequest(
        "http://localhost/api/v1/doctor/avatar/upload",
        { file },
        { authorization: "Bearer not-a-real-jwt" },
      );
      expect((await POST(malformed)).status).toBe(401);

      // token signed with a DIFFERENT secret than AUTH_SECRET (forged/invalid signature)
      const jose = await import("jose");
      const forged = await new jose.SignJWT({ typ: "access" })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("000000000000000000000000")
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(new TextEncoder().encode("a-completely-different-secret"));
      const forgedReq = multipartRequest(
        "http://localhost/api/v1/doctor/avatar/upload",
        { file },
        { authorization: `Bearer ${forged}` },
      );
      expect((await POST(forgedReq)).status).toBe(401);

      // already-expired token, correctly signed
      const expired = await new jose.SignJWT({ typ: "access" })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("000000000000000000000000")
        .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
        .sign(new TextEncoder().encode(process.env.AUTH_SECRET!));
      const expiredReq = multipartRequest(
        "http://localhost/api/v1/doctor/avatar/upload",
        { file },
        { authorization: `Bearer ${expired}` },
      );
      expect((await POST(expiredReq)).status).toBe(401);

      expect(objectStorageDouble.store.size).toBe(0);
    });

    test("a patient cannot attach a chat attachment to a thread they are not a participant in", async () => {
      const { POST } = await import("@/app/api/v1/chat/attachments/upload/route");
      const doctorId = await createUser([Roles.DOCTOR]);
      const patientId = await createUser([Roles.PATIENT]);
      const outsiderId = await createUser([Roles.PATIENT]);

      const thread = await ChatThreadModel.create({
        type: ChatThreadTypes.APPOINTMENT,
        participantIds: [doctorId, patientId],
      });

      const fd = new FormData();
      fd.set("threadId", thread._id.toString());
      fd.set("file", toFile(await makeValidJpeg(), "img.jpg", "image/jpeg"));
      const req = new Request("http://localhost/api/v1/chat/attachments/upload", {
        method: "POST",
        headers: await authHeaders(outsiderId),
        body: fd,
      });
      const res = await POST(req);
      expect([403, 404]).toContain(res.status);
      expect(objectStorageDouble.store.size).toBe(0);
    });
  });

  // ---------------------------------------------------------------------
  // FILE-008 / FILE-009 / IDOR — private file cannot be accessed by another
  // user, cannot be reached through a public path, ID substitution fails.
  // ---------------------------------------------------------------------
  describe("FILE-008/009: private-file IDOR and alternative-access-path audit", () => {
    test("chat attachment: only thread participants can download; outsider and unauthenticated are denied", async () => {
      const { POST: uploadPost } = await import("@/app/api/v1/chat/attachments/upload/route");
      const { GET: downloadGet } = await import("@/app/api/v1/chat/attachments/[...key]/route");

      const doctorId = await createUser([Roles.DOCTOR]);
      const patientId = await createUser([Roles.PATIENT]);
      const outsiderId = await createUser([Roles.PATIENT]);

      const thread = await ChatThreadModel.create({
        type: ChatThreadTypes.APPOINTMENT,
        participantIds: [doctorId, patientId],
      });

      const fd = new FormData();
      fd.set("threadId", thread._id.toString());
      fd.set("file", toFile(await makeValidJpeg(), "img.jpg", "image/jpeg"));
      const uploadReq = new Request("http://localhost/api/v1/chat/attachments/upload", {
        method: "POST",
        headers: await authHeaders(patientId),
        body: fd,
      });
      const uploadRes = await uploadPost(uploadReq);
      expect(uploadRes.status).toBe(200);
      const stored = (await uploadRes.json()).data;
      const keyParts = stored.storageKey.split("/").map((s: string) => encodeURIComponent(s));

      // authorized participant (the other side of the thread) can download
      const okRes = await downloadGet(
        new Request("http://localhost/x", { headers: await authHeaders(doctorId) }),
        { params: Promise.resolve({ key: keyParts }) },
      );
      expect(okRes.status).toBe(200);

      // IDOR probe: a real, authenticated, but non-participant user is denied
      const idorRes = await downloadGet(
        new Request("http://localhost/x", { headers: await authHeaders(outsiderId) }),
        { params: Promise.resolve({ key: keyParts }) },
      );
      expect([403, 404]).toContain(idorRes.status);

      // unauthenticated is denied
      const anonRes = await downloadGet(new Request("http://localhost/x"), {
        params: Promise.resolve({ key: keyParts }),
      });
      expect(anonRes.status).toBe(401);

      // metadata-ID substitution: swap in another real thread's message key shape
      // (same storage layout, different threadId prefix) — must not be inferable
      // into access; assertParticipant re-derives from the REAL stored key, so
      // an attacker-supplied storageKey pointing at another thread must 404/403,
      // never 200.
      const fakeOtherThreadKey = `${new mongooseMod.Types.ObjectId().toString()}/${stored.storageKey.split("/")[1]}`;
      const spoofedParts = fakeOtherThreadKey.split("/").map((s) => encodeURIComponent(s));
      const spoofRes = await downloadGet(
        new Request("http://localhost/x", { headers: await authHeaders(outsiderId) }),
        { params: Promise.resolve({ key: spoofedParts }) },
      );
      expect([403, 404]).toContain(spoofRes.status);
    });

    test("doctor verification document: FILE-009 — private file has no public/unauthenticated access path", async () => {
      const { POST: uploadPost } = await import("@/app/api/v1/doctor/verification/upload/route");
      const { GET: docsGet } = await import("@/app/api/v1/doctor/verification/documents/[...key]/route");

      const doctorId = await createUser([Roles.DOCTOR]);
      const uploadReq = multipartRequest(
        "http://localhost/api/v1/doctor/verification/upload",
        { file: toFile(makeValidPdf(), "cnic.pdf", "application/pdf") },
        await authHeaders(doctorId),
      );
      const uploaded = (await (await uploadPost(uploadReq)).json()).data;
      await DoctorProfileModel.create({
        userId: doctorId,
        verificationDocuments: { cnicFront: uploaded.url },
      });
      const keyParts = uploaded.storageKey.split("/").map((s: string) => encodeURIComponent(s));

      // Same private document namespace (doctor-verification) has no public
      // serving route at all — only the authenticated `documents/[...key]` route
      // exists (grep-confirmed: no `public/doctor-verification` route exists,
      // unlike doctor-avatars which intentionally does). Confirm the private
      // route itself still enforces auth (already covered above) and that the
      // object is stored under the private namespace, not the public one.
      expect(objectStorageDouble.store.has(`doctor-verification/${uploaded.storageKey}`)).toBe(true);
      expect(objectStorageDouble.store.has(`doctor-avatars/${uploaded.storageKey}`)).toBe(false);

      // direct unauthenticated GET on the only real download route still 401s
      const anonRes = await docsGet(new Request("http://localhost/x"), {
        params: Promise.resolve({ key: keyParts }),
      });
      expect(anonRes.status).toBe(401);
    });

    test("admin can access any doctor's verification document; a plain doctor (even role ADMIN missing) cannot", async () => {
      const { POST: uploadPost } = await import("@/app/api/v1/doctor/verification/upload/route");
      const { GET: docsGet } = await import("@/app/api/v1/doctor/verification/documents/[...key]/route");

      const doctorId = await createUser([Roles.DOCTOR]);
      const adminId = await createUser([Roles.ADMIN]);
      const uploadReq = multipartRequest(
        "http://localhost/api/v1/doctor/verification/upload",
        { file: toFile(makeValidPdf(), "degree.pdf", "application/pdf") },
        await authHeaders(doctorId),
      );
      const uploaded = (await (await uploadPost(uploadReq)).json()).data;
      await DoctorProfileModel.create({
        userId: doctorId,
        verificationDocuments: { degreeCertificate: uploaded.url },
      });
      const keyParts = uploaded.storageKey.split("/").map((s: string) => encodeURIComponent(s));

      const adminRes = await docsGet(
        new Request("http://localhost/x", { headers: await authHeaders(adminId) }),
        { params: Promise.resolve({ key: keyParts }) },
      );
      expect(adminRes.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------
  // Filename security / path traversal / storage-key injection
  // ---------------------------------------------------------------------
  describe("Filename security & path traversal", () => {
    test.each([
      "../../../secret.txt",
      "../../../../etc/passwd",
      "..\\..\\secret.txt",
      "/absolute/path/file.jpg",
      "file .jpg",
      "file\nInjected-Header: x.jpg",
      "very-long-" + "a".repeat(5000) + ".jpg",
      "文件名.jpg",
      "file with spaces and 'quotes\".jpg",
    ])("malicious filename %j does not escape the user-scoped storage key or crash", async (filename) => {
      const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
      const userId = await createUser([Roles.DOCTOR]);
      const req = multipartRequest(
        "http://localhost/api/v1/doctor/avatar/upload",
        { file: toFile(await makeValidJpeg(), filename, "image/jpeg") },
        await authHeaders(userId),
      );
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      // BUG-FILE-001 (fixed): the extension used to be taken verbatim from the
      // attacker-controlled filename (path.extname(file.name)); now it is
      // always derived from the validated, compressed output — always ".webp"
      // for avatars regardless of what the client named the file.
      expect(body.data.storageKey).toBe(`${userId}/${body.data.storageKey.split("/")[1]}`);
      expect(body.data.storageKey.endsWith(".webp")).toBe(true);
      expect(body.data.storageKey).not.toContain("..");
      expect(body.data.storageKey).not.toContain(" ");
      expect(body.data.storageKey).not.toContain("\n");
      expect(body.data.storageKey.length).toBeLessThan(200);
    });

    test("path traversal in the download key itself is rejected by validateStorageKey", async () => {
      const { GET } = await import("@/app/api/v1/public/doctor-avatars/[...key]/route");
      for (const traversal of ["..", "../../etc/passwd", "..%2f..%2fsecret"]) {
        const res = await GET(new Request("http://localhost/x"), {
          params: Promise.resolve({ key: [traversal] }),
        });
        expect(res.status).not.toBe(200);
      }
    });
  });

  // ---------------------------------------------------------------------
  // Malformed multipart requests
  // ---------------------------------------------------------------------
  describe("Malformed multipart requests", () => {
    test("wrong field name for the file is rejected as missing, not silently accepted", async () => {
      const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
      const userId = await createUser([Roles.DOCTOR]);
      const fd = new FormData();
      fd.set("wrongFieldName", toFile(await makeValidJpeg(), "a.jpg", "image/jpeg"));
      const req = new Request("http://localhost/api/v1/doctor/avatar/upload", {
        method: "POST",
        headers: await authHeaders(userId),
        body: fd,
      });
      expect((await POST(req)).status).toBe(400);
    });

    test("a plain string in the file field (not a File) is rejected, not crashed", async () => {
      const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
      const userId = await createUser([Roles.DOCTOR]);
      const fd = new FormData();
      fd.set("file", "just-a-string-not-a-file");
      const req = new Request("http://localhost/api/v1/doctor/avatar/upload", {
        method: "POST",
        headers: await authHeaders(userId),
        body: fd,
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    test("multiple files under the same field name — only the last is used, no crash", async () => {
      const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
      const userId = await createUser([Roles.DOCTOR]);
      const fd = new FormData();
      fd.append("file", toFile(makeGarbageBytes(64), "junk.jpg", "image/jpeg"));
      fd.append("file", toFile(await makeValidJpeg(), "real.jpg", "image/jpeg"));
      const req = new Request("http://localhost/api/v1/doctor/avatar/upload", {
        method: "POST",
        headers: await authHeaders(userId),
        body: fd,
      });
      const res = await POST(req);
      expect([200, 400]).toContain(res.status); // whichever wins, must be a clean outcome
    });
  });

  // ---------------------------------------------------------------------
  // Storage failure simulation (STORAGE-001..007-equivalent)
  // ---------------------------------------------------------------------
  describe("Storage failure handling", () => {
    test("STORAGE-001/004: storage write failure does not create a false-success response", async () => {
      const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
      objectStorageDouble.setFailNextPut(new Error("simulated Supabase outage"));
      const userId = await createUser([Roles.DOCTOR]);
      const req = multipartRequest(
        "http://localhost/api/v1/doctor/avatar/upload",
        { file: toFile(await makeValidJpeg(), "a.jpg", "image/jpeg") },
        await authHeaders(userId),
      );
      const res = await POST(req);
      // Storage layer errors are plain Errors too — same apiError() gap, but
      // this one IS an unexpected infra failure, so a 500 here is the correct,
      // already-intended behavior (unlike the validation-throw sites above).
      // What matters is it fails closed: no success response, no orphan record.
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(objectStorageDouble.store.size).toBe(0);
    });

    test("STORAGE-002: slow storage does not corrupt concurrent unrelated uploads", async () => {
      const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
      objectStorageDouble.setPutDelayMs(50);
      const userA = await createUser([Roles.DOCTOR]);
      const userB = await createUser([Roles.DOCTOR]);
      const [resA, resB] = await Promise.all([
        POST(
          multipartRequest(
            "http://localhost/api/v1/doctor/avatar/upload",
            { file: toFile(await makeValidJpeg(), "a.jpg", "image/jpeg") },
            await authHeaders(userA),
          ),
        ),
        POST(
          multipartRequest(
            "http://localhost/api/v1/doctor/avatar/upload",
            { file: toFile(await makeValidPng(), "b.png", "image/png") },
            await authHeaders(userB),
          ),
        ),
      ]);
      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      const bodyA = await resA.json();
      const bodyB = await resB.json();
      expect(bodyA.data.storageKey.startsWith(userA)).toBe(true);
      expect(bodyB.data.storageKey.startsWith(userB)).toBe(true);
      objectStorageDouble.setPutDelayMs(0);
    });
  });

  // ---------------------------------------------------------------------
  // Duplicate upload
  // ---------------------------------------------------------------------
  describe("Duplicate upload behavior", () => {
    test("uploading the identical file twice creates two independent objects (no dedup intended — each upload gets a fresh randomUUID key)", async () => {
      const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
      const userId = await createUser([Roles.DOCTOR]);
      const bytes = await makeValidJpeg();
      const [r1, r2] = await Promise.all([
        POST(
          multipartRequest(
            "http://localhost/api/v1/doctor/avatar/upload",
            { file: toFile(bytes, "a.jpg", "image/jpeg") },
            await authHeaders(userId),
          ),
        ),
        POST(
          multipartRequest(
            "http://localhost/api/v1/doctor/avatar/upload",
            { file: toFile(bytes, "a.jpg", "image/jpeg") },
            await authHeaders(userId),
          ),
        ),
      ]);
      const b1 = await r1.json();
      const b2 = await r2.json();
      expect(b1.data.storageKey).not.toBe(b2.data.storageKey);
      expect(objectStorageDouble.store.size).toBe(2);
    });
  });
});
