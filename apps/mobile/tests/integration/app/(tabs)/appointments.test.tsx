import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert, Linking } from "react-native";
import AppointmentsScreen from "@app/(tabs)/appointments";
import {
  getAppointmentHistory,
  joinVideoSession,
  submitAppointmentReview,
} from "@/api/appointments";
import { ApiRequestError } from "@/api/client";
import { downloadAndOpenFile } from "@/lib/download-file";
import { router } from "expo-router";

jest.mock("@/api/appointments");
jest.mock("@/lib/download-file");

const mockGetHistory = getAppointmentHistory as jest.Mock;
const mockJoin = joinVideoSession as jest.Mock;
const mockSubmitReview = submitAppointmentReview as jest.Mock;
const mockDownload = downloadAndOpenFile as jest.Mock;

const baseAppointment = {
  appointmentId: "appt-1",
  type: "online" as const,
  typeLabel: "Online consult",
  scheduledStart: "2026-01-01T10:00:00.000Z",
  scheduledEnd: "2026-01-01T10:30:00.000Z",
  status: "confirmed",
  doctor: { doctorId: "doc-1", name: "Dr. Bilal Chaudhry", avatarUrl: undefined, specialty: "Dermatology" },
  isMissed: false,
  canJoin: true,
  canReview: false,
  canRequestCancellation: false,
  cancellationRequestStatus: "none",
};

