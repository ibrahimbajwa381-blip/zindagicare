import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import DoctorProfileScreen from "@app/doctor/[doctorId]";
import { getConsultDoctor, listConsultSlots } from "@/api/consult";
import { ApiRequestError } from "@/api/client";
import { useLocalSearchParams, router } from "expo-router";

jest.mock("@/api/consult");

const mockGetConsultDoctor = getConsultDoctor as jest.Mock;
const mockListConsultSlots = listConsultSlots as jest.Mock;
const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;

const doctor = {
  doctorId: "doc-1",
  slug: "dr-ali",
  name: "Dr. Ali Raza",
  avatarUrl: undefined,
  specialties: ["Cardiology"],
  bio: "Experienced cardiologist.",
  experienceYears: 10,
  languages: ["English", "Urdu"],
  medicalDegree: "MBBS",
  qualifications: ["FCPS"],
  medicalCollege: "King Edward Medical University",
  graduationYear: 2010,
  hospitals: [{ name: "City Hospital", city: "Lahore", address: "Main Blvd" }],
  pmdcVerified: true,
  consultationFee: 2500,
  ratingAvg: 4.8,
  ratingCount: 12,
  availableSlots: 3,
  isFull: false,
  videoConsultEnabled: true,
};

function makeReview(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    patientName: "Patient " + id,
    rating: 5,
    comment: "Great!",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("DoctorProfileScreen", () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReturnValue({ doctorId: "doc-1" });
    mockGetConsultDoctor.mockResolvedValue({ doctor, reviews: [makeReview("r1")], reviewTotal: 1 });
    mockListConsultSlots.mockResolvedValue({ doctorId: "doc-1", slots: [] });
  });

  it("loads the doctor profile using the doctorId route param", async () => {
    await render(<DoctorProfileScreen />);
    await waitFor(() => expect(mockGetConsultDoctor).toHaveBeenCalledWith("doc-1"));
    expect(screen.getByText("Dr. Ali Raza")).toBeTruthy();
    expect(screen.getByText("Cardiology")).toBeTruthy();
    expect(screen.getByText("City Hospital, Lahore")).toBeTruthy();
    expect(screen.getByText("Experienced cardiologist.")).toBeTruthy();
    expect(screen.getByText("Rs. 2,500")).toBeTruthy();
    expect(screen.getByText("PMDC")).toBeTruthy();
    expect(screen.getByText("10+ yrs experience")).toBeTruthy();
  });

  it("shows an API error message when the doctor fails to load", async () => {
    mockGetConsultDoctor.mockRejectedValue(new ApiRequestError("Doctor not found", "NOT_FOUND", 404));
    await render(<DoctorProfileScreen />);
    expect(await screen.findByText("Doctor not found")).toBeTruthy();
  });

  it("does not crash and shows the error state when navigated to with a missing doctorId param", async () => {
    mockUseLocalSearchParams.mockReturnValue({});
    mockGetConsultDoctor.mockRejectedValue(new ApiRequestError("Doctor not found", "NOT_FOUND", 404));
    await render(<DoctorProfileScreen />);
    expect(await screen.findByText("Doctor not found")).toBeTruthy();
  });

  it("shows 'No reviews yet' when there are none", async () => {
    mockGetConsultDoctor.mockResolvedValue({ doctor, reviews: [], reviewTotal: 0 });
    await render(<DoctorProfileScreen />);
    expect(await screen.findByText("No reviews yet.")).toBeTruthy();
  });

  it("previews the first 3 reviews and expands to show more", async () => {
    const reviews = [makeReview("r1"), makeReview("r2"), makeReview("r3"), makeReview("r4")];
    mockGetConsultDoctor.mockResolvedValue({ doctor, reviews, reviewTotal: 4 });
    await render(<DoctorProfileScreen />);
    await waitFor(() => expect(screen.getByText("Patient r1")).toBeTruthy());
    expect(screen.queryByText("Patient r4")).toBeNull();
    expect(screen.getByText("See 1 more reviews")).toBeTruthy();

    await fireEvent.press(screen.getByText("See 1 more reviews"));
    expect(screen.getByText("Patient r4")).toBeTruthy();
    expect(screen.getByText("Show less")).toBeTruthy();
  });

  it("shows 'no slots' hint when there are no available slots", async () => {
    await render(<DoctorProfileScreen />);
    expect(await screen.findByText("No available slots in the next two weeks.")).toBeTruthy();
  });

  it("groups slots by day and navigates to checkout when one is selected", async () => {
    mockListConsultSlots.mockResolvedValue({
      doctorId: "doc-1",
      slots: [
        { slotId: "slot-1", startAt: "2026-03-02T05:00:00.000Z", endAt: "2026-03-02T05:30:00.000Z", status: "available" },
        { slotId: "slot-2", startAt: "2026-03-02T06:00:00.000Z", endAt: "2026-03-02T06:30:00.000Z", status: "available" },
        { slotId: "slot-3", startAt: "2026-03-03T05:00:00.000Z", endAt: "2026-03-03T05:30:00.000Z", status: "booked" },
      ],
    });
    await render(<DoctorProfileScreen />);
    await waitFor(() => expect(screen.queryByText("Loading available slots…")).toBeNull());

    const slotButtons = screen.getAllByText(/^\d{1,2}:\d{2}/);
    expect(slotButtons.length).toBe(2);

    await fireEvent.press(slotButtons[0]);
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/checkout",
      params: { doctorId: "doc-1", slotId: "slot-1", startAt: "2026-03-02T05:00:00.000Z" },
    });
  });
});

describe("DoctorProfileScreen accessibility", () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReturnValue({ doctorId: "doc-1" });
    mockGetConsultDoctor.mockResolvedValue({ doctor, reviews: [], reviewTotal: 0 });
  });

  it("exposes each time slot as an accessible button with a meaningful name (not just the bare time)", async () => {
    mockListConsultSlots.mockResolvedValue({
      doctorId: "doc-1",
      slots: [{ slotId: "slot-1", startAt: "2026-03-02T05:00:00.000Z", endAt: "2026-03-02T05:30:00.000Z", status: "available" }],
    });
    await render(<DoctorProfileScreen />);
    await waitFor(() => expect(screen.queryByText("Loading available slots…")).toBeNull());
    expect(screen.getByRole("button", { name: /Book .* slot/ })).toBeTruthy();
  });

  it("marks the selected date chip with the selected accessibility state", async () => {
    mockListConsultSlots.mockResolvedValue({
      doctorId: "doc-1",
      slots: [
        { slotId: "slot-1", startAt: "2026-03-02T05:00:00.000Z", endAt: "2026-03-02T05:30:00.000Z", status: "available" },
        { slotId: "slot-2", startAt: "2026-03-03T05:00:00.000Z", endAt: "2026-03-03T05:30:00.000Z", status: "available" },
      ],
    });
    await render(<DoctorProfileScreen />);
    await waitFor(() => expect(screen.queryByText("Loading available slots…")).toBeNull());

    const dateButtons = screen.getAllByRole("button").filter((b) => b.props.accessibilityState?.selected !== undefined);
    expect(dateButtons[0].props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(dateButtons[1].props.accessibilityState).toEqual(expect.objectContaining({ selected: false }));
  });

  it("announces a doctor-load error as an alert", async () => {
    mockGetConsultDoctor.mockRejectedValue(new ApiRequestError("Doctor not found", "NOT_FOUND", 404));
    await render(<DoctorProfileScreen />);
    const error = await screen.findByText("Doctor not found");
    expect(error.props.accessibilityRole).toBe("alert");
  });
});
