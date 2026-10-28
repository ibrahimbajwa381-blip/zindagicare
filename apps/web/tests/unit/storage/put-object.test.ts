/**
 * putObject: Supabase upload timeout and bucket-limit errors.
 * Supabase is fully mocked: no network, never real storage.
 */
const mockUpload = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: { from: () => ({ upload: mockUpload }) },
  }),
}));

import { AppError } from "@zindagi/shared";
import { mapUploadError, putObject } from "@/server/lib/object-storage";

describe("putObject", () => {
  const env = process.env;

  beforeAll(() => {
    process.env = {
      ...env,
      SUPABASE_URL: "http://storage.test",
      SUPABASE_SERVICE_ROLE_KEY: "test-key",
      SUPABASE_STORAGE_BUCKET: "test-bucket",
    };
  });

  afterAll(() => {
    process.env = env;
  });

  beforeEach(() => mockUpload.mockReset());

  test("resolves when storage accepts the file", async () => {
    mockUpload.mockResolvedValue({ data: { path: "p" }, error: null });
    await expect(
      putObject("chat-attachments", "t/a.webm", Buffer.from("x"), "audio/webm"),
    ).resolves.toBeUndefined();
  });

  test("times out with a 504 AppError instead of hanging", async () => {
    mockUpload.mockReturnValue(new Promise(() => {})); // never settles
    const error = await putObject(
      "chat-attachments",
      "t/a.webm",
      Buffer.from("x"),
      "audio/webm",
      20,
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(504);
    expect((error as AppError).code).toBe("STORAGE_TIMEOUT");
  });

  test("bucket size limit becomes a 413, not a 500", async () => {
    mockUpload.mockResolvedValue({
      data: null,
      error: { statusCode: "413", message: "The object exceeded the maximum allowed size" },
    });
    const error = await putObject("chat-attachments", "t/a.webm", Buffer.from("x"), "audio/webm")
      .catch((e: unknown) => e);
    expect((error as AppError).statusCode).toBe(413);
  });

  test("bucket MIME restriction becomes a 415, not a 500", async () => {
    mockUpload.mockResolvedValue({
      data: null,
      error: { statusCode: "415", message: "mime type audio/webm is not supported" },
    });
    const error = await putObject("chat-attachments", "t/a.webm", Buffer.from("x"), "audio/webm")
      .catch((e: unknown) => e);
    expect((error as AppError).statusCode).toBe(415);
  });
});

describe("mapUploadError", () => {
  test("other storage failures stay plain errors (500 via apiError)", () => {
    const error = mapUploadError({ statusCode: "500", message: "Internal" });
    expect(error).not.toBeInstanceOf(AppError);
    expect(error.message).toBe("Internal");
  });
});
