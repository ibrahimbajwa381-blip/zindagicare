import { SignJWT, jwtVerify, createRemoteJWKSet, decodeJwt } from "jose";

const ACCESS_TOKEN_TTL = "1h";
const REFRESH_TOKEN_TTL = "30d";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export type MobileTokenPayload = {
  sub: string;
  typ: "access" | "refresh";
};

export async function signMobileAccessToken(userId: string) {
  return new SignJWT({ typ: "access" } satisfies Omit<MobileTokenPayload, "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(getSecret());
}

export async function signMobileRefreshToken(userId: string) {
  return new SignJWT({ typ: "refresh" } satisfies Omit<MobileTokenPayload, "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .sign(getSecret());
}

export async function verifyMobileToken(token: string, expected: "access" | "refresh") {
  const { payload } = await jwtVerify(token, getSecret());
  if (payload.typ !== expected || typeof payload.sub !== "string") {
    throw new Error("Invalid token type");
  }
  return payload as unknown as MobileTokenPayload & { exp: number; iat: number };
}

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

function allowedGoogleAudiences() {
  return [
    process.env.GOOGLE_CLIENT_ID,
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
  ].filter((v): v is string => Boolean(v));
}

export async function verifyGoogleIdToken(idToken: string) {
  const audience = allowedGoogleAudiences();
  if (audience.length === 0) {
    throw new Error("No Google client IDs configured for mobile sign-in");
  }

  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience,
  });

  if (!payload.email || typeof payload.email !== "string") {
    throw new Error("Google token missing email");
  }
  if (payload.email_verified === false) {
    throw new Error("Google email not verified");
  }

  return {
    email: payload.email,
    sub: typeof payload.sub === "string" ? payload.sub : undefined,
    name: typeof payload.name === "string" ? payload.name : "Google User",
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}

/** Non-verifying decode, useful only for logging/debugging malformed tokens. */
export function unsafeDecodeGoogleIdToken(idToken: string) {
  return decodeJwt(idToken);
}
