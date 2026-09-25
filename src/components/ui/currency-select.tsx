import { forwardRef, type SelectHTMLAttributes } from "react";
import { Select } from "./input";
import { SUPPORTED_CURRENCIES } from "@/lib/validation/fields";

/** Only the currencies the gateway settles, so a typo cannot reach it. */
export const CurrencySelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>((props, ref) => (
  <Select ref={ref} {...props}>
    {SUPPORTED_CURRENCIES.map((c) => (
      <option key={c} value={c}>
        {c}
      </option>
    ))}
  </Select>
));
CurrencySelect.displayName = "CurrencySelect";
