import mongoose, { type Model, type Schema } from "mongoose";

/** Safe model registration for Next.js hot reload and Edge avoidance at import sites. */
export function registerModel<T>(
  name: string,
  schema: Schema<T>,
): Model<T> {
  if (mongoose.models?.[name]) {
    return mongoose.models[name] as Model<T>;
  }
  return mongoose.model<T>(name, schema);
}
