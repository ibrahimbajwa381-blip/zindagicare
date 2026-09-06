import React from "react";
import { render, screen } from "@testing-library/react-native";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";

describe("BrandLoadingScreen", () => {
  it("renders without a caption by default", async () => {
    await render(<BrandLoadingScreen />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it("renders the caption text when provided", async () => {
    await render(<BrandLoadingScreen caption="Loading your care team..." />);
    expect(screen.getByText("Loading your care team...")).toBeTruthy();
  });

  it("announces itself to screen readers as a loading indicator, using the caption as the accessible name when provided", async () => {
    await render(<BrandLoadingScreen caption="Loading your care team..." />);
    expect(screen.getByRole("progressbar", { name: "Loading your care team..." })).toBeTruthy();
  });

  it("falls back to a generic 'Loading' accessible name when there is no caption", async () => {
    await render(<BrandLoadingScreen />);
    expect(screen.getByRole("progressbar", { name: "Loading" })).toBeTruthy();
  });
});
