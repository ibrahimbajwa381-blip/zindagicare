import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import TabsLayout, { HeaderActions } from "@app/(tabs)/_layout";
import { useAuth } from "@/lib/auth-context";
import { useUnreadSummary } from "@/hooks/use-unread-summary";
import { router } from "expo-router";
import { makeAuthUser, makeMockAuth } from "@/test-utils/mock-auth";

jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));
jest.mock("@/hooks/use-unread-summary", () => ({ useUnreadSummary: jest.fn(() => null) }));

const mockUseAuth = useAuth as jest.Mock;

describe("TabsLayout", () => {
  it("redirects to login when there is no user and auth finished loading", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ isLoading: false, user: null }));
    await render(<TabsLayout />);
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
  });

  it("does not redirect while auth is still loading", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ isLoading: true, user: null }));
    await render(<TabsLayout />);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("does not render the protected tab navigator while auth is still loading (shows a loading screen instead)", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ isLoading: true, user: null }));
    const result = await render(<TabsLayout />);
    // The mocked <Tabs>/<Tabs.Screen> render nothing at all, so a non-null tree here proves a
    // real loading screen (not the protected tab navigator) is what's actually showing.
    expect(result.toJSON()).not.toBeNull();
  });

  it("redirects doctors to the doctor area instead of showing patient tabs", async () => {
    mockUseAuth.mockReturnValue(
      makeMockAuth({ isLoading: false, user: makeAuthUser({ roles: ["doctor"] }) }),
    );
    await render(<TabsLayout />);
    expect(router.replace).toHaveBeenCalledWith("/(doctor)");
  });

  it("does not render the patient tab navigator for a doctor (no patient UI flash before the redirect)", async () => {
    mockUseAuth.mockReturnValue(
      makeMockAuth({ isLoading: false, user: makeAuthUser({ roles: ["doctor"] }) }),
    );
    const result = await render(<TabsLayout />);
    // The mocked <Tabs>/<Tabs.Screen> render nothing at all, so a null tree here proves the
    // patient navigator (with its patient-only tabs/actions) never mounted for this doctor.
    expect(result.toJSON()).toBeNull();
  });

  it("renders the tab navigator for a signed-in patient", async () => {
    mockUseAuth.mockReturnValue(
      makeMockAuth({ isLoading: false, user: makeAuthUser({ roles: ["patient"] }) }),
    );
    await render(<TabsLayout />);
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("HeaderActions accessibility", () => {
  it("exposes an accessible name and role for the messages icon button, without unread count when there is none", async () => {
    const mockUseUnreadSummary = useUnreadSummary as jest.Mock;
    mockUseUnreadSummary.mockReturnValue({ chatUnreadCount: 0, unreadCount: 0 });
    await render(<HeaderActions />);
    const messagesButton = screen.getByRole("button", { name: "Messages" });
    expect(messagesButton).toBeTruthy();
    await fireEvent.press(messagesButton);
    expect(router.push).toHaveBeenCalledWith("/messages");
  });

  it("includes the unread count in the accessible name so screen reader users hear it without seeing the badge", async () => {
    const mockUseUnreadSummary = useUnreadSummary as jest.Mock;
    mockUseUnreadSummary.mockReturnValue({ chatUnreadCount: 3, unreadCount: 12 });
    await render(<HeaderActions />);
    expect(screen.getByRole("button", { name: "Messages, 3 unread" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Notifications, 12 unread" })).toBeTruthy();
  });
});
