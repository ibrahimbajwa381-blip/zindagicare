export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Wire Mongoose write hooks to Redis cache invalidation on every server
  // instance, even ones that never import a cached service.
  const { registerCacheInvalidation } = await import("@/server/lib/cache");
  registerCacheInvalidation();
}
