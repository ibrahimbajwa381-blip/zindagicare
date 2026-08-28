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
  const { accessToken } = await getStoredTokens();
  const url = path.startsWith("http") ? path : `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const destination = new File(Paths.cache, filename);

  const task = File.createDownloadTask(url, destination, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  const file = await task.downloadAsync();
  if (!file) {
    throw new Error("Couldn't download the file. Please try again.");
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri);
  }

  return file.uri;
}
