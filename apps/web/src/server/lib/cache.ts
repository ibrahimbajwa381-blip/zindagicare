import mongoose from "mongoose";
import { onModelWrite, type ModelWriteEvent } from "@zindagi/database";
import { decryptField, encryptField, isEncrypted } from "@zindagi/shared";

/**
 * Shared read-through cache for public, non-personal data (directory listings,
 * public profiles, testimonials, platform settings).
 *
 * Backend, picked from env at first use:
 *   1. Upstash REST — UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *      (or KV_REST_API_URL + KV_REST_API_TOKEN from the Vercel integration)
 *   2. Redis over TCP — REDIS_URL
 *   3. In-process memory — when neither is set (single-instance best effort)
 *
 * Invalidation is tag-based: every entry records the version of each tag it
 * depends on, and `invalidateCacheTags` bumps those versions. A read fetches
 * the entry and its tag versions in a single MGET, so a bump instantly makes
 * every dependent entry stale on every instance without scanning keys.
 *
 * Tags are bumped automatically by Mongoose write hooks (see
 * `registerCacheInvalidation`), so any service, cron or script that writes a
 * provider profile, review, testimonial, user or appointment invalidates the
 * affected entries — call sites don't need to remember to.
 *
 * Per-patient entries (dashboard history, prescriptions, profile) are tagged
 * `patient:<userId>` and stored with `sensitive: true`, which AES-encrypts the
 * payload with FIELD_ENCRYPTION_KEY — the same protection that data has in
 * MongoDB — so Redis never holds plaintext medical data or PII.
 *
 * Redis failures never break a request — the loader runs uncached instead.
 * Never cache payment flows or slot-booking checks through this module.
 */

export const CacheTags = {
  DOCTORS: "doctors",
  NURSES: "nurses",
  PHYSIOTHERAPISTS: "physiotherapists",
  HERBALISTS: "herbalists",
  NUTRITIONISTS: "nutritionists",
  TESTIMONIALS: "testimonials",
  SETTINGS: "settings",
  /** Slot counts shown on doctor cards/profiles — bumped by appointment writes. */
  DOCTOR_AVAILABILITY: "doctor-availability",
  /** Public review lists on provider profiles. */
  REVIEWS: "reviews",
  /** Every patient's dashboard data — bumped when a write's patient can't be pinned down. */
  PATIENT_DATA: "patient-data",
} as const;

type StaticCacheTag = (typeof CacheTags)[keyof typeof CacheTags];
export type CacheTag = StaticCacheTag | `patient:${string}`;

/** Tag for one patient's cached dashboard data. */
export function patientCacheTag(userId: string): CacheTag {
  return `patient:${userId}`;
}

/** Tags every per-patient entry should carry. */
export function patientCacheTags(userId: string): CacheTag[] {
  return [CacheTags.PATIENT_DATA, patientCacheTag(userId)];
}

export const ALL_CACHE_TAGS = Object.values(CacheTags) as StaticCacheTag[];

type CacheOptions = {
  /** Seconds until the entry expires regardless of tag invalidation. */
  ttl: number;
  tags: CacheTag[];
  /** Encrypt the stored payload (PII / medical data). */
  sensitive?: boolean;
};

type Entry = { v: Record<string, number>; d: unknown };

type Backend = {
  mget(keys: string[]): Promise<(string | null)[]>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  incr(key: string): Promise<void>;
};

const PREFIX = "zc:";
const OP_TIMEOUT_MS = 800;

function tagKey(tag: string) {
  return `${PREFIX}tag:${tag}`;
}

function entryKey(key: string) {
  return `${PREFIX}c:${key}`;
}

/** Build a stable cache key from parts; empty/undefined parts become "_". */
export function cacheKey(...parts: (string | number | boolean | undefined | null)[]) {
  return parts
    .map((p) => (p === undefined || p === null || p === "" ? "_" : String(p).trim().toLowerCase()))
    .join(":");
}

