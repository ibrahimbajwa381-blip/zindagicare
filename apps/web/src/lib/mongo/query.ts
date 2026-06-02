/** Loosen Mongoose 8 strict filter typing for app-layer queries. */
export type MongoQueryFilter = Record<string, unknown>;

export function mongoFilter(filter: MongoQueryFilter): MongoQueryFilter {
  return filter;
}
