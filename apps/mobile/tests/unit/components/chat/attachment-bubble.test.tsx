import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import * as Sharing from "expo-sharing";
import { File } from "expo-file-system";
import { AttachmentBubble } from "@/components/chat/attachment-bubble";
import { chatAttachmentSource } from "@/api/chat";

jest.mock("@/api/chat");

const mockChatAttachmentSource = chatAttachmentSource as jest.Mock;

describe("AttachmentBubble", () => {
  beforeEach(() => {
    mockChatAttachmentSource.mockResolvedValue({ uri: "https://api.example.com/f", headers: {} });
  });

  it("renders an image tile for image mime types", async () => {
    await render(<AttachmentBubble url="/photo.png" mime="image/png" isMine={false} />);
    await waitFor(() => expect(mockChatAttachmentSource).toHaveBeenCalledWith("/photo.png"));
  });

  it("renders a voice note bubble for audio mime types", async () => {
    await render(<AttachmentBubble url="/note.m4a" mime="audio/mp4" isMine />);
    await waitFor(() => expect(mockChatAttachmentSource).toHaveBeenCalledWith("/note.m4a"));
  });

  it("renders a PDF file tile with the correct label for other mime types", async () => {
    await render(<AttachmentBubble url="/doc.pdf" mime="application/pdf" isMine={false} />);
    expect(screen.getByText("PDF document")).toBeTruthy();
  });

  it("renders a Word document label for wordprocessingml mime types", async () => {
    await render(
      <AttachmentBubble
        url="/doc.docx"
        mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        isMine={false}
      />,
    );
    expect(screen.getByText("Word document")).toBeTruthy();
  });

  it("falls back to a generic 'File' label for unknown mime types", async () => {
    await render(<AttachmentBubble url="/data.bin" mime="application/octet-stream" isMine={false} />);
    expect(screen.getByText("File")).toBeTruthy();
  });

  it("opens and shares a file tile when pressed", async () => {
    (File.downloadFileAsync as jest.Mock).mockResolvedValue({ uri: "file://cache/doc.pdf" });
    await render(<AttachmentBubble url="/doc.pdf" mime="application/pdf" isMine={false} />);

    await fireEvent.press(screen.getByText("PDF document"));

    await waitFor(() => {
      expect(Sharing.shareAsync).toHaveBeenCalledWith("file://cache/doc.pdf", { mimeType: "application/pdf" });
    });
  });

  it("alerts when opening the file fails", async () => {
    (File.downloadFileAsync as jest.Mock).mockRejectedValue(new Error("network error"));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<AttachmentBubble url="/doc.pdf" mime="application/pdf" isMine={false} />);

    await fireEvent.press(screen.getByText("PDF document"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Couldn't open file", "Please try again.");
    });
  });

  it("exposes an accessible 'Open <file type>' name and button role for a file tile", async () => {
    await render(<AttachmentBubble url="/doc.pdf" mime="application/pdf" isMine={false} />);
    expect(screen.getByRole("button", { name: "Open PDF document" })).toBeTruthy();
  });
});
