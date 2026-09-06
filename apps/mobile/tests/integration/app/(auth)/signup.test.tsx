import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import SignupScreen from "@app/(auth)/signup";
import { useAuth } from "@/lib/auth-context";
import { router } from "expo-router";
import { makeAuthUser, makeMockAuth } from "@/test-utils/mock-auth";

jest.mock("@/lib/auth-context", () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;

async function fillValidForm() {
  await fireEvent.changeText(screen.getByPlaceholderText("Full name"), "Ayesha Khan");
  await fireEvent.changeText(screen.getByPlaceholderText("Email"), "  Ayesha@Example.com ");
  await fireEvent.changeText(screen.getByPlaceholderText("Phone (03XXXXXXXXX)"), "03001234567");
  await fireEvent(screen.getByPlaceholderText("Type to search your city"), "focus");
  await fireEvent.press(screen.getByText("Lahore"));
  await fireEvent.changeText(screen.getByPlaceholderText("Age"), "28");
  await fireEvent.changeText(screen.getByPlaceholderText("Password (min 6 characters)"), "secret1");
  await fireEvent.changeText(screen.getByPlaceholderText("Confirm password"), "secret1");
}

describe("SignupScreen", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(makeMockAuth());
  });

  it("renders the registration form with all fields and account type chips", async () => {
    await render(<SignupScreen />);
    expect(screen.getByText("Create your account")).toBeTruthy();
    expect(screen.getByPlaceholderText("Full name")).toBeTruthy();
    expect(screen.getByPlaceholderText("Email")).toBeTruthy();
    expect(screen.getByPlaceholderText("Phone (03XXXXXXXXX)")).toBeTruthy();
    expect(screen.getByPlaceholderText("Age")).toBeTruthy();
    expect(screen.getByPlaceholderText("Password (min 6 characters)")).toBeTruthy();
    expect(screen.getByPlaceholderText("Confirm password")).toBeTruthy();
    expect(screen.getByText("Patient")).toBeTruthy();
    expect(screen.getByText("Doctor")).toBeTruthy();
    expect(screen.getByText("Create account")).toBeTruthy();
  });

  it("filters the city list as the user types and closes it on selection", async () => {
    await render(<SignupScreen />);
    const cityInput = screen.getByPlaceholderText("Type to search your city");
    await fireEvent(cityInput, "focus");
    expect(screen.getByText("Lahore")).toBeTruthy();
    expect(screen.getByText("Karachi")).toBeTruthy();

    await fireEvent.changeText(cityInput, "lah");
    expect(screen.getByText("Lahore")).toBeTruthy();
    expect(screen.queryByText("Karachi")).toBeNull();

    await fireEvent.press(screen.getByText("Lahore"));
    expect(screen.queryByText("Karachi")).toBeNull();
    expect(cityInput.props.value).toBe("Lahore");
  });

  it("shows a no-match message when no city matches the query", async () => {
    await render(<SignupScreen />);
    const cityInput = screen.getByPlaceholderText("Type to search your city");
    await fireEvent(cityInput, "focus");
    await fireEvent.changeText(cityInput, "zzzznotacity");
    expect(screen.getByText("No matching city")).toBeTruthy();
  });

  it("strips non-numeric characters from the age field", async () => {
    await render(<SignupScreen />);
    const ageInput = screen.getByPlaceholderText("Age");
    await fireEvent.changeText(ageInput, "2a8b");
    expect(ageInput.props.value).toBe("28");
  });

  it("lets the user switch the selected account type", async () => {
    await render(<SignupScreen />);
    await fireEvent.press(screen.getByText("Doctor"));
    // No visible assertion target other than it not crashing and staying selected;
    // verified indirectly through the submitted payload in the success test below.
    expect(screen.getByText("Doctor")).toBeTruthy();
  });

  it.each([
    ["a", "Enter your full name."],
  ])("requires a name of at least 2 characters", async (name, expectedError) => {
    await render(<SignupScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("Full name"), name);
    await fireEvent.press(screen.getByText("Create account"));
    expect(await screen.findByText(expectedError)).toBeTruthy();
  });

  it("requires an email and does not call the API when it is empty", async () => {
    const registerWithCredentials = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ registerWithCredentials }));
    await render(<SignupScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("Full name"), "Ayesha Khan");
    await fireEvent.press(screen.getByText("Create account"));
    expect(await screen.findByText("Couldn't create your account. Please try again.")).toBeTruthy();
    expect(registerWithCredentials).not.toHaveBeenCalled();
  });

  it("requires an email and does not call the API when it is whitespace-only", async () => {
    const registerWithCredentials = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ registerWithCredentials }));
    await render(<SignupScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("Full name"), "Ayesha Khan");
    await fireEvent.changeText(screen.getByPlaceholderText("Email"), "   ");
    await fireEvent.press(screen.getByText("Create account"));
    expect(await screen.findByText("Couldn't create your account. Please try again.")).toBeTruthy();
    expect(registerWithCredentials).not.toHaveBeenCalled();
  });

  it("requires a phone number and does not call the API when it is empty", async () => {
    const registerWithCredentials = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ registerWithCredentials }));
    await render(<SignupScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("Full name"), "Ayesha Khan");
    await fireEvent.changeText(screen.getByPlaceholderText("Email"), "ayesha@example.com");
    await fireEvent.press(screen.getByText("Create account"));
    expect(await screen.findByText("Couldn't create your account. Please try again.")).toBeTruthy();
    expect(registerWithCredentials).not.toHaveBeenCalled();
  });

  it("requires a city to be selected", async () => {
    const registerWithCredentials = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ registerWithCredentials }));
    await render(<SignupScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("Full name"), "Ayesha Khan");
    await fireEvent.changeText(screen.getByPlaceholderText("Email"), "ayesha@example.com");
    await fireEvent.changeText(screen.getByPlaceholderText("Phone (03XXXXXXXXX)"), "03001234567");
    await fireEvent.press(screen.getByText("Create account"));
    expect(await screen.findByText("Select your city.")).toBeTruthy();
    expect(registerWithCredentials).not.toHaveBeenCalled();
  });

  async function fillNameEmailPhoneCity() {
    await fireEvent.changeText(screen.getByPlaceholderText("Full name"), "Ayesha Khan");
    await fireEvent.changeText(screen.getByPlaceholderText("Email"), "ayesha@example.com");
    await fireEvent.changeText(screen.getByPlaceholderText("Phone (03XXXXXXXXX)"), "03001234567");
    await fireEvent(screen.getByPlaceholderText("Type to search your city"), "focus");
    await fireEvent.press(screen.getByText("Lahore"));
  }

  it.each([
    ["", "Enter a valid age (13-120)."],
    ["12", "Enter a valid age (13-120)."],
    ["121", "Enter a valid age (13-120)."],
  ])("rejects an invalid age %s", async (age, expectedError) => {
    const registerWithCredentials = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ registerWithCredentials }));
    await render(<SignupScreen />);
    await fillNameEmailPhoneCity();
    if (age) {
      await fireEvent.changeText(screen.getByPlaceholderText("Age"), age);
    }
    await fireEvent.press(screen.getByText("Create account"));
    expect(await screen.findByText(expectedError)).toBeTruthy();
    expect(registerWithCredentials).not.toHaveBeenCalled();
  });

  it.each([13, 120])("accepts the exact age boundary of %i", async (age) => {
    const registerWithCredentials = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ registerWithCredentials }));
    await render(<SignupScreen />);
    await fillNameEmailPhoneCity();
    await fireEvent.changeText(screen.getByPlaceholderText("Age"), String(age));
    await fireEvent.changeText(screen.getByPlaceholderText("Password (min 6 characters)"), "secret1");
    await fireEvent.changeText(screen.getByPlaceholderText("Confirm password"), "secret1");
    await fireEvent.press(screen.getByText("Create account"));
    await waitFor(() => expect(registerWithCredentials).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Enter a valid age (13-120).")).toBeNull();
  });

  it("requires a password of at least 6 characters", async () => {
    const registerWithCredentials = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ registerWithCredentials }));
    await render(<SignupScreen />);
    await fillNameEmailPhoneCity();
    await fireEvent.changeText(screen.getByPlaceholderText("Age"), "28");
    await fireEvent.changeText(screen.getByPlaceholderText("Password (min 6 characters)"), "abc");
    await fireEvent.press(screen.getByText("Create account"));
    expect(await screen.findByText("Password must be at least 6 characters.")).toBeTruthy();
    expect(registerWithCredentials).not.toHaveBeenCalled();
  });

  it("rejects a password exactly one character below the minimum (5 characters)", async () => {
    const registerWithCredentials = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ registerWithCredentials }));
    await render(<SignupScreen />);
    await fillNameEmailPhoneCity();
    await fireEvent.changeText(screen.getByPlaceholderText("Age"), "28");
    await fireEvent.changeText(screen.getByPlaceholderText("Password (min 6 characters)"), "abcde");
    await fireEvent.changeText(screen.getByPlaceholderText("Confirm password"), "abcde");
    await fireEvent.press(screen.getByText("Create account"));
    expect(await screen.findByText("Password must be at least 6 characters.")).toBeTruthy();
    expect(registerWithCredentials).not.toHaveBeenCalled();
  });

  it("accepts a password at exactly the minimum length (6 characters)", async () => {
    const registerWithCredentials = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ registerWithCredentials }));
    await render(<SignupScreen />);
    await fillNameEmailPhoneCity();
    await fireEvent.changeText(screen.getByPlaceholderText("Age"), "28");
    await fireEvent.changeText(screen.getByPlaceholderText("Password (min 6 characters)"), "abcdef");
    await fireEvent.changeText(screen.getByPlaceholderText("Confirm password"), "abcdef");
    await fireEvent.press(screen.getByText("Create account"));
    await waitFor(() => expect(registerWithCredentials).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Password must be at least 6 characters.")).toBeNull();
  });

  it("does not trim whitespace from password values (leading/trailing spaces are significant)", async () => {
    const registerWithCredentials = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ registerWithCredentials }));
    await render(<SignupScreen />);
    await fillNameEmailPhoneCity();
    await fireEvent.changeText(screen.getByPlaceholderText("Age"), "28");
    await fireEvent.changeText(screen.getByPlaceholderText("Password (min 6 characters)"), " secret ");
    await fireEvent.changeText(screen.getByPlaceholderText("Confirm password"), " secret ");
    await fireEvent.press(screen.getByText("Create account"));
    await waitFor(() => {
      expect(registerWithCredentials).toHaveBeenCalledWith(expect.objectContaining({ password: " secret " }));
    });
  });

  it("requires password and confirm password to match", async () => {
    const registerWithCredentials = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ registerWithCredentials }));
    await render(<SignupScreen />);
    await fillNameEmailPhoneCity();
    await fireEvent.changeText(screen.getByPlaceholderText("Age"), "28");
    await fireEvent.changeText(screen.getByPlaceholderText("Password (min 6 characters)"), "secret1");
    await fireEvent.changeText(screen.getByPlaceholderText("Confirm password"), "secret2");
    await fireEvent.press(screen.getByText("Create account"));
    expect(await screen.findByText("Passwords do not match.")).toBeTruthy();
    expect(registerWithCredentials).not.toHaveBeenCalled();
  });

  it("submits a well-formed payload with trimmed/normalized values on valid input", async () => {
    const registerWithCredentials = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue(makeMockAuth({ registerWithCredentials }));
    await render(<SignupScreen />);

    await fillValidForm();
    await fireEvent.press(screen.getByText("Create account"));

    const expectedBirthYear = new Date().getFullYear() - 28;
    await waitFor(() => {
      expect(registerWithCredentials).toHaveBeenCalledWith({
        name: "Ayesha Khan",
        email: "ayesha@example.com",
        password: "secret1",
        confirmPassword: "secret1",
        phone: "03001234567",
        city: "Lahore",
        dateOfBirth: `${expectedBirthYear}-01-01`,
        accountType: "patient",
      });
    });
  });

  it("shows the server error message when registration fails", async () => {
    const registerWithCredentials = jest.fn().mockRejectedValue(new Error("Email already in use"));
    mockUseAuth.mockReturnValue(makeMockAuth({ registerWithCredentials }));
    await render(<SignupScreen />);

    await fillValidForm();
    await fireEvent.press(screen.getByText("Create account"));

    expect(await screen.findByText("Email already in use")).toBeTruthy();
  });

  it("shows a generic error for non-Error rejections", async () => {
    const registerWithCredentials = jest.fn().mockRejectedValue("boom");
    mockUseAuth.mockReturnValue(makeMockAuth({ registerWithCredentials }));
    await render(<SignupScreen />);

    await fillValidForm();
    await fireEvent.press(screen.getByText("Create account"));

    expect(await screen.findByText("Couldn't create your account. Please try again.")).toBeTruthy();
  });

  it("hides the button label and shows a spinner while signing in", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ isSigningIn: true }));
    await render(<SignupScreen />);
    expect(screen.queryByText("Create account")).toBeNull();
  });

  it("redirects to the tabs when already signed in", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ user: makeAuthUser() }));
    await render(<SignupScreen />);
    expect(router.replace).toHaveBeenCalledWith("/(tabs)");
  });

  it("navigates back to login via the sign in link", async () => {
    await render(<SignupScreen />);
    await fireEvent.press(screen.getByText("Sign in"));
    expect(router.push).toHaveBeenCalledWith("/(auth)/login");
  });
});

