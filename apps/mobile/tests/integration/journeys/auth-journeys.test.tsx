// E2E journeys: Sections 4 and 5 — signup validation, and protected-route redirect behavior.
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import SignupScreen from "@app/(auth)/signup";
import LoginScreen from "@app/(auth)/login";
import TabsLayout from "@app/(tabs)/_layout";
import { useAuth } from "@/lib/auth-context";
import { useUnreadSummary } from "@/hooks/use-unread-summary";
import { router } from "expo-router";
import { expectedDateOfBirth } from "../../utils/expected-dob";
import { makeAuthUser, makeMockAuth } from "@/test-utils/mock-auth";

jest.mock("@/lib/auth-context", () => ({ isExpoGo: true, useAuth: jest.fn() }));
jest.mock("@/hooks/use-unread-summary", () => ({ useUnreadSummary: jest.fn(() => null) }));

const mockUseAuth = useAuth as jest.Mock;

describe("Section 4: Signup -> invalid input -> validation error -> correct input -> success", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(makeMockAuth());
  });

  it("blocks submission with real validation errors, then succeeds once every field is corrected (does not invent requirements)", async () => {
    const registerWithCredentials = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ registerWithCredentials }));
    await render(<SignupScreen />);

    // 1. Submit completely empty -> name is validated first.
    await fireEvent.press(screen.getByText("Create account"));
    expect(await screen.findByText("Enter your full name.")).toBeTruthy();
    expect(registerWithCredentials).not.toHaveBeenCalled();

    // 2. Fill name + email + phone but skip city -> city error next.
    await fireEvent.changeText(screen.getByPlaceholderText("Full name"), "Zara Iqbal");
    await fireEvent.changeText(screen.getByPlaceholderText("Email"), "zara@example.com");
    await fireEvent.changeText(screen.getByPlaceholderText("Phone (03XXXXXXXXX)"), "03211234567");
    await fireEvent.press(screen.getByText("Create account"));
    expect(await screen.findByText("Select your city.")).toBeTruthy();

    // 3. Select a city but give an invalid age.
    await fireEvent(screen.getByPlaceholderText("Type to search your city"), "focus");
    await fireEvent.press(screen.getByText("Karachi"));
    await fireEvent.changeText(screen.getByPlaceholderText("Age"), "5");
    await fireEvent.press(screen.getByText("Create account"));
    expect(await screen.findByText("Enter a valid age (13-120).")).toBeTruthy();

    // 4. Fix the age but use a too-short password.
    await fireEvent.changeText(screen.getByPlaceholderText("Age"), "30");
    await fireEvent.changeText(screen.getByPlaceholderText("Password (min 6 characters)"), "123");
    await fireEvent.press(screen.getByText("Create account"));
    expect(await screen.findByText("Password must be at least 6 characters.")).toBeTruthy();

    // 5. Fix the password but mismatch the confirmation.
    await fireEvent.changeText(screen.getByPlaceholderText("Password (min 6 characters)"), "goodpass1");
    await fireEvent.changeText(screen.getByPlaceholderText("Confirm password"), "different1");
    await fireEvent.press(screen.getByText("Create account"));
    expect(await screen.findByText("Passwords do not match.")).toBeTruthy();

    // 6. Correct everything -> submits successfully with no leftover error.
    await fireEvent.changeText(screen.getByPlaceholderText("Confirm password"), "goodpass1");
    await fireEvent.press(screen.getByText("Create account"));

    await waitFor(() => {
      expect(registerWithCredentials).toHaveBeenCalledWith({
        name: "Zara Iqbal",
        email: "zara@example.com",
        password: "goodpass1",
        confirmPassword: "goodpass1",
        phone: "03211234567",
        city: "Karachi",
        dateOfBirth: expectedDateOfBirth(30),
        accountType: "patient",
      });
    });
    expect(screen.queryByText("Passwords do not match.")).toBeNull();
  });

  it("shows the server's error message and lets the user retry after a signup failure (e.g. duplicate email)", async () => {
    const registerWithCredentials = jest
      .fn()
      .mockRejectedValueOnce(new Error("An account with this email already exists."))
      .mockResolvedValueOnce(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ registerWithCredentials }));
    await render(<SignupScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText("Full name"), "Zara Iqbal");
    await fireEvent.changeText(screen.getByPlaceholderText("Email"), "zara@example.com");
    await fireEvent.changeText(screen.getByPlaceholderText("Phone (03XXXXXXXXX)"), "03211234567");
    await fireEvent(screen.getByPlaceholderText("Type to search your city"), "focus");
    await fireEvent.press(screen.getByText("Karachi"));
    await fireEvent.changeText(screen.getByPlaceholderText("Age"), "30");
    await fireEvent.changeText(screen.getByPlaceholderText("Password (min 6 characters)"), "goodpass1");
    await fireEvent.changeText(screen.getByPlaceholderText("Confirm password"), "goodpass1");

    await fireEvent.press(screen.getByText("Create account"));
    expect(await screen.findByText("An account with this email already exists.")).toBeTruthy();

    // Retry without re-typing anything — all previously entered data must still be there.
    await fireEvent.press(screen.getByText("Create account"));
    await waitFor(() => expect(registerWithCredentials).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("An account with this email already exists.")).toBeNull();
  });

  it("navigates between signup and login via the header links without losing either screen's identity", async () => {
    await render(<SignupScreen />);
    await fireEvent.press(screen.getByText("Sign in"));
    expect(router.push).toHaveBeenCalledWith("/(auth)/login");

    await render(<LoginScreen />);
    await fireEvent.press(screen.getByText("Sign up"));
    expect(router.push).toHaveBeenCalledWith("/(auth)/signup");
  });
});

describe("Section 5: protected-route redirect behavior", () => {
  it("redirects an unauthenticated user away from a protected tab straight to login", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ isLoading: false, user: null }));
    await render(<TabsLayout />);
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
    expect(router.replace).toHaveBeenCalledTimes(1); // no redirect loop
  });

  it("does not redirect (and does not flash the login screen) while the session is still being restored", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ isLoading: true, user: null }));
    await render(<TabsLayout />);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("once signed in, does not bounce back to login on the next render (session correctly reflected)", async () => {
    const user = makeAuthUser({ roles: ["patient"] });
    mockUseAuth.mockReturnValue(makeMockAuth({ isLoading: false, user }));
    await render(<TabsLayout />);
    expect(router.replace).not.toHaveBeenCalledWith("/(auth)/login");
  });

  it("PRODUCT DECISION: login does not preserve/return to the screen that originally redirected the user (no return-route param is read or used)", async () => {
    // The app has no "redirect" / "next" query param support in LoginScreen — after signing in,
    // it always sends the user to their role's home area, never back to a specific prior screen.
    // This is documented here as an intentional product decision, not a bug.
    mockUseAuth.mockReturnValue(makeMockAuth({ user: makeAuthUser({ roles: ["patient"] }) }));
    await render(<LoginScreen />);
    expect(router.replace).toHaveBeenCalledWith("/(tabs)");
  });
});
