import { API_URL } from "@/lib/config";
import type { Role } from "@/lib/domain-types";
import { clearStoredTokens, getStoredTokens, setStoredTokens } from "@/lib/token-storage";

export type AuthUser = {
  id: string;
  email?: string;
  name?: string;
  image?: string;
  roles: Role[];
  onboardingCompleted: boolean;
  hasPhone: boolean;
  doctorVerificationStatus?: string;
  nurseVerificationStatus?: string;
  physiotherapistVerificationStatus?: string;
  herbalistVerificationStatus?: string;
  nutritionistVerificationStatus?: string;
};

type ApiEnvelope<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: { code: string; message: string } };

export class ApiRequestError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = await getStoredTokens();
  if (!refreshToken) return null;

  const res = await fetch(`${API_URL}/api/v1/mobile/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const json = (await res.json()) as ApiEnvelope<{ accessToken: string; refreshToken: string; user: AuthUser }>;
  if (!json.success) {
    await clearStoredTokens();
    return null;
  }

  await setStoredTokens(json.data.accessToken, json.data.refreshToken);
  return json.data.accessToken;
}

/** Fetch wrapper: attaches the stored access token and retries once after a silent refresh on 401. */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  { retry = true }: { retry?: boolean } = {},
): Promise<T> {
  const { accessToken } = await getStoredTokens();

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });

  const json = (await res.json()) as ApiEnvelope<T>;

  if (!json.success) {
    if (res.status === 401 && retry) {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newToken = await refreshPromise;
      if (newToken) {
        return apiFetch<T>(path, init, { retry: false });
      }
    }
    throw new ApiRequestError(json.error.message, json.error.code, res.status);
  }

  return json.data;
}
