import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { Alert, Share } from "react-native";
import DoctorReferralsScreen from "@app/(doctor)/referrals";
import { getDoctorReferral, regenerateDoctorReferralCode } from "@/api/doctor";
import { ApiRequestError } from "@/api/client";

jest.mock("@/api/doctor");

const mockGetReferral = getDoctorReferral as jest.Mock;
const mockRegenerate = regenerateDoctorReferralCode as jest.Mock;

const referralData = {
  referral: { code: "DRBILAL10", url: "https://zindagicare.com/r/DRBILAL10" },
  summary: {
    referredPatientCount: 5,
    lifetimeBonusEarnings: 2500,
    referredPatients: [{ id: "p1", name: "Ayesha Khan", joinedAt: "2026-01-01T00:00:00.000Z" }],
  },
};

describe("DoctorReferralsScreen", () => {
  beforeEach(() => {
    mockGetReferral.mockResolvedValue(referralData);
  });

  it("renders the referral code, link, and stats", async () => {
    await render(<DoctorReferralsScreen />);
    await waitFor(() => expect(screen.getByText("DRBILAL10")).toBeTruthy());
    expect(screen.getByText("https://zindagicare.com/r/DRBILAL10")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("Rs. 2,500")).toBeTruthy();
    expect(screen.getByText("Ayesha Khan")).toBeTruthy();
  });

  it("shows an error message when loading fails", async () => {
    mockGetReferral.mockRejectedValue(new ApiRequestError("Not authorized", "AUTH", 401));
    await render(<DoctorReferralsScreen />);
    expect(await screen.findByText("Not authorized")).toBeTruthy();
  });

  it("shows the empty state when there are no referred patients", async () => {
    mockGetReferral.mockResolvedValue({ ...referralData, summary: { ...referralData.summary, referredPatients: [] } });
    await render(<DoctorReferralsScreen />);
    expect(
      await screen.findByText("No patients referred yet. Share your link to start earning bonus commission."),
    ).toBeTruthy();
  });

  it("shares the referral link", async () => {
    const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
    await render(<DoctorReferralsScreen />);
    await waitFor(() => expect(screen.getByText("Share link")).toBeTruthy());
    await fireEvent.press(screen.getByText("Share link"));
    expect(shareSpy).toHaveBeenCalledWith({ message: "https://zindagicare.com/r/DRBILAL10" });
  });

  it("regenerates the referral code after confirming", async () => {
    mockRegenerate.mockResolvedValue({ referral: { code: "DRBILAL99", url: "https://zindagicare.com/r/DRBILAL99" } });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorReferralsScreen />);
    await waitFor(() => expect(screen.getByText("Regenerate")).toBeTruthy());

    await fireEvent.press(screen.getByText("Regenerate"));
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === "Regenerate")?.onPress?.());

    await waitFor(() => expect(screen.getByText("DRBILAL99")).toBeTruthy());
  });

  it("alerts when regeneration fails", async () => {
    mockRegenerate.mockRejectedValue(new ApiRequestError("Server error", "ERR", 500));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorReferralsScreen />);
    await waitFor(() => expect(screen.getByText("Regenerate")).toBeTruthy());

    await fireEvent.press(screen.getByText("Regenerate"));
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === "Regenerate")?.onPress?.());

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Couldn't regenerate", "Server error");
    });
  });
});
