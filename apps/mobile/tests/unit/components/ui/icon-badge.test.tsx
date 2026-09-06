import React from "react";
import { render, screen } from "@testing-library/react-native";
import { IconBadge } from "@/components/ui/icon-badge";

describe("IconBadge", () => {
  it("renders nothing when count is zero", async () => {
    await render(<IconBadge count={0} />);
    expect(screen.toJSON()).toBeNull();
  });

  it("renders nothing when count is negative", async () => {
    await render(<IconBadge count={-3} />);
    expect(screen.toJSON()).toBeNull();
  });

  it("renders the exact count for small numbers", async () => {
    await render(<IconBadge count={5} />);
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("caps the displayed count at 9+", async () => {
    await render(<IconBadge count={10} />);
    expect(screen.getByText("9+")).toBeTruthy();
    expect(screen.queryByText("10")).toBeNull();
  });

  it("shows the boundary value 9 uncapped", async () => {
    await render(<IconBadge count={9} />);
    expect(screen.getByText("9")).toBeTruthy();
  });
});
