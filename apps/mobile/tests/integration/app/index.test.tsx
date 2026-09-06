import React from "react";
import { render, screen } from "@testing-library/react-native";
import RootIndex from "@app/index";
import { useAuth } from "@/lib/auth-context";
import { router } from "expo-router";
import { makeAuthUser, makeMockAuth } from "@/test-utils/mock-auth";

jest.mock("@/lib/auth-context", () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;

describe("RootIndex", () => {
  it("shows the brand loading screen while auth is loading", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ isLoading: true }));
    await render(<RootIndex />);
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.toJSON()).toBeTruthy();
  });

  it("redirects to login when there is no signed-in user", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ isLoading: false, user: null }));
    await render(<RootIndex />);
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
  });

  it("redirects doctors to the doctor area", async () => {
    mockUseAuth.mockReturnValue(
      makeMockAuth({ isLoading: false, user: makeAuthUser({ roles: ["doctor"] }) }),
    );
    await render(<RootIndex />);
    expect(router.replace).toHaveBeenCalledWith("/(doctor)");
  });

  it("redirects patients to the tabs area", async () => {
    mockUseAuth.mockReturnValue(
      makeMockAuth({ isLoading: false, user: makeAuthUser({ roles: ["patient"] }) }),
    );
    await render(<RootIndex />);
    expect(router.replace).toHaveBeenCalledWith("/(tabs)");
  });
});
