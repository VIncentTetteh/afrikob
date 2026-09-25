"use client";

import { AsYouType, getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { DEFAULT_COUNTRY } from "@/lib/validation/fields";

const fieldBase =
  "h-10 rounded-lg border border-line bg-field text-sm text-ink transition focus:border-accent focus:bg-paper focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-55 aria-[invalid=true]:border-failed";

/** Ghana first, since nearly everyone here is; then every other country by name. */
function countryOptions(only?: readonly CountryCode[]): { code: CountryCode; label: string }[] {
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const codes = only ?? getCountries();
  return codes
    .map((code) => ({ code, label: `${names.of(code) ?? code} (+${getCountryCallingCode(code)})` }))
    .sort((a, b) => (a.code === DEFAULT_COUNTRY ? -1 : b.code === DEFAULT_COUNTRY ? 1 : a.label.localeCompare(b.label)));
}

function split(value: string, fallback: CountryCode): { country: CountryCode; national: string } {
  const parsed = value ? parsePhoneNumberFromString(value, fallback) : undefined;
  if (parsed?.country) return { country: parsed.country, national: parsed.formatNational() };
  return { country: fallback, national: value.replace(/^\+\d*/, "") };
}

/** The value handed to the form: E.164 when it parses, otherwise what was typed, so the validator can say why. */
function join(country: CountryCode, national: string): string {
  const digits = national.replace(/[^\d+]/g, "");
  if (!digits) return "";
  if (digits.startsWith("+")) return digits;
  const parsed = parsePhoneNumberFromString(digits, country);
  return parsed?.number ?? `+${getCountryCallingCode(country)}${digits.replace(/^0+/, "")}`;
}

interface PhoneInputProps {
  id: string;
  value: string | undefined;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** Limit the countries on offer, e.g. ["GH"] for a mobile money wallet. */
  countries?: readonly CountryCode[];
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Country picker plus national number, reporting E.164 (+233241234567). The
 * number is formatted as it is typed, so a mistyped digit count is visible.
 */
export function PhoneInput({ id, value, onChange, onBlur, countries, invalid, disabled, placeholder }: PhoneInputProps) {
  const options = useMemo(() => countryOptions(countries), [countries]);
  const fallback = options[0]?.code ?? DEFAULT_COUNTRY;
  const [country, setCountry] = useState<CountryCode>(() => split(value ?? "", fallback).country);
  const [national, setNational] = useState(() => split(value ?? "", fallback).national);

  // A reset from the form (value cleared or replaced) wins over local typing.
  const external = value ?? "";
  if (external !== join(country, national) && !(external === "" && national === "")) {
    const next = split(external, fallback);
    if (next.country !== country) setCountry(next.country);
    if (next.national !== national) setNational(next.national);
  }

  const describedBy = invalid ? `${id}-error` : `${id}-hint`;
  const locked = options.length === 1;

  return (
    <div className="flex min-w-0 gap-2">
      <select
        aria-label="Country code"
        value={country}
        disabled={disabled || locked}
        onChange={(e) => {
          const next = e.target.value as CountryCode;
          setCountry(next);
          onChange(join(next, national));
        }}
        className={cn(fieldBase, "w-28 shrink-0 appearance-none px-2.5", locked && "opacity-100")}
      >
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.code === country ? `${o.code} +${getCountryCallingCode(o.code)}` : o.label}
          </option>
        ))}
      </select>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        maxLength={20}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        placeholder={placeholder ?? (country === "GH" ? "024 123 4567" : undefined)}
        value={national}
        onBlur={onBlur}
        onChange={(e) => {
          const typed = e.target.value.replace(/[^\d\s()+-]/g, "");
          const formatted = typed.replace(/\D/g, "").length > 0 ? new AsYouType(country).input(typed) : typed;
          setNational(formatted);
          onChange(join(country, formatted));
        }}
        className={cn(fieldBase, "min-w-0 flex-1 px-3 placeholder:text-ink-faint")}
      />
    </div>
  );
}
