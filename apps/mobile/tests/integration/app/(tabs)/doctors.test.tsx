import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import DoctorsScreen from "@app/(tabs)/doctors";
import { listConsultDoctors } from "@/api/consult";
import { ApiRequestError } from "@/api/client";
import { router } from "expo-router";

jest.mock("@/api/consult");

const mockListConsultDoctors = listConsultDoctors as jest.Mock;

const doctor = {
  doctorId: "doc-1",
  name: "Dr. Ali Raza",
  avatarUrl: undefined,
  specialties: ["Cardiology", "Internal Medicine"],
  ratingAvg: 4.567,
  ratingCount: 32,
  pmdcVerified: true,
  consultationFee: 2000,
  hospital: "City Hospital",
  qualifications: [],
  availableSlots: 5,
  isFull: false,
};

describe("DoctorsScreen", () => {
  beforeEach(() => {
    mockListConsultDoctors.mockResolvedValue([doctor]);
  });

  it("loads doctors for the default city on mount", async () => {
    await render(<DoctorsScreen />);
    await waitFor(() => {
      expect(mockListConsultDoctors).toHaveBeenCalledWith({ city: "Lahore", specialty: undefined });
    });
    expect(screen.getByText("Dr. Ali Raza")).toBeTruthy();
  });

  it("renders doctor card details: specialty, hospital, rating, fee, verified badge, and slots", async () => {
    await render(<DoctorsScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Ali Raza")).toBeTruthy());
    expect(screen.getByText("Cardiology, Internal Medicine")).toBeTruthy();
    expect(screen.getByText("City Hospital")).toBeTruthy();
    expect(screen.getByText("4.6")).toBeTruthy();
    expect(screen.getByText("(32)")).toBeTruthy();
    expect(screen.getByText("Rs. 2000")).toBeTruthy();
    expect(screen.getByText("PMDC")).toBeTruthy();
    expect(screen.getByText("5 slots this week")).toBeTruthy();
  });

  it("shows a 'no slots' label and disables the card when the doctor is full", async () => {
    mockListConsultDoctors.mockResolvedValue([{ ...doctor, isFull: true, availableSlots: 0 }]);
    await render(<DoctorsScreen />);
    await waitFor(() => expect(screen.getByText("No slots available")).toBeTruthy());
    await fireEvent.press(screen.getByText("Dr. Ali Raza"));
    expect(router.push).not.toHaveBeenCalled();
  });

  it("navigates to the doctor profile when a card is pressed", async () => {
    await render(<DoctorsScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Ali Raza")).toBeTruthy());
    await fireEvent.press(screen.getByText("Dr. Ali Raza"));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/doctor/[doctorId]", params: { doctorId: "doc-1" } });
  });

  it("shows the empty state when no doctors match", async () => {
    mockListConsultDoctors.mockResolvedValue([]);
    await render(<DoctorsScreen />);
    await waitFor(() => expect(screen.getByText("No doctors found for this search.")).toBeTruthy());
  });

  it("shows an API error message when loading fails", async () => {
    mockListConsultDoctors.mockRejectedValue(new ApiRequestError("City not recognized", "BAD_CITY", 400));
    await render(<DoctorsScreen />);
    await waitFor(() => expect(screen.getByText("City not recognized")).toBeTruthy());
  });

  it("shows a generic error message for a non-API failure", async () => {
    mockListConsultDoctors.mockRejectedValue(new Error("boom"));
    await render(<DoctorsScreen />);
    await waitFor(() => expect(screen.getByText("Failed to load doctors")).toBeTruthy());
  });

  it("searches with the updated city and specialty filters", async () => {
    await render(<DoctorsScreen />);
    await waitFor(() => expect(mockListConsultDoctors).toHaveBeenCalledTimes(1));

    await fireEvent.changeText(screen.getByPlaceholderText("City"), "Karachi");
    await fireEvent.changeText(screen.getByPlaceholderText("Specialty"), "Dermatology");
    await fireEvent.press(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(mockListConsultDoctors).toHaveBeenCalledWith({ city: "Karachi", specialty: "Dermatology" });
    });
  });

  it("searches on submit editing from the input fields", async () => {
    await render(<DoctorsScreen />);
    await waitFor(() => expect(mockListConsultDoctors).toHaveBeenCalledTimes(1));

    await fireEvent.changeText(screen.getByPlaceholderText("City"), "Multan");
    await fireEvent(screen.getByPlaceholderText("City"), "submitEditing");

    await waitFor(() => {
      expect(mockListConsultDoctors).toHaveBeenCalledWith({ city: "Multan", specialty: undefined });
    });
  });

  it("does not get stuck in a permanent loading state when the API returns a malformed (null) success payload", async () => {
    mockListConsultDoctors.mockResolvedValue(null);
    await render(<DoctorsScreen />);

    // A malformed "success with null" response should resolve to the empty state, not hang forever
    // showing a spinner (which is indistinguishable from "still loading" to the user).
    expect(await screen.findByText("No doctors found for this search.")).toBeTruthy();
  });

  it("shows an error message (without losing existing data) when a subsequent search fails", async () => {
    await render(<DoctorsScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Ali Raza")).toBeTruthy());

    mockListConsultDoctors.mockRejectedValueOnce(new ApiRequestError("Network error", "NETWORK", 0));
    await fireEvent.changeText(screen.getByPlaceholderText("City"), "Karachi");
    await fireEvent.press(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("Network error")).toBeTruthy();
    expect(screen.getByText("Dr. Ali Raza")).toBeTruthy();
  });

  it("renders a large (1,000-row) doctor list through the real component tree without crashing", async () => {
    const largeList = Array.from({ length: 1000 }, (_, i) => ({
      ...doctor,
      doctorId: `doc-${i}`,
      name: i === 500 ? "" : `Dr. Test Doctor ${i}`, // includes an edge case: an empty name mid-list
      ratingAvg: 3 + (i % 20) / 10,
      ratingCount: i,
      isFull: i % 7 === 0,
      availableSlots: i % 7 === 0 ? 0 : (i % 5) + 1,
      hospital: i % 3 === 0 ? undefined : `Hospital ${i}`,
    }));
    mockListConsultDoctors.mockResolvedValue(largeList);

    await render(<DoctorsScreen />);

    // The real renderItem/card logic must run against the full 1,000-row dataset without
    // the screen crashing or hanging — including the empty-name edge case mid-list.
    expect(await screen.findByText("Dr. Test Doctor 0")).toBeTruthy();
    expect(screen.getAllByText("Rs. 2000").length).toBeGreaterThan(0);
    expect(mockListConsultDoctors).toHaveBeenCalledTimes(1);
  });

});

describe("DoctorsScreen accessibility", () => {
  beforeEach(() => {
    mockListConsultDoctors.mockResolvedValue([doctor]);
  });

  it("exposes accessible names for the city and specialty filter inputs and the search button", async () => {
    await render(<DoctorsScreen />);
    expect(screen.getByLabelText("City")).toBeTruthy();
    expect(screen.getByLabelText("Specialty")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Search" })).toBeTruthy();
  });

  it("exposes each doctor card as an accessible, tappable button", async () => {
    await render(<DoctorsScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Ali Raza")).toBeTruthy());
    expect(screen.getByRole("button", { name: /Dr\. Ali Raza/ })).toBeTruthy();
  });

  it("marks a fully-booked doctor's card as disabled to assistive technology", async () => {
    mockListConsultDoctors.mockResolvedValue([{ ...doctor, isFull: true }]);
    await render(<DoctorsScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Ali Raza")).toBeTruthy());
    expect(screen.getByRole("button", { name: /Dr\. Ali Raza/ }).props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });

  it("announces a load error as an alert", async () => {
    mockListConsultDoctors.mockRejectedValue(new ApiRequestError("Network error", "NETWORK", 0));
    await render(<DoctorsScreen />);
    const error = await screen.findByText("Network error");
    expect(error.props.accessibilityRole).toBe("alert");
  });
});

// Kept as the last describe in the file: it resolves promises outside of React's automatic
// batching in a way that can leave the act() environment in a state that affects whatever test
// runs immediately after it in this same file, so nothing is appended below it.
describe("DoctorsScreen race conditions", () => {
  beforeEach(() => {
    mockListConsultDoctors.mockResolvedValue([doctor]);
  });

  it("does not let a slow initial-load response overwrite a faster, later search result", async () => {
    let resolveA: (v: unknown) => void;
    let resolveB: (v: unknown) => void;
    const requestA = new Promise((resolve) => {
      resolveA = resolve;
    });
    const requestB = new Promise((resolve) => {
      resolveB = resolve;
    });
    mockListConsultDoctors.mockImplementationOnce(() => requestA).mockImplementationOnce(() => requestB);

    await render(<DoctorsScreen />); // triggers the initial mount load (call A, city=Lahore), pending

    await fireEvent.changeText(screen.getByPlaceholderText("City"), "Karachi");
    fireEvent.press(screen.getByRole("button", { name: "Search" })); // triggers a second load (call B, city=Karachi), pending

    const karachiDoctor = { ...doctor, doctorId: "doc-karachi", name: "Dr. Karachi Result" };
    await act(async () => {
      resolveB!([karachiDoctor]); // the newer search (B) resolves first
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByText("Dr. Karachi Result")).toBeTruthy());

    const lahoreDoctor = { ...doctor, doctorId: "doc-lahore", name: "Dr. Lahore Result" };
    await act(async () => {
      resolveA!([lahoreDoctor]); // the stale initial load (A) resolves late
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Dr. Karachi Result")).toBeTruthy();
    expect(screen.queryByText("Dr. Lahore Result")).toBeNull();
  });
});
