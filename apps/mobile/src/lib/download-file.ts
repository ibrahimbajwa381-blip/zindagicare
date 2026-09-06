import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { getStoredTokens } from "./token-storage";
import { API_URL } from "./config";

/**
 * Prescription/receipt file routes require a Bearer token (same as any other
 * v1 route) and stream raw bytes, not JSON — so Linking.openURL(downloadUrl)
 * on its own hits a 401. Download to cache with the auth header attached,
 * then hand off to the native share/"open in" sheet.
 */
export async function downloadAndOpenFile(path: string, filename: string) {
  const [{ accessToken }, canShare] = await Promise.all([getStoredTokens(), Sharing.isAvailableAsync()]);
  const url = path.startsWith("http") ? path : `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const destination = new File(Paths.cache, filename);

  const file = await File.downloadFileAsync(url, destination, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    // A same-named file from a previous download/share of this same document is expected
    // (re-opening the same prescription) — without this the whole download runs again and
    // only then rejects with DestinationAlreadyExists, wasting the entire download.
    idempotent: true,
  });
  if (!file) {
    throw new Error("Couldn't download the file. Please try again.");
  }

  if (canShare) {
    await Sharing.shareAsync(file.uri);
  }

  return file.uri;
}
