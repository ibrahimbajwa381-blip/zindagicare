import { downloadAndOpenFile } from "@/lib/download-file";
import { File } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as SecureStore from "expo-secure-store";

describe("downloadAndOpenFile", () => {
  beforeEach(async () => {
    await SecureStore.setItemAsync("zc_access_token", "token-123");
  });

  it("downloads with an auth header and shares the resulting file", async () => {
    const uri = await downloadAndOpenFile("/api/v1/prescriptions/rx-1.pdf", "rx-1.pdf");

    expect(File.createDownloadTask).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/prescriptions/rx-1.pdf",
      expect.objectContaining({ uri: "file://cache/rx-1.pdf" }),
      { headers: { Authorization: "Bearer token-123" } },
    );
    expect(Sharing.shareAsync).toHaveBeenCalledWith("file://cache/rx-1.pdf");
    expect(uri).toBe("file://cache/rx-1.pdf");
  });

  it("passes an absolute URL through unchanged", async () => {
    await downloadAndOpenFile("https://cdn.example.com/rx-1.pdf", "rx-1.pdf");
    expect(File.createDownloadTask).toHaveBeenCalledWith(
      "https://cdn.example.com/rx-1.pdf",
      expect.anything(),
      expect.anything(),
    );
  });

  it("throws when the download returns no file", async () => {
    (File.createDownloadTask as jest.Mock).mockReturnValueOnce({
      downloadAsync: jest.fn().mockResolvedValue(undefined),
    });
    await expect(downloadAndOpenFile("/x.pdf", "x.pdf")).rejects.toThrow(
      "Couldn't download the file. Please try again.",
    );
  });

  it("does not share when sharing is unavailable on the device", async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);
    await downloadAndOpenFile("/x.pdf", "x.pdf");
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });
});
