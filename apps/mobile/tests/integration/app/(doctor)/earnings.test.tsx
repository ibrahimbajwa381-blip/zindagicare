import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import DoctorEarningsScreen from "@app/(doctor)/earnings";
import { getDoctorEarnings, getDoctorBankAccount, updateDoctorBankAccount } from "@/api/doctor";
import { ApiRequestError } from "@/api/client";

jest.mock("@/api/doctor");

const mockGetEarnings = getDoctorEarnings as jest.Mock;
const mockGetBankAccount = getDoctorBankAccount as jest.Mock;
const mockUpdateBankAccount = updateDoctorBankAccount as jest.Mock;

const earnings = {
  totalGrossRevenue: 500000,
  grossRevenueThisMonth: 50000,
  totalEarnings: 400000,
  earningsThisMonth: 40000,
  totalPlatformCommission: 100000,
  platformCommissionThisMonth: 10000,
  referralBonusEarnings: 5000,
  referralBonusEarningsThisMonth: 500,
  completedPaidConsults: 120,
  completedConsults: { online: 100, clinic: 0, urgent: 10, homeVisit: 10, total: 120 },
  completedConsultsThisMonth: { online: 10, clinic: 0, urgent: 1, homeVisit: 1, total: 12 },
  onlineCommissionPercent: 20,
  homeVisitCommissionPercent: 15,
  availableBalance: 15000,
  totalWithdrawn: 20000,
  pendingWithdrawal: 0,
  withdrawals: [
    { id: "w1", amount: 5000, currency: "PKR", status: "completed" as const, requestedAt: "2026-01-01T00:00:00.000Z" },
  ],
  transactions: [
    {
      id: "t1",
      type: "online",
      completedAt: "2026-01-10T00:00:00.000Z",
      amount: 1600,
      grossAmount: 2000,
      commissionAmount: 400,
      commissionPercent: 20,
      currency: "PKR",
      patient: { id: "p1", name: "Ayesha Khan" },
      isReferralBonus: false,
    },
  ],
};