function createMemoryBackend(): Backend {
  const store = new Map<string, { value: string; expiresAt: number }>();
  return {
    async mget(keys) {
      const now = Date.now();
      return keys.map((k) => {
        const hit = store.get(k);
        if (!hit) return null;
        if (hit.expiresAt <= now) {
          store.delete(k);
          return null;
        }
        return hit.value;
      });
    },
    async set(key, value, ttlSeconds) {
      if (store.size > 5000) store.clear();
      store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    },
    async incr(key) {
      const current = Number(store.get(key)?.value ?? 0);
      store.set(key, { value: String(current + 1), expiresAt: Number.POSITIVE_INFINITY });
    },
  };
}

async function createUpstashBackend(url: string, token: string): Promise<Backend> {
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({ url, token, automaticDeserialization: false });
  return {
    async mget(keys) {
      return (await redis.mget<(string | null)[]>(...keys)).map((v) =>
        v === null || v === undefined ? null : String(v),
      );
    },
    async set(key, value, ttlSeconds) {
      await redis.set(key, value, { ex: ttlSeconds });
    },
    async incr(key) {
      await redis.incr(key);
    },
  };
}

async function createTcpBackend(url: string): Promise<Backend> {
  const { createClient } = await import("redis");
  const client = createClient({
    url,
    socket: { connectTimeout: 5000, reconnectStrategy: (retries) => Math.min(retries * 200, 5000) },
  });
  client.on("error", (err) => logOnce("redis connection error", err));
  await client.connect();
  return {
    async mget(keys) {
      return client.mGet(keys);
    },
    async set(key, value, ttlSeconds) {
      await client.set(key, value, { EX: ttlSeconds });
    },
    async incr(key) {
      await client.incr(key);
    },
  };
}

let lastLogAt = 0;
function logOnce(message: string, err: unknown) {
  // Throttle so a Redis outage doesn't flood logs on every request.
  const now = Date.now();
  if (now - lastLogAt < 60_000) return;
  lastLogAt = now;
  console.error(`[cache] ${message}`, err instanceof Error ? err.message : err);
}

let backendPromise: Promise<Backend> | null = null;

function getBackend(): Promise<Backend> {
  if (!backendPromise) {
    const restUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const restToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    const tcpUrl = process.env.REDIS_URL;

    const create =
      restUrl && restToken
        ? createUpstashBackend(restUrl, restToken)
        : tcpUrl
          ? createTcpBackend(tcpUrl)
          : Promise.resolve(createMemoryBackend());

    backendPromise = create.catch((err) => {
      logOnce("redis unavailable, falling back to in-memory cache", err);
      return createMemoryBackend();
    });
  }
  return backendPromise;
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("cache operation timed out")), OP_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function cacheDisabled() {
  return process.env.NODE_ENV === "test" || process.env.CACHE_DISABLED === "true";
}

/** Concurrent misses for the same key on this instance share one loader call. */
const inflight = new Map<string, Promise<unknown>>();

/**
 * Return the cached value for `key`, or run `loader`, cache its result, and
 * return it. Values must be JSON-serializable (Dates come back as strings).
 */
export async function cached<T>(
  key: string,
  options: CacheOptions,
  loader: () => Promise<T>,
): Promise<T> {
  if (cacheDisabled()) return loader();

  const fullKey = entryKey(key);
  const tagKeys = options.tags.map(tagKey);

  let backend: Backend;
  let versions: Record<string, number> = {};
  try {
    backend = await getBackend();
    const [raw, ...tagValues] = await withTimeout(backend.mget([fullKey, ...tagKeys]));
    versions = Object.fromEntries(options.tags.map((t, i) => [t, Number(tagValues[i] ?? 0)]));

    if (raw) {
      const entry = JSON.parse(isEncrypted(raw) ? decryptField(raw) : raw) as Entry;
      const fresh = options.tags.every((t) => (entry.v[t] ?? 0) === versions[t]);
      if (fresh) return entry.d as T;
    }
  } catch (err) {
    logOnce(`read failed for ${key}`, err);
    return loader();
  }

  const pending = inflight.get(fullKey) as Promise<T> | undefined;
  if (pending) return pending;

  const load = (async () => {
    const data = await loader();
    try {
      const json = JSON.stringify({ v: versions, d: data } satisfies Entry);
      const payload = options.sensitive ? encryptField(json) : json;
      withTimeout(backend.set(fullKey, payload, options.ttl)).catch((err) =>
        logOnce(`write failed for ${key}`, err),
      );
    } catch (err) {
      logOnce(`serialize failed for ${key}`, err);
    }
    return data;
  })().finally(() => inflight.delete(fullKey));

  inflight.set(fullKey, load);
  return load;
}

