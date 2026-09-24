"use client";

import { forwardRef, type SelectHTMLAttributes } from "react";
import { Select } from "@/components/ui/input";
import { useBanks, useTelcos } from "@/lib/api/hooks";

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  include: "telcos" | "banks" | "both";
}

/** Institution picker backed by get-all-telcos / get-all-banks (cached for an hour). */
export const InstitutionSelect = forwardRef<HTMLSelectElement, Props>(({ include, ...props }, ref) => {
  const telcos = useTelcos();
  const banks = useBanks();
  const wantTelcos = include !== "banks";
  const wantBanks = include !== "telcos";
  const loading = (wantTelcos && telcos.isLoading) || (wantBanks && banks.isLoading);

  return (
    <Select ref={ref} disabled={loading || props.disabled} {...props}>
      <option value="">{loading ? "Loading..." : "Choose one"}</option>
      {wantTelcos && (telcos.data?.length ?? 0) > 0 && (
        <optgroup label="Mobile money">
          {telcos.data?.map((i) => (
            <option key={`t-${i.code}`} value={i.code ?? ""}>
              {i.name ?? i.code}
            </option>
          ))}
        </optgroup>
      )}
      {wantBanks && (banks.data?.length ?? 0) > 0 && (
        <optgroup label="Banks">
          {banks.data?.map((i) => (
            <option key={`b-${i.code}`} value={i.code ?? ""}>
              {i.name ?? i.code}
            </option>
          ))}
        </optgroup>
      )}
    </Select>
  );
});
InstitutionSelect.displayName = "InstitutionSelect";
