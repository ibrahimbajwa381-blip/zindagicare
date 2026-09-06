import React from "react";
import { render } from "@testing-library/react-native";
import AuthLayout from "@app/(auth)/_layout";

describe("AuthLayout", () => {
  it("renders without crashing", async () => {
    await expect(render(<AuthLayout />)).resolves.toBeTruthy();
  });
});
