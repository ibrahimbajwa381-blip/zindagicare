import mongoose from "mongoose";

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

const cached = global.mongooseCache ?? { conn: null, promise: null };
global.mongooseCache = cached;

function isConnected() {
  return mongoose.connection.readyState === 1;
}

function resetCache() {
  cached.conn = null;
  cached.promise = null;
}

export async function connectDatabase(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not defined");
  }

  if (cached.conn && isConnected()) {
    return cached.conn;
  }

  // Dev hot-restarts can leave a dead handle in global cache.
  if (cached.conn && !isConnected()) {
    resetCache();
    await mongoose.disconnect().catch(() => undefined);
  }

  if (!cached.promise) {
    const options: mongoose.ConnectOptions = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 15_000,
    };

    // Force IPv4 only when needed (local Windows DNS). Vercel resolves SRV/IPv6 fine.
    if (process.env.MONGODB_FORCE_IPV4 === "true") {
      options.family = 4;
    }

    cached.promise = mongoose
      .connect(uri, options)
      .then((conn) => {
        cached.conn = conn;
        return conn;
      })
      .catch((error) => {
        resetCache();
        throw error;
      });
  }

  return cached.promise;
}
