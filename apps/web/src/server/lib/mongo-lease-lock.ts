import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { AppError, ErrorCodes } from "@zindagi/shared";

/**
 * Short mutual-exclusion lease stored in MongoDB, for check-then-write
 * sequences that a unique index can't express (e.g. "this provider has no
 * other visit within ±2h").
 *
 * One document per key in `lease_locks`, keyed by `_id` — always unique, so
 * it works on a fresh database without waiting for index builds. Expiry is
 * computed with the database clock ($$NOW), so app-server clock skew doesn't
 * matter, and a crashed holder only blocks the key until the lease expires.
 */
type LeaseDoc = { _id: string; owner: string; expiresAt: Date };

const COLLECTION = "lease_locks";

export type LeaseLockOptions = {
  /** How long a holder may keep the lock before others may take it. */
  leaseMs?: number;
  /** How long to keep retrying before giving up with `busyMessage`. */
  waitMs?: number;
  busyMessage?: string;
};

function collection() {
  return mongoose.connection.collection<LeaseDoc>(COLLECTION);
}

async function tryAcquire(key: string, owner: string, leaseMs: number): Promise<boolean> {
  try {
    // One atomic update on the key's document (created if missing). The
    // pipeline takes the lease only if it is free — no document yet, or
    // expired by the database clock — and otherwise leaves the holder as is.
    // ($expr isn't allowed in an upsert filter, so the decision lives here.)
    const free = { $lte: ["$expiresAt", "$$NOW"] }; // also true when missing
    const doc = await collection().findOneAndUpdate(
      { _id: key },
      [
        {
          $set: {
            owner: { $cond: [free, owner, "$owner"] },
            expiresAt: { $cond: [free, { $add: ["$$NOW", leaseMs] }, "$expiresAt"] },
          },
        },
      ],
      { upsert: true, returnDocument: "after" },
    );
    return doc?.owner === owner;
  } catch (err) {
    // Upsert collided with a live lease held by someone else.
    if ((err as { code?: number })?.code === 11000) return false;
    throw err;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withLeaseLock<T>(key: string, task: () => Promise<T>, options: LeaseLockOptions = {}): Promise<T> {
  const {
    leaseMs = 15_000,
    waitMs = 3_000,
    busyMessage = "This is being updated by someone else right now — please try again",
  } = options;
  const owner = randomUUID();
  const deadline = Date.now() + waitMs;

  let attempt = 0;
  while (!(await tryAcquire(key, owner, leaseMs))) {
    if (Date.now() >= deadline) {
      throw new AppError(busyMessage, ErrorCodes.CONFLICT, 409);
    }
    // Short jittered backoff: holders keep the lock for a few DB round trips.
    await sleep(Math.min(200, 10 * 2 ** attempt) * (0.5 + Math.random()));
    attempt += 1;
  }

  try {
    return await task();
  } finally {
    // Only our own lease: if it expired and someone else took it, leave theirs.
    await collection()
      .deleteOne({ _id: key, owner })
      .catch(() => {});
  }
}
