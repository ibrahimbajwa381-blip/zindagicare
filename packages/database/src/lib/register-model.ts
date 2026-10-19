import mongoose, { type Model, type Schema } from "mongoose";
import { attachWriteEvents } from "./write-events";

function mergeMissingSchemaPaths<T>(existing: Model<T>, schema: Schema<T>) {
  const missing: Record<string, unknown> = {};

  for (const [pathName, pathOptions] of Object.entries(schema.obj)) {
    if (!existing.schema.path(pathName)) {
      missing[pathName] = pathOptions;
    }
  }

  if (Object.keys(missing).length > 0) {
    existing.schema.add(missing);
  }
}

/** Safe model registration for Next.js hot reload and Edge avoidance at import sites. */
export function registerModel<T>(
  name: string,
  schema: Schema<T>,
): Model<T> {
  const existing = mongoose.models?.[name] as Model<T> | undefined;

  if (existing) {
    // Hot reload can keep an older schema (e.g. before new paths were added).
    mergeMissingSchemaPaths(existing, schema);
    return existing;
  }

  attachWriteEvents(schema as Schema, name);
  return mongoose.model<T>(name, schema);
}
