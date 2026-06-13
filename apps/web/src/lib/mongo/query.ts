import { Types } from "mongoose";

/** Loosen Mongoose 8 strict filter typing for app-layer queries. */
export type MongoQueryFilter = Record<string, unknown>;

export function mongoFilter(filter: MongoQueryFilter): MongoQueryFilter {
  return filter;
}

/** Cast string ids for `$in` queries — Mongoose does not always coerce string arrays on ObjectId fields. */
export function mongoObjectIds(ids: string[]): Types.ObjectId[] {
  return ids
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));
}