describe("AppointmentsScreen", () => {
  beforeEach(() => {
    mockGetHistory.mockResolvedValue([baseAppointment]);
  });

  it("renders an appointment card with status, type, and time", async () => {
    await render(<AppointmentsScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Chaudhry")).toBeTruthy());
    expect(screen.getByText("Dermatology")).toBeTruthy();
    expect(screen.getByText("Online consult")).toBeTruthy();
    expect(screen.getByText("Confirmed")).toBeTruthy();
  });

  it("shows the empty state when there are no appointments", async () => {
    mockGetHistory.mockResolvedValue([]);
    await render(<AppointmentsScreen />);
    expect(await screen.findByText("No appointments yet.")).toBeTruthy();
  });

  it("shows an API error message when loading fails", async () => {
    mockGetHistory.mockRejectedValue(new ApiRequestError("Session expired", "AUTH", 401));
    await render(<AppointmentsScreen />);
    expect(await screen.findByText("Session expired")).toBeTruthy();
  });

  it("shows a generic error message for a non-API failure", async () => {
    mockGetHistory.mockRejectedValue(new Error("boom"));
    await render(<AppointmentsScreen />);
    expect(await screen.findByText("Failed to load appointments")).toBeTruthy();
  });

  it("joins the video call and opens the URL when canJoin is true", async () => {
    mockJoin.mockResolvedValue({ joinUrl: "https://call.example.com/x" });
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(true as never);
    await render(<AppointmentsScreen />);
    await waitFor(() => expect(screen.getByText("Join call")).toBeTruthy());

    await fireEvent.press(screen.getByText("Join call"));

    await waitFor(() => {
      expect(mockJoin).toHaveBeenCalledWith("appt-1");
      expect(openURLSpy).toHaveBeenCalledWith("https://call.example.com/x");
    });
  });

  it("alerts with the server message when joining fails", async () => {
    mockJoin.mockRejectedValue(new ApiRequestError("Consult already ended", "ENDED", 400));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<AppointmentsScreen />);
    await waitFor(() => expect(screen.getByText("Join call")).toBeTruthy());
    await fireEvent.press(screen.getByText("Join call"));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Couldn't join", "Consult already ended"));
  });

  it("shows a view-prescription button instead of join when not joinable but a prescription exists", async () => {
    mockGetHistory.mockResolvedValue([
      { ...baseAppointment, canJoin: false, status: "completed", prescription: { downloadUrl: "/rx.pdf" } },
    ]);
    await render(<AppointmentsScreen />);
    await waitFor(() => expect(screen.getByText("View prescription")).toBeTruthy());
    expect(screen.queryByText("Join call")).toBeNull();

    await fireEvent.press(screen.getByText("View prescription"));
    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalledWith("/rx.pdf", "Dr.-Bilal-Chaudhry-prescription.pdf");
    });
  });

  it("alerts when viewing the prescription fails", async () => {
    mockGetHistory.mockResolvedValue([
      { ...baseAppointment, canJoin: false, prescription: { downloadUrl: "/rx.pdf" } },
    ]);
    mockDownload.mockRejectedValue(new Error("Disk full"));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<AppointmentsScreen />);
    await waitFor(() => expect(screen.getByText("View prescription")).toBeTruthy());
    await fireEvent.press(screen.getByText("View prescription"));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Couldn't open prescription", "Disk full"));
  });

  it("shows the request-refund button and navigates with the appointment id", async () => {
    mockGetHistory.mockResolvedValue([{ ...baseAppointment, canRequestCancellation: true }]);
    await render(<AppointmentsScreen />);
    await waitFor(() => expect(screen.getByText("Request refund")).toBeTruthy());
    await fireEvent.press(screen.getByText("Request refund"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/refund-request",
      params: { appointmentId: "appt-1" },
    });
  });

  it("shows the pending-refund hint when a cancellation request is pending", async () => {
    mockGetHistory.mockResolvedValue([{ ...baseAppointment, cancellationRequestStatus: "pending" }]);
    await render(<AppointmentsScreen />);
    expect(await screen.findByText("Refund requested — we'll send your money back once approved.")).toBeTruthy();
  });

  it("opens the review modal, submits a rating, and reloads the list", async () => {
    mockGetHistory.mockResolvedValue([{ ...baseAppointment, canJoin: false, canReview: true }]);
    mockSubmitReview.mockResolvedValue({ rating: 4, createdAt: "2026-01-01" });
    await render(<AppointmentsScreen />);
    await waitFor(() => expect(screen.getByText("Leave a review")).toBeTruthy());

    await fireEvent.press(screen.getByText("Leave a review"));
    expect(await screen.findByText('Rate Dr. Bilal Chaudhry')).toBeTruthy();

    await fireEvent.press(screen.getByText("Submit"));

    await waitFor(() => {
      expect(mockSubmitReview).toHaveBeenCalledWith("appt-1", { rating: 5, comment: undefined });
      expect(mockGetHistory).toHaveBeenCalledTimes(2);
    });
  });

  it("shows the already-submitted review with stars and comment instead of the submit form", async () => {
    mockGetHistory.mockResolvedValue([
      {
        ...baseAppointment,
        canJoin: false,
        canReview: false,
        review: { rating: 4, comment: "Great doctor", createdAt: "2026-01-01" },
      },
    ]);
    await render(<AppointmentsScreen />);
    await waitFor(() => expect(screen.getByText("4")).toBeTruthy());
    await fireEvent.press(screen.getByText("4"));
    expect(await screen.findByText('"Great doctor"')).toBeTruthy();
    expect(screen.queryByText("Submit")).toBeNull();
  });

  it("closes the review modal without submitting", async () => {
    mockGetHistory.mockResolvedValue([{ ...baseAppointment, canJoin: false, canReview: true }]);
    await render(<AppointmentsScreen />);
    await waitFor(() => expect(screen.getByText("Leave a review")).toBeTruthy());
    await fireEvent.press(screen.getByText("Leave a review"));
    expect(await screen.findByText("Submit")).toBeTruthy();
    await fireEvent.press(screen.getByText("Close"));
    await waitFor(() => expect(screen.queryByText("Submit")).toBeNull());
    expect(mockSubmitReview).not.toHaveBeenCalled();
  });

  it("does not leak the rating/comment from a closed review modal into the next appointment's review modal", async () => {
    mockGetHistory.mockResolvedValue([
      { ...baseAppointment, appointmentId: "appt-1", canJoin: false, canReview: true, doctor: { ...baseAppointment.doctor, name: "Dr. First" } },
      { ...baseAppointment, appointmentId: "appt-2", canJoin: false, canReview: true, doctor: { ...baseAppointment.doctor, name: "Dr. Second" } },
    ]);
    mockSubmitReview.mockResolvedValue({ rating: 5, createdAt: "2026-01-01" });
    await render(<AppointmentsScreen />);
    await waitFor(() => expect(screen.getAllByText("Leave a review")).toHaveLength(2));

    // Open the FIRST appointment's review, add a comment, then close without submitting.
    await fireEvent.press(screen.getAllByText("Leave a review")[0]);
    expect(await screen.findByText("Rate Dr. First")).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText("Add a comment (optional)"), "Bad experience");
    await fireEvent.press(screen.getByText("Close"));
    await waitFor(() => expect(screen.queryByText("Rate Dr. First")).toBeNull());

    // Now open the SECOND appointment's review — it must start fresh, not carry over the first modal's comment.
    await fireEvent.press(screen.getAllByText("Leave a review")[1]);
    expect(await screen.findByText("Rate Dr. Second")).toBeTruthy();
    expect(screen.queryByDisplayValue("Bad experience")).toBeNull();

    await fireEvent.press(screen.getByText("Submit"));
    await waitFor(() => {
      expect(mockSubmitReview).toHaveBeenCalledWith("appt-2", { rating: 5, comment: undefined });
    });
  });

  it("renders a large (1,000-row) appointment list through the real component tree without crashing", async () => {
    const statuses = ["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"];
    const largeList = Array.from({ length: 1000 }, (_, i) => ({
      ...baseAppointment,
      appointmentId: `appt-${i}`,
      status: statuses[i % statuses.length],
      doctor: {
        doctorId: `doc-${i}`,
        name: i === 500 ? "" : `Dr. Bulk Test ${i}`, // edge case: empty doctor name mid-list
        avatarUrl: undefined,
        specialty: i % 4 === 0 ? "Dermatology" : "General Medicine",
      },
      canJoin: i % 3 === 0,
      canReview: i % 5 === 0,
      canRequestCancellation: i % 6 === 0,
      cancellationRequestStatus: i % 6 === 0 ? "pending" : "none",
      review: i % 5 === 1 ? { rating: 1 + (i % 5), comment: `Review text ${i}`, createdAt: "2026-01-01" } : undefined,
    }));
    mockGetHistory.mockResolvedValue(largeList);

    await render(<AppointmentsScreen />);

    // The real per-row logic (status pill lookup, conditional action buttons) must run against
    // the full 1,000-row dataset without the screen crashing or hanging.
    expect(await screen.findByText("Dr. Bulk Test 0")).toBeTruthy();
    expect(mockGetHistory).toHaveBeenCalledTimes(1);
  });

  it("does not let a slow refresh response overwrite a faster, second refresh response", async () => {
    await render(<AppointmentsScreen />); // resolves immediately via beforeEach mock, reveals the list + RefreshControl
    await waitFor(() => expect(screen.getByTestId("appointments-list")).toBeTruthy());

    let resolveA: (v: unknown) => void;
    let resolveB: (v: unknown) => void;
    const requestA = new Promise((resolve) => {
      resolveA = resolve;
    });
    const requestB = new Promise((resolve) => {
      resolveB = resolve;
    });
    mockGetHistory.mockImplementationOnce(() => requestA).mockImplementationOnce(() => requestB);

    const doRefresh = () => screen.getByTestId("appointments-list").props.refreshControl.props.onRefresh();
    doRefresh(); // call A, pending
    doRefresh(); // call B (rapid second pull), pending

    await act(async () => {
      resolveB!([{ ...baseAppointment, appointmentId: "appt-new", doctor: { ...baseAppointment.doctor, name: "Dr. New" } }]); // B (newer) resolves first
    });
    expect(await screen.findByText("Dr. New")).toBeTruthy();

    await act(async () => {
      resolveA!([{ ...baseAppointment, appointmentId: "appt-old", doctor: { ...baseAppointment.doctor, name: "Dr. Old" } }]); // A (older) resolves late
    });

    expect(await screen.findByText("Dr. New")).toBeTruthy();
    expect(screen.queryByText("Dr. Old")).toBeNull();
  });

  it("does not let a stale, late-failing refresh clobber state after a second refresh already succeeded", async () => {
    await render(<AppointmentsScreen />);
    await waitFor(() => expect(screen.getByTestId("appointments-list")).toBeTruthy());

    let rejectA: (e: unknown) => void;
    let resolveB: (v: unknown) => void;
    const requestA = new Promise((_resolve, reject) => {
      rejectA = reject;
    });
    const requestB = new Promise((resolve) => {
      resolveB = resolve;
    });
    mockGetHistory.mockImplementationOnce(() => requestA).mockImplementationOnce(() => requestB);

    const doRefresh = () => screen.getByTestId("appointments-list").props.refreshControl.props.onRefresh();
    doRefresh(); // call A, pending
    doRefresh(); // call B, pending

    await act(async () => {
      resolveB!([{ ...baseAppointment, appointmentId: "appt-new2", doctor: { ...baseAppointment.doctor, name: "Dr. Still Good" } }]); // B succeeds first
    });
    expect(await screen.findByText("Dr. Still Good")).toBeTruthy();

    await act(async () => {
      rejectA!(new ApiRequestError("Session expired", "AUTH", 401)); // A fails late
    });

    // The stale error must not replace the already-loaded newer, successful data with an error screen.
    expect(screen.getByText("Dr. Still Good")).toBeTruthy();
    expect(screen.queryByText("Session expired")).toBeNull();
  });

  it("shows an error message (without losing existing data) when a refresh fails after a successful load", async () => {
    await render(<AppointmentsScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Chaudhry")).toBeTruthy());

    mockGetHistory.mockRejectedValueOnce(new ApiRequestError("Network error", "NETWORK", 0));
    await act(async () => {
      screen.getByTestId("appointments-list").props.refreshControl.props.onRefresh();
    });

    expect(await screen.findByText("Network error")).toBeTruthy();
    expect(screen.getByText("Dr. Bilal Chaudhry")).toBeTruthy();
  });

  it("clears a stale refresh error once a subsequent refresh succeeds", async () => {
    await render(<AppointmentsScreen />);
    await waitFor(() => expect(screen.getByText("Dr. Bilal Chaudhry")).toBeTruthy());

    mockGetHistory.mockRejectedValueOnce(new ApiRequestError("Network error", "NETWORK", 0));
    await act(async () => {
      screen.getByTestId("appointments-list").props.refreshControl.props.onRefresh();
    });
    expect(await screen.findByText("Network error")).toBeTruthy();

    mockGetHistory.mockResolvedValueOnce([baseAppointment]);
    await act(async () => {
      screen.getByTestId("appointments-list").props.refreshControl.props.onRefresh();
    });

    await waitFor(() => expect(screen.queryByText("Network error")).toBeNull());
    expect(screen.getByText("Dr. Bilal Chaudhry")).toBeTruthy();
  });

  it("does not get stuck in a permanent loading state when the API returns a malformed (null) success payload", async () => {
    mockGetHistory.mockResolvedValue(null);
    await render(<AppointmentsScreen />);
    expect(await screen.findByText("No appointments yet.")).toBeTruthy();
  });

  it("does not crash with a very long doctor name and a malformed avatar URL", async () => {
    const longName = `Dr. ${"A".repeat(996)}`; // 1000 characters total
    mockGetHistory.mockResolvedValue([
      { ...baseAppointment, doctor: { ...baseAppointment.doctor, name: longName, avatarUrl: "not a valid url at all" } },
    ]);
    await render(<AppointmentsScreen />);
    expect(await screen.findByText(longName)).toBeTruthy();
  });
});

describe("AppointmentsScreen accessibility", () => {
  it("exposes the star rating control as an accessible radio group with the current selection", async () => {
    mockGetHistory.mockResolvedValue([{ ...baseAppointment, canJoin: false, canReview: true }]);
    await render(<AppointmentsScreen />);
    await waitFor(() => expect(screen.getByText("Leave a review")).toBeTruthy());
    await fireEvent.press(screen.getByText("Leave a review"));
    await screen.findByText('Rate Dr. Bilal Chaudhry');

    const fiveStars = screen.getByRole("radio", { name: "5 stars" });
    expect(fiveStars.props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
    const oneStar = screen.getByRole("radio", { name: "1 star" });
    expect(oneStar.props.accessibilityState).toEqual(expect.objectContaining({ checked: false }));

    await fireEvent.press(oneStar);
    expect(screen.getByRole("radio", { name: "1 star" }).props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true }),
    );
  });

  it("announces a load error as an alert", async () => {
    mockGetHistory.mockRejectedValue(new ApiRequestError("Session expired", "AUTH", 401));
    await render(<AppointmentsScreen />);
    const error = await screen.findByText("Session expired");
    expect(error.props.accessibilityRole).toBe("alert");
  });
});
