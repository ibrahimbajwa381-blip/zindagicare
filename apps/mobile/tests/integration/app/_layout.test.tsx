import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import { useFonts } from "@expo-google-fonts/plus-jakarta-sans";
import RootLayout from "@app/_layout";

jest.mock("@expo-google-fonts/plus-jakarta-sans", () => ({
  useFonts: jest.fn(() => [true, null]),
  PlusJakartaSans_400Regular: "PlusJakartaSans_400Regular",
  PlusJakartaSans_500Medium: "PlusJakartaSans_500Medium",
  PlusJakartaSans_600SemiBold: "PlusJakartaSans_600SemiBold",
  PlusJakartaSans_700Bold: "PlusJakartaSans_700Bold",
}));
jest.mock("@/components/ui/brand-loading-screen", () => {
  const { Text } = require("react-native");
  return { BrandLoadingScreen: () => <Text>BrandLoadingScreenStub</Text> };
});

const mockUseFonts = useFonts as jest.Mock;

describe("RootLayout", () => {
  it("shows the brand loading screen while fonts are still loading", async () => {
    mockUseFonts.mockReturnValue([false, null]);
    await render(<RootLayout />);
    expect(screen.getByText("BrandLoadingScreenStub")).toBeTruthy();
  });

  it("swaps to the app shell once fonts finish loading", async () => {
    mockUseFonts.mockReturnValue([true, null]);
    await render(<RootLayout />);
    await waitFor(() => expect(screen.queryByText("BrandLoadingScreenStub")).toBeNull());
  });

  it("also proceeds past loading when fonts fail with an error", async () => {
    mockUseFonts.mockReturnValue([false, new Error("font load failed")]);
    await render(<RootLayout />);
    await waitFor(() => expect(screen.queryByText("BrandLoadingScreenStub")).toBeNull());
  });
});
