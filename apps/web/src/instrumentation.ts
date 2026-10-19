export async function register() {
  // The import must sit inside this literal `=== "nodejs"` check (not after an
  // early return) so the bundler drops it from the Edge build — the cache
  // module pulls in `redis`, which needs Node built-ins like `stream`.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Wire Mongoose write hooks to Redis cache invalidation on every server
    // instance, even ones that never import a cached service.
    const { registerCacheInvalidation } = await import("@/server/lib/cache");
    registerCacheInvalidation();
  }
}
