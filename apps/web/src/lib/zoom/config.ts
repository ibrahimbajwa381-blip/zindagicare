export type ZoomConfig = {
  accountId: string;
  clientId: string;
  clientSecret: string;
  hostUserId: string;
  sdkKey: string;
  sdkSecret: string;
};

function trimEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function useGeneralAppSdkCredentials(): boolean {
  return trimEnv(process.env.ZOOM_SDK_USE_CLIENT_ID) === "true";
}

export function isZoomConfigured(): boolean {
  const hasMeetingApiCredentials = Boolean(
    trimEnv(process.env.ZOOM_ACCOUNT_ID) &&
      trimEnv(process.env.ZOOM_CLIENT_ID) &&
      trimEnv(process.env.ZOOM_CLIENT_SECRET),
  );

  const hasSdkCredentials = useGeneralAppSdkCredentials()
    ? hasMeetingApiCredentials
    : Boolean(trimEnv(process.env.ZOOM_SDK_KEY) && trimEnv(process.env.ZOOM_SDK_SECRET));

  return hasMeetingApiCredentials && hasSdkCredentials;
}

export function getZoomConfig(): ZoomConfig {
  const accountId = trimEnv(process.env.ZOOM_ACCOUNT_ID);
  const clientId = trimEnv(process.env.ZOOM_CLIENT_ID);
  const clientSecret = trimEnv(process.env.ZOOM_CLIENT_SECRET);
  const sdkKey = trimEnv(process.env.ZOOM_SDK_KEY) ?? clientId ?? "";
  const sdkSecret = trimEnv(process.env.ZOOM_SDK_SECRET) ?? clientSecret ?? "";

  if (!accountId || !clientId || !clientSecret) {
    throw new Error(
      "Zoom meeting API is not configured. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET from your Server-to-Server OAuth app.",
    );
  }

  if (!useGeneralAppSdkCredentials() && (!sdkKey || !sdkSecret)) {
    throw new Error(
      "Zoom Meeting SDK is not configured. Set ZOOM_SDK_KEY and ZOOM_SDK_SECRET from an activated General app with Meeting SDK enabled, or set ZOOM_SDK_USE_CLIENT_ID=true to reuse your General app Client ID and Secret.",
    );
  }

  return {
    accountId,
    clientId,
    clientSecret,
    hostUserId: trimEnv(process.env.ZOOM_HOST_USER_ID) ?? "me",
    sdkKey,
    sdkSecret,
  };
}

export function getPublicZoomSdkKey(): string | null {
  if (useGeneralAppSdkCredentials()) {
    return trimEnv(process.env.NEXT_PUBLIC_ZOOM_SDK_KEY) ?? trimEnv(process.env.ZOOM_CLIENT_ID) ?? null;
  }
  return trimEnv(process.env.NEXT_PUBLIC_ZOOM_SDK_KEY) ?? trimEnv(process.env.ZOOM_SDK_KEY) ?? null;
}

/** Credentials used to sign Meeting SDK JWTs (General app Client ID + Secret). */
export function getZoomSdkSignatureCredentials(): {
  sdkKey: string;
  sdkSecret: string;
} {
  const config = getZoomConfig();
  return { sdkKey: config.sdkKey, sdkSecret: config.sdkSecret };
}
