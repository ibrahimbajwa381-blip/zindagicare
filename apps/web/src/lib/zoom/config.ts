export type ZoomConfig = {
  accountId: string;
  clientId: string;
  clientSecret: string;
  hostUserId: string;
  sdkKey: string;
  sdkSecret: string;
};

export function isZoomConfigured(): boolean {
  return Boolean(
    process.env.ZOOM_ACCOUNT_ID &&
      process.env.ZOOM_CLIENT_ID &&
      process.env.ZOOM_CLIENT_SECRET &&
      process.env.ZOOM_SDK_KEY &&
      process.env.ZOOM_SDK_SECRET,
  );
}

export function getZoomConfig(): ZoomConfig {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  const sdkKey = process.env.ZOOM_SDK_KEY;
  const sdkSecret = process.env.ZOOM_SDK_SECRET;

  if (!accountId || !clientId || !clientSecret || !sdkKey || !sdkSecret) {
    throw new Error(
      "Zoom is not configured. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_SDK_KEY, and ZOOM_SDK_SECRET.",
    );
  }

  return {
    accountId,
    clientId,
    clientSecret,
    hostUserId: process.env.ZOOM_HOST_USER_ID ?? "me",
    sdkKey,
    sdkSecret,
  };
}

export function getPublicZoomSdkKey(): string | null {
  if (process.env.ZOOM_SDK_USE_CLIENT_ID === "true") {
    return process.env.ZOOM_CLIENT_ID ?? null;
  }
  return process.env.NEXT_PUBLIC_ZOOM_SDK_KEY ?? process.env.ZOOM_SDK_KEY ?? null;
}

/** Credentials used to sign Meeting SDK JWTs. */
export function getZoomSdkSignatureCredentials(): {
  sdkKey: string;
  sdkSecret: string;
} {
  const config = getZoomConfig();
  if (process.env.ZOOM_SDK_USE_CLIENT_ID === "true") {
    return { sdkKey: config.clientId, sdkSecret: config.clientSecret };
  }
  return { sdkKey: config.sdkKey, sdkSecret: config.sdkSecret };
}
