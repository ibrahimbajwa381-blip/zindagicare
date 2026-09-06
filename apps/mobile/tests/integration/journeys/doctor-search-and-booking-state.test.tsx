// E2E journeys: Sections 6 and 7 — doctor search, and per-doctor state isolation across
// Doctor A -> back -> Doctor B navigation (no cross-contamination of doctor data or slots).
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import DoctorsScreen from "@app/(tabs)/doctors";
import DoctorProfileScreen from "@app/doctor/[doctorId]";
import { router, useLocalSearchParams } from "expo-router";
import { listConsultDoctors, getConsultDoctor, listConsultSlots } from "@/api/consult";

jest.mock("@/api/consult");

const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;
const mockListConsultDoctors = listConsultDoctors as jest.Mock;
const mockGetConsultDoctor = getConsultDoctor as jest.Mock;
const mockListConsultSlots = listConsultSlots as jest.Mock;

function makeDoctor(id: string, name: string, fee: number) {
  return {
    doctorId: id,
    slug: id,
    name,
    avatarUrl: undefined,
    specialties: ["General Medicine"],
    bio: `${name}'s bio`,
    experienceYears: 3,
    languages: ["English"],
    medicalDegree: "MBBS",
    qualifications: [],
    medicalCollege: "",
    graduationYear: undefined,
    hospitals: [],
    pmdcVerified: false,
    consultationFee: fee,
    ratingAvg: 4,
    ratingCount: 1,
    availableSlots: 1,
    isFull: false,
    videoConsultEnabled: true,
  };
}

describe("Section 6: doctor search journey", () => {
  it("searches, opens a result, goes back to search, and opens a different doctor", async () => {
    mockListConsultDoctors.mockResolvedValue([
      { ...makeDoctor("doc-a", "Dr. Ayesha Noor", 1500), qualifications: [], hospital: "City Hospital" },
      { ...makeDoctor("doc-b", "Dr. Bilal Khan", 2200), qualifications: [], hospital: "Shifa Hospital" },
    ]);
    await render(<DoctorsScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Ayesha Noor")).toBeTruthy());
    expect(screen.getByText("Dr. Bilal Khan")).toBeTruthy();

    await fireEvent.press(screen.getByText("Dr. Ayesha Noor"));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: "/doctor/[doctorId]", params: { doctorId: "doc-a" } });

    // Back to search results (a fresh DoctorsScreen instance, as the real navigator would show).
    mockListConsultDoctors.mockResolvedValue([
      { ...makeDoctor("doc-a", "Dr. Ayesha Noor", 1500), qualifications: [], hospital: "City Hospital" },
      { ...makeDoctor("doc-b", "Dr. Bilal Khan", 2200), qualifications: [], hospital: "Shifa Hospital" },
    ]);
    await render(<DoctorsScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Khan")).toBeTruthy());
    await fireEvent.press(screen.getByText("Dr. Bilal Khan"));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: "/doctor/[doctorId]", params: { doctorId: "doc-b" } });
  });

  it("rapid successive searches settle on the last-typed filter's results (no old-results flash on new query text)", async () => {
    mockListConsultDoctors.mockResolvedValueOnce([makeDoctor("doc-1", "Dr. One", 1000)]);
    await render(<DoctorsScreen />);
    await waitFor(() => expect(screen.getByText("Dr. One")).toBeTruthy());

    mockListConsultDoctors.mockResolvedValueOnce([]);
    await fireEvent.changeText(screen.getByPlaceholderText("Specialty"), "Neurosurgery");
    await fireEvent.press(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("No doctors found for this search.")).toBeTruthy();
    expect(screen.queryByText("Dr. One")).toBeNull();
  });

  it("Section 7: opening Doctor A then Doctor B never shows Doctor A's profile data on Doctor B's screen", async () => {
    // Doctor A
    mockUseLocalSearchParams.mockReturnValue({ doctorId: "doc-a" });
    mockGetConsultDoctor.mockResolvedValue({ doctor: makeDoctor("doc-a", "Dr. Ayesha Noor", 1500), reviews: [], reviewTotal: 0 });
    mockListConsultSlots.mockResolvedValue({
      doctorId: "doc-a",
      slots: [{ slotId: "a-slot", startAt: "2026-05-01T05:00:00.000Z", endAt: "2026-05-01T05:30:00.000Z", status: "available" }],
    });
    const first = await render(<DoctorProfileScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Ayesha Noor")).toBeTruthy());
    expect(screen.getByText("Rs. 1,500")).toBeTruthy();
    await fireEvent.press(await screen.findByText(/^\d{1,2}:\d{2}/));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/checkout",
      params: { doctorId: "doc-a", slotId: "a-slot", startAt: "2026-05-01T05:00:00.000Z" },
    });
    first.unmount(); // simulate leaving the screen via back navigation

    // Doctor B — a completely separate mounted instance with its own params/data.
    mockUseLocalSearchParams.mockReturnValue({ doctorId: "doc-b" });
    mockGetConsultDoctor.mockResolvedValue({ doctor: makeDoctor("doc-b", "Dr. Bilal Khan", 2200), reviews: [], reviewTotal: 0 });
    mockListConsultSlots.mockResolvedValue({
      doctorId: "doc-b",
      slots: [{ slotId: "b-slot", startAt: "2026-05-02T05:00:00.000Z", endAt: "2026-05-02T05:30:00.000Z", status: "available" }],
    });
    await render(<DoctorProfileScreen />);
    await waitFor(() => expect(mockGetConsultDoctor).toHaveBeenLastCalledWith("doc-b"));
    expect(screen.getByText("Dr. Bilal Khan")).toBeTruthy();
    expect(screen.getByText("Rs. 2,200")).toBeTruthy();
    expect(screen.queryByText("Dr. Ayesha Noor")).toBeNull();
    expect(screen.queryByText("Rs. 1,500")).toBeNull();

    await fireEvent.press(await screen.findByText(/^\d{1,2}:\d{2}/));
    // Doctor B's slot push must carry doctor B's own identifiers, never doctor A's.
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: "/checkout",
      params: { doctorId: "doc-b", slotId: "b-slot", startAt: "2026-05-02T05:00:00.000Z" },
    });
  });
});
