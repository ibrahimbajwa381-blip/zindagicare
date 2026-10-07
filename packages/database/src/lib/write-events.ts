import type { Schema } from "mongoose";

/**
 * Model write notifications, so app-level caches can invalidate on any write
 * path (services, crons, scripts) without each call site remembering to.
 *
 * `fields` lists the top-level paths an update touched, or null when unknown
 * (inserts, deletes, bulk writes) — listeners should treat null as "anything changed".
 * Direct `Model.collection.*` driver calls bypass Mongoose and are not seen.
 */
export type ModelWriteEvent = {
  model: string;
  op: "insert" | "update" | "delete";
  fields: string[] | null;
  /**
   * What the write targeted, for listeners that need ids (e.g. which patient
   * a write belongs to): the saved/returned documents, or — for query writes
   * whose result isn't a document — the query filter. Empty when unknown.
   */
  targets: Record<string, unknown>[];
  /** The query filter for query writes (null for document saves), so listeners can look up affected rows. */
  filter: Record<string, unknown> | null;
};
export type ModelWriteListener = (event: ModelWriteEvent) => void;

// On globalThis so every bundle/module instance (route chunks, instrumentation,
// hot reload) shares one listener set.
const LISTENERS_KEY = Symbol.for("zindagi.database.modelWriteListeners");

function listeners(): Set<ModelWriteListener> {
  const g = globalThis as unknown as Record<symbol, Set<ModelWriteListener> | undefined>;
  return (g[LISTENERS_KEY] ??= new Set());
}

export function onModelWrite(listener: ModelWriteListener): () => void {
  listeners().add(listener);
  return () => listeners().delete(listener);
}

function emit(event: ModelWriteEvent) {
  for (const listener of listeners()) {
    try {
      listener(event);
    } catch (err) {
      console.error("[database] model write listener failed", err);
    }
  }
}

function topLevel(path: string) {
  return path.split(".")[0]!;
}

function fieldsFromUpdate(update: unknown): string[] | null {
  if (!update || typeof update !== "object") return null;
  if (Array.isArray(update)) return null; // aggregation pipeline update
  const fields = new Set<string>();
  for (const [key, value] of Object.entries(update as Record<string, unknown>)) {
    if (key.startsWith("$")) {
      if (value && typeof value === "object") {
        for (const path of Object.keys(value as Record<string, unknown>)) fields.add(topLevel(path));
      }
    } else {
      fields.add(topLevel(key));
    }
  }
  return [...fields];
}

type QueryLike = {
  getUpdate?: () => unknown;
  getFilter?: () => Record<string, unknown>;
  getOptions?: () => { upsert?: boolean };
};

/**
 * True when a query write provably changed nothing (0 modified/deleted, or a
 * findOneAnd* that matched no document) — e.g. periodic sweeps that usually
 * match no rows. Those must not invalidate caches.
 */
function isNoOp(self: unknown, result: unknown): boolean {
  const query = self as QueryLike;
  if (typeof query.getFilter !== "function") return false; // document middleware
  if (result === null || result === undefined) {
    // findOneAnd* matched nothing — unless it upserted (new: false returns null).
    return !query.getOptions?.().upsert;
  }
  if (typeof result !== "object") return false;
  const r = result as { modifiedCount?: number; upsertedCount?: number; deletedCount?: number };
  if (typeof r.modifiedCount === "number") return r.modifiedCount === 0 && !r.upsertedCount;
  if (typeof r.deletedCount === "number") return r.deletedCount === 0;
  return false;
}

function isDocument(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && "_id" in (value as object));
}

/** Document hooks run with `this` = the document; query hooks with `this` = the query. */
function writeContext(self: unknown, result: unknown) {
  const query = self as QueryLike;
  if (typeof query.getFilter !== "function") {
    return { filter: null, targets: [self as Record<string, unknown>] };
  }
  const filter = query.getFilter() ?? {};
  return { filter, targets: isDocument(result) ? [result] : [filter] };
}

type DocLike = {
  isNew?: boolean;
  modifiedPaths?: () => string[];
  $locals?: Record<string, unknown>;
};

export function attachWriteEvents(schema: Schema, model: string) {
  schema.pre("save", function () {
    const doc = this as unknown as DocLike;
    if (!doc.$locals) return;
    doc.$locals.__writeOp = doc.isNew ? "insert" : "update";
    doc.$locals.__writeFields = doc.isNew
      ? null
      : [...new Set((doc.modifiedPaths?.() ?? []).map(topLevel))];
  });

  schema.post("save", function () {
    const doc = this as unknown as DocLike;
    const op = (doc.$locals?.__writeOp as "insert" | "update" | undefined) ?? "update";
    const fields = (doc.$locals?.__writeFields as string[] | null | undefined) ?? null;
    emit({ model, op, fields, targets: [this as unknown as Record<string, unknown>], filter: null });
  });

  // updateOne/deleteOne also fire for `doc.updateOne()` / `doc.deleteOne()`;
  // there `this` is the document, so getUpdate is absent and fields is null.
  const updateHooks = ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace"] as const;
  for (const hook of updateHooks) {
    schema.post(hook, { document: true, query: true }, function (result: unknown) {
      if (isNoOp(this, result)) return;
      const query = this as unknown as QueryLike;
      emit({
        model,
        op: "update",
        fields: fieldsFromUpdate(query.getUpdate?.()),
        ...writeContext(this, result),
      });
    });
  }

  const deleteHooks = ["deleteOne", "deleteMany", "findOneAndDelete"] as const;
  for (const hook of deleteHooks) {
    schema.post(hook, { document: true, query: true }, function (result: unknown) {
      if (isNoOp(this, result)) return;
      emit({ model, op: "delete", fields: null, ...writeContext(this, result) });
    });
  }

  schema.post("insertMany", function (docs: unknown) {
    const targets = Array.isArray(docs) ? docs.filter(isDocument) : [];
    emit({ model, op: "insert", fields: null, targets, filter: null });
  });

  schema.post("bulkWrite", function () {
    emit({ model, op: "update", fields: null, targets: [], filter: null });
  });
}
