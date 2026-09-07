import { File, UploadType } from "expo-file-system";

/**
 * Uploads a local file (from image-picker, document-picker, or a recorded voice note) as
 * multipart/form-data using expo-file-system's native uploader.
 *
 * We can't build this with fetch()/FormData() in JS: Expo SDK 57's FormData no longer accepts
 * the old React Native `{ uri, name, type }` shape ("Unsupported FormDataPart implementation"),
 * and React Native's own `Blob` constructor explicitly refuses ArrayBuffer/ArrayBufferView parts
 * ("Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not supported"). Native multipart
 * upload sidesteps both by encoding the body outside the JS FormData/Blob machinery entirely.
 */
export async function uploadFileMultipart<T>(
  url: string,
  fileUri: string,
  options: {
    mimeType: string;
    fieldName?: string;
    parameters?: Record<string, string>;
    accessToken?: string | null;
  },
): Promise<{ status: number; json: T }> {
  const file = new File(fileUri);
  const result = await file.upload(url, {
    httpMethod: "POST",
    uploadType: UploadType.MULTIPART,
    fieldName: options.fieldName ?? "file",
    mimeType: options.mimeType,
    parameters: options.parameters,
    headers: options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : undefined,
  });
  return { status: result.status, json: JSON.parse(result.body) as T };
}
