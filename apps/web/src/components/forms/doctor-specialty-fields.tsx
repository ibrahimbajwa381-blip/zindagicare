"use client";

import {
  MAX_ADDITIONAL_SPECIALTIES,
  normalizeAdditionalSpecialties,
} from "@zindagi/shared";
import { Label } from "@/components/ui/input";
import { SpecialtyMultiSelect } from "@/components/forms/specialty-multi-select";
import { SpecialtySelect } from "@/components/forms/specialty-select";

type DoctorSpecialtyFieldsProps = {
  primarySpecialty: string;
  additionalSpecialties: string[];
  onPrimaryChange: (value: string) => void;
  onAdditionalChange: (values: string[]) => void;
  verifiedSpecialties?: string[];
  showVerificationHint?: boolean;
  primaryId?: string;
  additionalId?: string;
  allowCustomPrimary?: boolean;
};

export function DoctorSpecialtyFields({
  primarySpecialty,
  additionalSpecialties,
  onPrimaryChange,
  onAdditionalChange,
  verifiedSpecialties,
  showVerificationHint = false,
  primaryId = "primarySpecialty",
  additionalId = "additionalSpecialties",
  allowCustomPrimary = false,
}: DoctorSpecialtyFieldsProps) {
  const additional = normalizeAdditionalSpecialties(
    primarySpecialty,
    additionalSpecialties,
  );

  function handlePrimaryChange(next: string) {
    onPrimaryChange(next);
    onAdditionalChange(normalizeAdditionalSpecialties(next, additional));
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor={primaryId}>Primary specialty</Label>
        <SpecialtySelect
          id={primaryId}
          value={primarySpecialty}
          onChange={handlePrimaryChange}
          exclude={additional}
          allowCustomValue={allowCustomPrimary}
          required
          placeholder="Select your primary specialty"
        />
        <p className="mt-1 text-xs text-slate-500">
          Required. This is your main category for patients once verified.
        </p>
      </div>

      <div>
        <Label htmlFor={additionalId}>Additional specialties</Label>
        <SpecialtyMultiSelect
          id={additionalId}
          values={additional}
          onChange={onAdditionalChange}
          exclude={primarySpecialty ? [primarySpecialty] : []}
          max={MAX_ADDITIONAL_SPECIALTIES}
          placeholder="Add optional specialties"
        />
        <p className="mt-1 text-xs text-slate-500">
          Optional. Up to {MAX_ADDITIONAL_SPECIALTIES} more. Only admin-verified
          specialties appear in patient search and booking.
        </p>
      </div>

      {showVerificationHint && verifiedSpecialties && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <p className="font-medium text-slate-800">Currently live for patients</p>
          <p className="mt-0.5">
            {verifiedSpecialties.length
              ? verifiedSpecialties.join(", ")
              : "None verified yet — awaiting admin approval."}
          </p>
        </div>
      )}
    </div>
  );
}
