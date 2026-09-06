import { renderHook, waitFor } from "@testing-library/react-native";
import { useUnreadSummary } from "@/hooks/use-unread-summary";
import { getNotificationSummary } from "@/api/notifications";

jest.mock("@/api/notifications");

const mockGetSummary = getNotificationSummary as jest.Mock;

describe("useUnreadSummary", () => {
  it("returns null before the first load resolves", async () => {
    mockGetSummary.mockReturnValue(new Promise(() => {}));
    const { result } = await renderHook(() => useUnreadSummary());
    expect(result.current).toBeNull();
  });

  it("returns the summary once loaded", async () => {
    mockGetSummary.mockResolvedValue({ unreadCount: 3, chatUnreadCount: 2 });
    const { result } = await renderHook(() => useUnreadSummary());
    await waitFor(() => expect(result.current).toEqual({ unreadCount: 3, chatUnreadCount: 2 }));
  });

  it("stays null (does not throw) when the summary request fails", async () => {
    mockGetSummary.mockRejectedValue(new Error("network error"));
    const { result } = await renderHook(() => useUnreadSummary());
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current).toBeNull();
  });
});
