/** Resolve an ObjectId or populated `{ _id }` ref from a lean Mongoose document. */
export function resolveMongoRefId(ref: unknown): string {
  if (ref && typeof ref === "object" && "_id" in ref && ref._id != null) {
    return String((ref as { _id: unknown })._id);
  }
  return String(ref);
}