const MAX_CACHED_BUFFER_BYTES = 512 * 1024;

/**
 * Cache a small binary (e.g. an avatar image) under `key` for `ttl` seconds.
 * Files over 512 KB are never stored in Redis and are loaded directly.
 * Only for immutable content — there is no tag invalidation.
 */
export async function cachedBuffer(
  key: string,
  ttl: number,
  loader: () => Promise<Buffer>,
): Promise<Buffer> {
  let fresh: Buffer | undefined;
  const base64 = await cached(key, { ttl, tags: [] }, async () => {
    fresh = await loader();
    return fresh.length <= MAX_CACHED_BUFFER_BYTES ? fresh.toString("base64") : null;
  });
  if (fresh) return fresh;
  if (base64 !== null) return Buffer.from(base64, "base64");
  return loader();
}

/** Mark every entry depending on any of `tags` as stale, across all instances. */
export async function invalidateCacheTags(tags: readonly CacheTag[]): Promise<void> {
  if (cacheDisabled() || tags.length === 0) return;
  try {
    const backend = await getBackend();
    await withTimeout(Promise.all([...new Set(tags)].map((t) => backend.incr(tagKey(t)))));
  } catch (err) {
    logOnce(`invalidate failed for ${tags.join(",")}`, err);
  }
}

type InvalidationRule = {
  tags: CacheTag[];
  /** Only these top-level fields matter for updates; omit to react to any update. */
  fields?: string[];
  /** Inserts can't affect any cached entry (e.g. a brand-new, unlisted user). */
  ignoreInserts?: boolean;
};

const PROVIDER_TAGS: CacheTag[] = [
  CacheTags.DOCTORS,
  CacheTags.NURSES,
  CacheTags.PHYSIOTHERAPISTS,
  CacheTags.HERBALISTS,
  CacheTags.NUTRITIONISTS,
];

/** Which cached data a write to each Mongoose model can change. */
const MODEL_RULES: Record<string, InvalidationRule> = {
  DoctorProfile: { tags: [CacheTags.DOCTORS] },
  StaffProfile: { tags: [CacheTags.NURSES, CacheTags.PHYSIOTHERAPISTS] },
  HerbalistProfile: { tags: [CacheTags.HERBALISTS] },
  NutritionistProfile: { tags: [CacheTags.NUTRITIONISTS] },
  Review: {
    tags: [CacheTags.DOCTORS, CacheTags.HERBALISTS, CacheTags.NUTRITIONISTS, CacheTags.REVIEWS],
  },
  HomeVisitReview: { tags: [CacheTags.NURSES, CacheTags.PHYSIOTHERAPISTS, CacheTags.REVIEWS] },
  Testimonial: { tags: [CacheTags.TESTIMONIALS] },
  SystemSettings: { tags: [CacheTags.SETTINGS] },
  // Provider cards show the user's name/photo and hide deactivated accounts;
  // review lists show the reviewing patient's name.
  User: {
    tags: [...PROVIDER_TAGS, CacheTags.REVIEWS],
    fields: ["name", "avatarUrl", "roles", "isActive", "deletedAt"],
    ignoreInserts: true,
  },
  Appointment: {
    tags: [CacheTags.DOCTOR_AVAILABILITY],
    fields: ["status", "scheduledStart", "scheduledEnd", "doctorId"],
  },
};

const pendingTags = new Set<CacheTag>();
let flushScheduled = false;
/** Invalidations started by write hooks that haven't reached Redis yet. */
const inflightInvalidations = new Set<Promise<unknown>>();

function track(promise: Promise<unknown>) {
  inflightInvalidations.add(promise);
  void promise.finally(() => inflightInvalidations.delete(promise));
}

/**
 * Wait for invalidations triggered by this instance's recent writes, so a
 * response is only sent once a follow-up read can't hit a stale entry.
 */
