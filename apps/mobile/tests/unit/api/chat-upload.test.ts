import { uploadChatVoiceNote } from "@/api/chat";
import { ApiRequestError, refreshAccessTokenShared } from "@/api/client";
import { uploadFileMultipart } from "@/lib/file-upload";
import { getStoredTokens } from "@/lib/token-storage";

jest.mock("@/lib/file-upload", () => ({ uploadFileMultipart: jest.fn() }));
jest.mock("@/lib/token-storage", () => ({ getStoredTokens: jest.fn() }));
jest.mock("@/api/client", () => ({
  ...jest.requireActual("@/api/client"),
  refreshAccessTokenShared: jest.fn(),
}));

const mockUpload = uploadFileMultipart as jest.Mock;
const mockTokens = getStoredTokens as jest.Mock;
const mockRefresh = refreshAccessTokenShared as jest.Mock;

const ok = { status: 200, json: { success: true, data: { storageKey: "k", url: "/v", mimeType: "audio/mp4" }, error: null } };
const unauthorized = { status: 401, json: { success: false, data: null, error: { code: "UNAUTHORIZED", message: "Unauthorized" } } };

describe("uploadChatVoiceNote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTokens.mockResolvedValue({ accessToken: "old", refreshToken: "r" });
  });

  it("uploads with the stored token", async () => {
    mockUpload.mockResolvedValue(ok);
    await expect(uploadChatVoiceNote("t", "file://v.m4a", "audio/mp4")).resolves.toMatchObject({ url: "/v" });
    expect(mockUpload).toHaveBeenCalledWith(expect.any(String), "file://v.m4a", expect.objectContaining({ accessToken: "old", mimeType: "audio/mp4" }));
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("refreshes an expired access token once and retries", async () => {
    mockUpload.mockResolvedValueOnce(unauthorized).mockResolvedValueOnce(ok);
    mockRefresh.mockResolvedValue("fresh");
    await expect(uploadChatVoiceNote("t", "file://v.m4a", "audio/mp4")).resolves.toMatchObject({ url: "/v" });
    expect(mockUpload).toHaveBeenCalledTimes(2);
    expect(mockUpload.mock.calls[1][2]).toMatchObject({ accessToken: "fresh" });
  });

  it("surfaces 401 when the refresh fails (logged out), without looping", async () => {
    mockUpload.mockResolvedValue(unauthorized);
    mockRefresh.mockResolvedValue(null);
    const error = await uploadChatVoiceNote("t", "file://v.m4a", "audio/mp4").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect((error as ApiRequestError).status).toBe(401);
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });

  it("storage rejection keeps the server's status and message", async () => {
    mockUpload.mockResolvedValue({
      status: 415,
      json: { success: false, data: null, error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "Storage does not accept this file type" } },
    });
    const error = (await uploadChatVoiceNote("t", "file://v.m4a", "audio/mp4").catch((e: unknown) => e)) as ApiRequestError;
    expect(error.status).toBe(415);
    expect(error.message).toBe("Storage does not accept this file type");
  });
});
