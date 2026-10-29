import {
  CLINICAL_ROLES,
  resolveAccountRoles,
  roleSetViolation,
  Roles,
  withClinicalRole,
  type Role,
} from "@zindagi/shared";

describe("roleSetViolation", () => {
  test.each<[Role[]]>([
    [[Roles.PATIENT]],
    ...CLINICAL_ROLES.map((role): [Role[]] => [[role]]),
    [[Roles.PATIENT, Roles.LAB]],
    [[Roles.PATIENT, Roles.OTHER]],
    [[Roles.PATIENT, Roles.ADMIN]],
    [[Roles.DOCTOR, Roles.ADMIN]],
    [[Roles.ADMIN]],
    [[Roles.SUPER_ADMIN, Roles.ADMIN]],
    [[Roles.RIDER]],
  ])("allows %j", (roles) => {
    expect(roleSetViolation(roles)).toBeNull();
  });

  test("rejects an empty role set", () => {
    expect(roleSetViolation([])).toMatch(/at least one role/);
  });

  test.each(CLINICAL_ROLES)("rejects patient + %s", (role) => {
    expect(roleSetViolation([Roles.PATIENT, role])).toMatch(/cannot also be a patient/);
    expect(roleSetViolation([role, Roles.PATIENT, Roles.ADMIN])).not.toBeNull();
  });

  test("rejects two clinical roles", () => {
    expect(roleSetViolation([Roles.DOCTOR, Roles.PHYSIOTHERAPIST])).toMatch(
      /only one clinical role/,
    );
  });
});

describe("withClinicalRole", () => {
  test("swaps the clinical role and drops patient, keeping admin", () => {
    const roles = withClinicalRole(
      [Roles.DOCTOR, Roles.PATIENT, Roles.ADMIN],
      Roles.PHYSIOTHERAPIST,
    );
    expect(roles).toEqual([Roles.ADMIN, Roles.PHYSIOTHERAPIST]);
    expect(roleSetViolation(roles)).toBeNull();
  });
});

describe("resolveAccountRoles", () => {
  test("leaves a valid account unchanged", () => {
    expect(resolveAccountRoles([Roles.DOCTOR], [])).toEqual({
      kind: "ok",
      roles: [Roles.DOCTOR],
    });
  });

  test("keeps the clinical role backed by a live profile", () => {
    expect(resolveAccountRoles([Roles.PATIENT, Roles.DOCTOR], [Roles.DOCTOR])).toEqual({
      kind: "ok",
      roles: [Roles.DOCTOR],
    });
  });

  test("becomes a patient when no clinical role has a live profile", () => {
    expect(
      resolveAccountRoles([Roles.DOCTOR, Roles.PATIENT, Roles.ADMIN], []),
    ).toEqual({ kind: "ok", roles: [Roles.PATIENT, Roles.ADMIN] });
  });

  test("ignores profiles for roles the account does not hold", () => {
    expect(resolveAccountRoles([Roles.DOCTOR, Roles.PATIENT], [Roles.NURSE])).toEqual({
      kind: "ok",
      roles: [Roles.PATIENT],
    });
  });

  test("picks the backed role when two clinical roles are held", () => {
    expect(
      resolveAccountRoles([Roles.DOCTOR, Roles.PHYSIOTHERAPIST], [Roles.PHYSIOTHERAPIST]),
    ).toEqual({ kind: "ok", roles: [Roles.PHYSIOTHERAPIST] });
  });

  test("reports a conflict when several clinical roles have live profiles", () => {
    const result = resolveAccountRoles(
      [Roles.DOCTOR, Roles.PHYSIOTHERAPIST, Roles.PATIENT],
      [Roles.DOCTOR, Roles.PHYSIOTHERAPIST],
    );
    expect(result.kind).toBe("conflict");
  });

  test("gives an account with no roles the patient role", () => {
    expect(resolveAccountRoles([], [])).toEqual({ kind: "ok", roles: [Roles.PATIENT] });
  });

  test("every ok result satisfies the invariant", () => {
    const samples: Role[][] = [
      [Roles.DOCTOR, Roles.PATIENT],
      [Roles.NURSE, Roles.PATIENT, Roles.LAB],
      [Roles.HERBALIST, Roles.NUTRITIONIST],
      [],
    ];
    for (const roles of samples) {
      for (const backed of [[], ...CLINICAL_ROLES.map((r) => [r])]) {
        const result = resolveAccountRoles(roles, backed);
        if (result.kind === "ok") expect(roleSetViolation(result.roles)).toBeNull();
      }
    }
  });
});
