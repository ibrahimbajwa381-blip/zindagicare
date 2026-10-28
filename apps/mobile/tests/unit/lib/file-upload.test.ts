import { UploadTimeoutError, uploadFileMultipart } from "@/lib/file-upload";

const mockUpload = jest.fn();

jest.mock("expo-file-system", () => ({
  UploadType: { MULTIPART: 1 },
  File: jest.fn().mockImplementation(() => ({ upload: mockUpload })),
}));

describe("uploadFileMultipart", () => {
  beforeEach(() => mockUpload.mockReset());

  it("returns status and parsed JSON", async () => {
    mockUpload.mockResolvedValue({ status: 200, body: '{"success":true}' });
    await expect(
      uploadFileMultipart("https://x/upload", "file://v.m4a", { mimeType: "audio/mp4" }),
    ).resolves.toEqual({ status: 200, json: { success: true } });
  });

  it("turns a non-JSON reply (e.g. 413 HTML page) into a clear error, not a SyntaxError", async () => {
    mockUpload.mockResolvedValue({ status: 413, body: "<html>Request Entity Too Large</html>" });
    await expect(
      uploadFileMultipart("https://x/upload", "file://v.m4a", { mimeType: "audio/mp4" }),
    ).rejects.toMatchObject({ message: "Upload failed (HTTP 413)", status: 413 });
  });

  it("passes an abort signal and times out with a clear error instead of hanging", async () => {
    mockUpload.mockImplementation(
      (_url: string, opts: { signal: AbortSignal }) =>
        new Promise((_, reject) =>
          opts.signal.addEventListener("abort", () => reject(new Error("AbortError"))),
        ),
    );
    await expect(
      uploadFileMultipart("https://x/upload", "file://v.m4a", { mimeType: "audio/mp4", timeoutMs: 20 }),
    ).rejects.toBeInstanceOf(UploadTimeoutError);
  });

  it("rethrows non-timeout failures unchanged", async () => {
    const boom = new Error("file unreadable");
    mockUpload.mockRejectedValue(boom);
    await expect(
      uploadFileMultipart("https://x/upload", "file://v.m4a", { mimeType: "audio/mp4" }),
    ).rejects.toBe(boom);
  });
});