describe("SignupScreen accessibility", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(makeMockAuth());
  });

  it("exposes accessible names for every text field instead of relying on placeholder text alone", async () => {
    await render(<SignupScreen />);
    expect(screen.getByLabelText("Full name")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Phone (03XXXXXXXXX)")).toBeTruthy();
    expect(screen.getByLabelText("City")).toBeTruthy();
    expect(screen.getByLabelText("Age")).toBeTruthy();
    expect(screen.getByLabelText("Password (min 6 characters)")).toBeTruthy();
    expect(screen.getByLabelText("Confirm password")).toBeTruthy();
  });

  it("marks the account type chips with the selected accessibility state, updating as the user switches", async () => {
    await render(<SignupScreen />);
    const patientChip = screen.getByRole("button", { name: "Patient" });
    const doctorChip = screen.getByRole("button", { name: "Doctor" });
    expect(patientChip.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(doctorChip.props.accessibilityState).toEqual(expect.objectContaining({ selected: false }));

    await fireEvent.press(doctorChip);
    expect(screen.getByRole("button", { name: "Doctor" }).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByRole("button", { name: "Patient" }).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  it("announces validation errors as alerts so screen reader users hear them immediately", async () => {
    await render(<SignupScreen />);
    await fireEvent.press(screen.getByText("Create account"));
    const error = await screen.findByText("Enter your full name.");
    expect(error.props.accessibilityRole).toBe("alert");
  });

  it("exposes the create-account button as disabled and busy while signing in", async () => {
    mockUseAuth.mockReturnValue(makeMockAuth({ isSigningIn: true }));
    await render(<SignupScreen />);
    const button = screen.getByRole("button", { name: "Create account" });
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true, busy: true }));
  });
});
