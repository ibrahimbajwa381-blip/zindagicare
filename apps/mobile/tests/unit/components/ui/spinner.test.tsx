import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Spinner } from "@/components/ui/spinner";
import { colors } from "@/lib/theme";

describe("Spinner", () => {
  it("renders with default size and brand color", async () => {
    await render(<Spinner />);
    const ring = screen.toJSON();
    expect(ring).toBeTruthy();
    expect(ring?.props.style).toEqual(
      expect.objectContaining({ width: 24, height: 24, borderColor: colors.brand.DEFAULT }),
    );
  });

  it("applies the requested size", async () => {
    await render(<Spinner size="xl" />);
    const ring = screen.toJSON();
    expect(ring?.props.style).toEqual(expect.objectContaining({ width: 48, height: 48 }));
  });

  it("applies a custom color", async () => {
    await render(<Spinner color="#ff0000" />);
    const ring = screen.toJSON();
    expect(ring?.props.style).toEqual(expect.objectContaining({ borderColor: "#ff0000" }));
  });

  it("announces itself to screen readers as a loading indicator", async () => {
    await render(<Spinner />);
    expect(screen.getByRole("progressbar", { name: "Loading" })).toBeTruthy();
  });
});