describe("DoctorEarningsScreen", () => {
  beforeEach(() => {
    mockGetEarnings.mockResolvedValue(earnings);
    mockGetBankAccount.mockResolvedValue({ bankAccount: null });
  });

  it("renders the balance, stats, payout history, and transactions", async () => {
    await render(<DoctorEarningsScreen />);
    await waitFor(() => expect(screen.getByText("Rs. 15,000")).toBeTruthy());
    expect(screen.getByText("Rs. 40,000")).toBeTruthy();
    expect(screen.getByText("120")).toBeTruthy();
    expect(screen.getByText("Ayesha Khan")).toBeTruthy();
    expect(screen.getByText("+Rs. 1,600")).toBeTruthy();
    expect(screen.getByText("completed")).toBeTruthy();
  });

  it("shows an error message when loading fails", async () => {
    mockGetEarnings.mockRejectedValue(new ApiRequestError("Not authorized", "AUTH", 401));
    await render(<DoctorEarningsScreen />);
    expect(await screen.findByText("Not authorized")).toBeTruthy();
  });

  it("shows 'No transactions yet' when there are none", async () => {
    mockGetEarnings.mockResolvedValue({ ...earnings, transactions: [] });
    await render(<DoctorEarningsScreen />);
    expect(await screen.findByText("No transactions yet.")).toBeTruthy();
  });

  it("shows existing bank details and lets the doctor edit them", async () => {
    mockGetBankAccount.mockResolvedValue({
      bankAccount: { accountTitle: "Bilal Chaudhry", bankName: "HBL", accountNumber: "12345" },
    });
    await render(<DoctorEarningsScreen />);
    await waitFor(() => expect(screen.getByText("Bilal Chaudhry")).toBeTruthy());
    expect(screen.getByText("HBL")).toBeTruthy();
    expect(screen.getByText("12345")).toBeTruthy();
  });

  it("adds a new bank account when none exists", async () => {
    mockUpdateBankAccount.mockResolvedValue({
      bankAccount: { accountTitle: "Bilal Chaudhry", bankName: "HBL", accountNumber: "12345" },
    });
    await render(<DoctorEarningsScreen />);
    await waitFor(() => expect(screen.getByText("Add bank account")).toBeTruthy());
    await fireEvent.press(screen.getByText("Add bank account"));

    await fireEvent.changeText(screen.getByPlaceholderText("Account title"), "Bilal Chaudhry");
    await fireEvent.changeText(screen.getByPlaceholderText("Bank name"), "HBL");
    await fireEvent.changeText(screen.getByPlaceholderText("Account number"), "12345");
    await fireEvent.press(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockUpdateBankAccount).toHaveBeenCalledWith(
        expect.objectContaining({ accountTitle: "Bilal Chaudhry", bankName: "HBL", accountNumber: "12345" }),
      );
    });
    expect(await screen.findByText("Edit bank details")).toBeTruthy();
  });

  it("lets the bank form be filled entirely by accessible field name, not placeholder text", async () => {
    mockUpdateBankAccount.mockResolvedValue({
      bankAccount: { accountTitle: "Bilal Chaudhry", bankName: "HBL", accountNumber: "12345", iban: "PK00HBL0000" },
    });
    await render(<DoctorEarningsScreen />);
    await waitFor(() => expect(screen.getByText("Add bank account")).toBeTruthy());
    await fireEvent.press(screen.getByText("Add bank account"));

    await fireEvent.changeText(screen.getByLabelText("Account title"), "Bilal Chaudhry");
    await fireEvent.changeText(screen.getByLabelText("Bank name"), "HBL");
    await fireEvent.changeText(screen.getByLabelText("Account number"), "12345");
    await fireEvent.changeText(screen.getByLabelText("IBAN (optional)"), "PK00HBL0000");
    await fireEvent.press(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockUpdateBankAccount).toHaveBeenCalledWith(
        expect.objectContaining({ accountTitle: "Bilal Chaudhry", bankName: "HBL", accountNumber: "12345", iban: "PK00HBL0000" }),
      );
    });
  });

  it("requires account title, bank name, and account number/IBAN before saving", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorEarningsScreen />);
    await waitFor(() => expect(screen.getByText("Add bank account")).toBeTruthy());
    await fireEvent.press(screen.getByText("Add bank account"));
    await fireEvent.press(screen.getByText("Save"));

    expect(alertSpy).toHaveBeenCalledWith(
      "Missing details",
      "Account title, bank name, and account number or IBAN are required.",
    );
    expect(mockUpdateBankAccount).not.toHaveBeenCalled();
  });

  it("shows an alert when saving the bank account fails", async () => {
    mockUpdateBankAccount.mockRejectedValue(new ApiRequestError("Invalid IBAN", "BAD_IBAN", 400));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<DoctorEarningsScreen />);
    await waitFor(() => expect(screen.getByText("Add bank account")).toBeTruthy());
    await fireEvent.press(screen.getByText("Add bank account"));
    await fireEvent.changeText(screen.getByPlaceholderText("Account title"), "Bilal");
    await fireEvent.changeText(screen.getByPlaceholderText("Bank name"), "HBL");
    await fireEvent.changeText(screen.getByPlaceholderText("Account number"), "12345");
    await fireEvent.press(screen.getByText("Save"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Couldn't save", "Invalid IBAN");
    });
  });

  it("cancels editing without saving", async () => {
    mockGetBankAccount.mockResolvedValue({
      bankAccount: { accountTitle: "Bilal Chaudhry", bankName: "HBL", accountNumber: "12345" },
    });
    await render(<DoctorEarningsScreen />);
    await waitFor(() => expect(screen.getByText("Edit bank details")).toBeTruthy());
    await fireEvent.press(screen.getByText("Edit bank details"));
    await fireEvent.changeText(screen.getByPlaceholderText("Bank name"), "Meezan");
    await fireEvent.press(screen.getByText("Cancel"));

    expect(screen.queryByText("Meezan")).toBeNull();
    expect(screen.getByText("HBL")).toBeTruthy();
    expect(mockUpdateBankAccount).not.toHaveBeenCalled();
  });
});
