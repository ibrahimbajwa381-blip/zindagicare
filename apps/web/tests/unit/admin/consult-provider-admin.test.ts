import { VerificationStatuses } from "@zindagi/shared";
import { createConsultProviderApi } from "@/features/admin/consult-providers/api";
import {
  CONSULT_PROVIDER_ADMIN_CONFIGS,
  ConsultProviderKinds,
} from "@/features/admin/consult-providers/config";
import { claimedSpecialties } from "@/features/admin/consult-providers/format";
import {
  changeVerificationStatus,
  statusRequiresReason,
} from "@/features/admin/consult-providers/verification";

type FetchCall = [string, RequestInit | undefined];

function mockFetch(data: unknown, ok = true) {
  const fn = jest.fn(async () => ({
    ok,
    json: async () => (ok ? { success: true, data } : { success: false, error: { message: "Nope" } }),
  }));
  global.fetch = fn as unknown as typeof fetch;
  return fn as unknown as jest.Mock<Promise<unknown>, FetchCall>;
}

describe("consult provider admin config", () => {
  it.each(Object.values(ConsultProviderKinds))("is self-consistent for %s", (kind) => {
    const config = CONSULT_PROVIDER_ADMIN_CONFIGS[kind];
    expect(config.kind).toBe(kind);
    expect(config.apiBase).toBe(`/api/v1/admin/${config.listResponseKey}`);
    expect(config.routes.review("abc")).toBe(`${config.routes.queue}/review/abc`);
    expect(config.routes.manageDetail("abc")).toBe(`${config.routes.manage}/abc`);
    expect(config.specialties.length).toBeGreaterThan(0);
  });
});

describe("createConsultProviderApi", () => {
  const api = createConsultProviderApi(
    CONSULT_PROVIDER_ADMIN_CONFIGS[ConsultProviderKinds.NUTRITIONIST],
  );

  it("unwraps the role-specific list key and forwards filters", async () => {
    const fetchMock = mockFetch({ nutritionists: [{ id: "1" }] });
    const rows = await api.list({ status: "pending", search: "ali khan" });
    expect(rows).toEqual([{ id: "1" }]);
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "/api/v1/admin/nutritionists?status=pending&search=ali+khan",
    );
  });

  it("sends the role-specific id field to the decide endpoint", async () => {
    const fetchMock = mockFetch({ id: "p1", status: "approved" });
    await api.decide("p1", "approve", { verifiedSpecialties: ["Sports nutrition"] });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/v1/admin/nutritionists/decide");
    expect(JSON.parse(String(init!.body))).toEqual({
      nutritionistProfileId: "p1",
      action: "approve",
      verifiedSpecialties: ["Sports nutrition"],
    });
  });

  it("normalises the finance subject key to `provider`", async () => {
    mockFetch({ nutritionist: { id: "p1", name: "Sara" }, balanceDue: 500 });
    const finance = await api.finance("p1");
    expect(finance.provider).toEqual({ id: "p1", name: "Sara" });
    expect(finance.balanceDue).toBe(500);
    expect(finance).not.toHaveProperty("nutritionist");
  });

  it("posts payouts as multipart form data", async () => {
    const fetchMock = mockFetch({ payout: {} });
    const receipt = new File(["x"], "r.pdf", { type: "application/pdf" });
    await api.recordPayout("p1", { amount: 1200, method: "cash", receipt });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/v1/admin/nutritionists/p1/finance/payouts");
    const body = init!.body as FormData;
    expect(body.get("amount")).toBe("1200");
    expect(body.get("method")).toBe("cash");
    expect(body.get("receipt")).toBeInstanceOf(File);
  });

  it("surfaces the API error message", async () => {
    mockFetch(null, false);
    await expect(api.detail("p1")).rejects.toThrow("Nope");
  });
});

describe("changeVerificationStatus", () => {
  function fakeApi() {
    return {
      decide: jest.fn(async () => ({ id: "p1", status: "x" })),
      update: jest.fn(async () => ({})),
    } as unknown as ReturnType<typeof createConsultProviderApi> & {
      decide: jest.Mock;
      update: jest.Mock;
    };
  }

  it("approves through the decision endpoint, keeping verified specialties", async () => {
    const api = fakeApi();
    await changeVerificationStatus(
      api,
      { id: "p1", specialties: ["Unani"] },
      VerificationStatuses.APPROVED,
    );
    expect(api.decide).toHaveBeenCalledWith("p1", "approve", { verifiedSpecialties: ["Unani"] });
    expect(api.update).not.toHaveBeenCalled();
  });

  it("rejects through the decision endpoint with the reason", async () => {
    const api = fakeApi();
    await changeVerificationStatus(
      api,
      { id: "p1", specialties: [] },
      VerificationStatuses.REJECTED,
      "Invalid license",
    );
    expect(api.decide).toHaveBeenCalledWith("p1", "reject", { rejectionReason: "Invalid license" });
  });

  it("restricts through an account update", async () => {
    const api = fakeApi();
    await changeVerificationStatus(api, { id: "p1", specialties: [] }, "restricted", "Complaints");
    expect(api.update).toHaveBeenCalledWith("p1", {
      verificationStatus: "restricted",
      rejectionReason: "Complaints",
    });
  });

  it("requires a reason only for reject / restrict", () => {
    expect(statusRequiresReason(VerificationStatuses.APPROVED)).toBe(false);
    expect(statusRequiresReason(VerificationStatuses.REJECTED)).toBe(true);
    expect(statusRequiresReason("restricted")).toBe(true);
  });
});

describe("claimedSpecialties", () => {
  it("puts the primary first and drops blanks and duplicates", () => {
    expect(
      claimedSpecialties({ primarySpecialty: "A", additionalSpecialties: ["B", "A", " ", "C"] }),
    ).toEqual(["A", "B", "C"]);
  });
});
