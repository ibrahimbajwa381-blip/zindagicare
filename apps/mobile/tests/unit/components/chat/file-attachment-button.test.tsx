import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { FileAttachmentButton } from "@/components/chat/file-attachment-button";
import { uploadChatFile } from "@/api/chat";

jest.mock("@/api/chat");
jest.mock("expo-document-picker");

const mockGetDocumentAsync = DocumentPicker.getDocumentAsync as jest.Mock;
const mockUploadChatFile = uploadChatFile as jest.Mock;

describe("FileAttachmentButton", () => {
  it("does nothing when the picker is cancelled", async () => {
    mockGetDocumentAsync.mockResolvedValue({ canceled: true, assets: [] });
    const onUploaded = jest.fn();
    await render(<FileAttachmentButton threadId="thread-1" onUploaded={onUploaded} />);
    await fireEvent.press(screen.root!);

    expect(mockUploadChatFile).not.toHaveBeenCalled();
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it("rejects files over 20MB without uploading", async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://big.pdf", name: "big.pdf", size: 21 * 1024 * 1024, mimeType: "application/pdf" }],
    });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<FileAttachmentButton threadId="thread-1" onUploaded={jest.fn()} />);
    await fireEvent.press(screen.root!);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("File too large", "Please choose a file under 20 MB.");
    });
    expect(mockUploadChatFile).not.toHaveBeenCalled();
  });

  it("uploads the selected file and reports the result", async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://doc.pdf", name: "doc.pdf", size: 1024, mimeType: "application/pdf" }],
    });
    mockUploadChatFile.mockResolvedValue({ storageKey: "k1", url: "/f/doc.pdf", mimeType: "application/pdf" });
    const onUploaded = jest.fn();
    await render(<FileAttachmentButton threadId="thread-1" onUploaded={onUploaded} />);
    await fireEvent.press(screen.root!);

    await waitFor(() => {
      expect(mockUploadChatFile).toHaveBeenCalledWith("thread-1", "file://doc.pdf", "application/pdf", "doc.pdf");
      expect(onUploaded).toHaveBeenCalledWith({ url: "/f/doc.pdf", mime: "application/pdf" });
    });
  });

  it("alerts when the upload fails", async () => {
    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://doc.pdf", name: "doc.pdf", size: 1024, mimeType: "application/pdf" }],
    });
    mockUploadChatFile.mockRejectedValue(new Error("network error"));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<FileAttachmentButton threadId="thread-1" onUploaded={jest.fn()} />);
    await fireEvent.press(screen.root!);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Couldn't send file", "Please try again.");
    });
  });

  it("is disabled when the disabled prop is true", async () => {
    await render(<FileAttachmentButton threadId="thread-1" onUploaded={jest.fn()} disabled />);
    await fireEvent.press(screen.root!);
    expect(mockGetDocumentAsync).not.toHaveBeenCalled();
  });

  it("exposes a meaningful accessible name for screen reader users (this is an icon-only button)", async () => {
    await render(<FileAttachmentButton threadId="thread-1" onUploaded={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Attach a file" })).toBeTruthy();
  });

  it("exposes the disabled state to assistive technology when disabled", async () => {
    await render(<FileAttachmentButton threadId="thread-1" onUploaded={jest.fn()} disabled />);
    expect(screen.getByRole("button", { name: "Attach a file" }).props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });
});
