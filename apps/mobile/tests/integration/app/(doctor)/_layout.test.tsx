import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import DoctorLayout, { HeaderActions } from "@app/(doctor)/_layout";
import { useAuth } from "@/lib/auth-context";
import { useUnreadSummary } from "@/hooks/use-unread-summary";
import { router } from "expo-router";
import { makeAuthUser, makeMockAuth } from "@/test-utils/mock-auth";

jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));
jest.mock("@/hooks/use-unread-summary", () => ({ useUnreadSummary: jest.fn(() => null) }));

const mockUseAuth = useAuth as jest.Mock;

describe("DoctorLayout", () => {
  it("redirects to login when signed out", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ isLoading: false, user: null }));
    await render(<DoctorLayout />);
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
  });

  it("does not redirect while loading", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ isLoading: true, user: null }));
    await render(<DoctorLayout />);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("does not render the protected tab navigator while auth is still loading (shows a loading screen instead)", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ isLoading: true, user: null }));
    const result = await render(<DoctorLayout />);
    // The mocked <Tabs>/<Tabs.Screen> render nothing at all, so a non-null tree here proves a
    // real loading screen (not the protected doctor navigator) is what's actually showing.
    expect(result.toJSON()).not.toBeNull();
  });

  it("redirects a non-doctor user to the patient tabs", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ isLoading: false, user: makeAuthUser({ roles: ["patient"] }) }));
    await render(<DoctorLayout />);
    expect(router.replace).toHaveBeenCalledWith("/(tabs)");
  });

  it("does not render the doctor tab navigator for a patient (no doctor UI flash before the redirect)", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ isLoading: false, user: makeAuthUser({ roles: ["patient"] }) }));
    const result = await render(<DoctorLayout />);
    // The mocked <Tabs>/<Tabs.Screen> render nothing at all, so a null tree here proves the
    // doctor navigator (with its doctor-only tabs/actions) never mounted for this patient.
    expect(result.toJSON()).toBeNull();
  });

  it("does not redirect a signed-in doctor", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ isLoading: false, user: makeAuthUser({ roles: ["doctor"] }) }));
    await render(<DoctorLayout />);
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("HeaderActions accessibility", () => {
  it("exposes an accessible name and role for the messages and notifications icon buttons", async () => {
    const mockUseUnreadSummary = useUnreadSummary as jest.Mock;
    mockUseUnreadSummary.mockReturnValue({ chatUnreadCount: 0, unreadCount: 0 });
    await render(<HeaderActions />);
    const messagesButton = screen.getByRole("button", { name: "Messages" });
    await fireEvent.press(messagesButton);
    expect(router.push).toHaveBeenCalledWith("/(doctor)/messages");
    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
  });

  it("includes the unread count in the accessible name", async () => {
    const mockUseUnreadSummary = useUnreadSummary as jest.Mock;
    mockUseUnreadSummary.mockReturnValue({ chatUnreadCount: 5, unreadCount: 1 });
    await render(<HeaderActions />);
    expect(screen.getByRole("button", { name: "Messages, 5 unread" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Notifications, 1 unread" })).toBeTruthy();
  });
});