export async function flushCacheInvalidations(): Promise<void> {
  while (inflightInvalidations.size > 0 || flushScheduled) {
    await Promise.allSettled([...inflightInvalidations]);
    if (flushScheduled) await new Promise<void>((r) => queueMicrotask(r));
  }
}

/** Coalesce bursts of writes (bulk updates, loops) into one invalidation round. */
function queueInvalidation(tags: CacheTag[]) {
  for (const tag of tags) pendingTags.add(tag);
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(() => {
    flushScheduled = false;
    const batch = [...pendingTags];
    pendingTags.clear();
    track(invalidateCacheTags(batch));
  });
}

/**
 * Where each model stores the patient (user id) a write belongs to. Writes to
 * these models invalidate only that patient's dashboard entries.
 */
const PATIENT_ID_FIELDS: Record<string, string> = {
  Appointment: "patientId",
  Prescription: "patientId",
  Review: "patientId",
  Payment: "userId",
  PatientProfile: "userId",
  User: "_id",
};

/** Writes that change what *every* patient sees (doctor names/photos in history). */
function affectsAllPatients(event: ModelWriteEvent) {
  if (event.model === "DoctorProfile") return true;
  if (event.model === "User") {
    return event.op !== "insert" && (!event.fields || event.fields.some((f) => f === "name" || f === "avatarUrl"));
  }
  return false;
}

function idValues(value: unknown): string[] | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return [value];
  if (value instanceof mongoose.Types.ObjectId) return [value.toString()];
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if ("_id" in v) return idValues(v._id); // populated document
    if ("$eq" in v) return idValues(v.$eq);
    if (Array.isArray(v.$in)) {
      const ids = v.$in.map(idValues);
      return ids.some((x) => x === null) ? null : ids.flat() as string[];
    }
  }
  return null;
}

/**
 * Patient ids a write touched, or null when they can't be determined
 * (caller falls back to invalidating every patient).
 */
async function affectedPatientIds(event: ModelWriteEvent, field: string): Promise<string[] | null> {
  const fromTargets = event.targets.map((t) => idValues(t[field]));
  if (fromTargets.length > 0 && fromTargets.every((ids) => ids !== null)) {
    return fromTargets.flat() as string[];
  }

  // e.g. Appointment.updateOne({ _id }, …): look the rows up by _id. Only the
  // _id part of the filter is used — other conditions (status: "pending")
  // may no longer match after the update. Deleted rows can't be looked up.
  const byId = event.filter?._id;
  const Model = mongoose.models[event.model];
  if (event.op === "delete" || byId === undefined || !Model) return null;
  const rows = await Model.find({ _id: byId }).select(field).limit(200).lean<Record<string, unknown>[]>();
  if (rows.length >= 200) return null;
  const ids = rows.map((r) => idValues(r[field]));
  return ids.some((x) => x === null) ? null : (ids.flat() as string[]);
}

async function invalidatePatients(event: ModelWriteEvent) {
  if (affectsAllPatients(event)) {
    queueInvalidation([CacheTags.PATIENT_DATA]);
  }
  const field = PATIENT_ID_FIELDS[event.model];
  if (!field) return;
  const ids = await affectedPatientIds(event, field).catch(() => null);
  queueInvalidation(ids ? ids.map(patientCacheTag) : [CacheTags.PATIENT_DATA]);
}

function handleModelWrite(event: ModelWriteEvent) {
  track(invalidatePatients(event));

  const rule = MODEL_RULES[event.model];
  if (!rule) return;
  if (event.op === "insert" && rule.ignoreInserts) return;
  if (event.op === "update" && rule.fields && event.fields) {
    if (!event.fields.some((f) => rule.fields!.includes(f))) return;
  }
  queueInvalidation(rule.tags);
}

let unsubscribe: (() => void) | null = null;

/** Subscribe cache invalidation to Mongoose writes. Idempotent; called from instrumentation. */
export function registerCacheInvalidation() {
  if (unsubscribe || cacheDisabled()) return;
  unsubscribe = onModelWrite(handleModelWrite);
}

registerCacheInvalidation();
