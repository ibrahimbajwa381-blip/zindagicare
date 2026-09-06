import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import LoginScreen from "@app/(auth)/login";
import { useAuth } from "@/lib/auth-context";
import { router } from "expo-router";
import { makeAuthUser, makeMockAuth } from "@/test-utils/mock-auth";

jest.mock("@/lib/auth-context", () => ({
  isExpoGo: true,
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;

describe("LoginScreen", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(makeMockAuth());
  });

  it("renders the sign-in form", async () => {
    await render(<LoginScreen />);
    expect(screen.getByPlaceholderText("Email")).toBeTruthy();
    expect(screen.getByPlaceholderText("Password")).toBeTruthy();
    expect(screen.getByText("Sign in")).toBeTruthy();
    expect(screen.getByText("Sign up")).toBeTruthy();
  });

  it("shows the Expo Go hint instead of the Google button when isExpoGo is true", async () => {
    await render(<LoginScreen />);
    expect(
      screen.getByText("Google sign-in needs a dev client build — use email/password to test in Expo Go."),
    ).toBeTruthy();
    expect(screen.queryByText("Continue with Google")).toBeNull();
  });

  it("submits trimmed, lowercased credentials on sign-in", async () => {
    const signInWithCredentials = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ signInWithCredentials }));
    await render(<LoginScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText("Email"), "  Test@Example.com  ");
    await fireEvent.changeText(screen.getByPlaceholderText("Password"), "secret123");
    await fireEvent.press(screen.getByText("Sign in"));

    await waitFor(() => {
      expect(signInWithCredentials).toHaveBeenCalledWith("test@example.com", "secret123");
    });
  });

  it("shows an error message when sign-in fails", async () => {
    const signInWithCredentials = jest.fn().mockRejectedValue(new Error("Invalid credentials"));
    mockUseAuth.mockReturnValue(makeMockAuth({ signInWithCredentials }));
    await render(<LoginScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText("Email"), "test@example.com");
    await fireEvent.changeText(screen.getByPlaceholderText("Password"), "wrong");
    await fireEvent.press(screen.getByText("Sign in"));

    expect(await screen.findByText("Invalid credentials")).toBeTruthy();
  });

  it("falls back to a generic error message for non-Error rejections", async () => {
    const signInWithCredentials = jest.fn().mockRejectedValue("boom");
    mockUseAuth.mockReturnValue(makeMockAuth({ signInWithCredentials }));
    await render(<LoginScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText("Email"), "test@example.com");
    await fireEvent.changeText(screen.getByPlaceholderText("Password"), "secret123");
    await fireEvent.press(screen.getByText("Sign in"));

    expect(await screen.findByText("Couldn't sign in. Please try again.")).toBeTruthy();
  });

  it("blocks submission and does not call the API when both fields are empty", async () => {
    const signInWithCredentials = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ signInWithCredentials }));
    await render(<LoginScreen />);

    await fireEvent.press(screen.getByText("Sign in"));

    expect(await screen.findByText("Couldn't sign in. Please try again.")).toBeTruthy();
    expect(signInWithCredentials).not.toHaveBeenCalled();
  });

  it("blocks submission when the email is whitespace-only", async () => {
    const signInWithCredentials = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ signInWithCredentials }));
    await render(<LoginScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText("Email"), "   ");
    await fireEvent.changeText(screen.getByPlaceholderText("Password"), "secret123");
    await fireEvent.press(screen.getByText("Sign in"));

    expect(await screen.findByText("Couldn't sign in. Please try again.")).toBeTruthy();
    expect(signInWithCredentials).not.toHaveBeenCalled();
  });

  it("blocks submission when the password is empty but the email is filled", async () => {
    const signInWithCredentials = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ signInWithCredentials }));
    await render(<LoginScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText("Email"), "test@example.com");
    await fireEvent.press(screen.getByText("Sign in"));

    expect(await screen.findByText("Couldn't sign in. Please try again.")).toBeTruthy();
    expect(signInWithCredentials).not.toHaveBeenCalled();
  });

  it("clears the required-field error and submits once both fields are corrected", async () => {
    const signInWithCredentials = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ signInWithCredentials }));
    await render(<LoginScreen />);

    await fireEvent.press(screen.getByText("Sign in"));
    expect(await screen.findByText("Couldn't sign in. Please try again.")).toBeTruthy();

    await fireEvent.changeText(screen.getByPlaceholderText("Email"), "test@example.com");
    await fireEvent.changeText(screen.getByPlaceholderText("Password"), "secret123");
    await fireEvent.press(screen.getByText("Sign in"));

    await waitFor(() => {
      expect(signInWithCredentials).toHaveBeenCalledWith("test@example.com", "secret123");
    });
    expect(screen.queryByText("Couldn't sign in. Please try again.")).toBeNull();
  });

  it("shows a spinner and disables sign-in while signing in", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ isSigningIn: true }));
    await render(<LoginScreen />);
    expect(screen.queryByText("Sign in")).toBeNull();
  });

  it("redirects to the doctor area when a doctor is already signed in", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: makeAuthUser({ roles: ["doctor"] }) }));
    await render(<LoginScreen />);
    expect(router.replace).toHaveBeenCalledWith("/(doctor)");
  });

  it("redirects to the patient tabs when a patient is already signed in", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: makeAuthUser({ roles: ["patient"] }) }));
    await render(<LoginScreen />);
    expect(router.replace).toHaveBeenCalledWith("/(tabs)");
  });

  it("navigates to signup via the sign up link", async () => {
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByText("Sign up"));
    expect(router.push).toHaveBeenCalledWith("/(auth)/signup");
  });
});

describe("LoginScreen accessibility", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(makeMockAuth());
  });

  it("exposes accessible names for the email and password inputs (not relying on placeholder alone)", async () => {
    await render(<LoginScreen />);
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
  });

  it("marks the password field as a secure text entry", async () => {
    await render(<LoginScreen />);
    expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(true);
  });

  it("exposes the sign-in button with an accessible button role and name, disabled while signing in", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ isSigningIn: true }));
    await render(<LoginScreen />);
    const button = screen.getByRole("button", { name: "Sign in" });
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
  });

  it("announces the sign-in error as an alert so screen reader users hear it immediately", async () => {
    const signInWithCredentials = jest.fn().mockRejectedValue(new Error("Invalid credentials"));
    mockUseAuth.mockReturnValue(makeMockAuth({ signInWithCredentials }));
    await render(<LoginScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("Email"), "test@example.com");
    await fireEvent.changeText(screen.getByPlaceholderText("Password"), "wrong");
    await fireEvent.press(screen.getByText("Sign in"));

    const error = await screen.findByText("Invalid credentials");
    expect(error.props.accessibilityRole).toBe("alert");
  });
});
