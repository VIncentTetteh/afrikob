import { forwardRef, type InputHTMLAttributes } from "react";
import { Input } from "./input";

/**
 * Amount entry as text: `type="number"` accepts "1e3", silently drops what it
 * cannot parse, and changes value on a scroll wheel. The schema does the parsing.
 */
export const MoneyInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>((props, ref) => (
  <Input
    ref={ref}
    type="text"
    inputMode="decimal"
    autoComplete="off"
    spellCheck={false}
    maxLength={16}
    placeholder="0.00"
    className="figure"
    {...props}
  />
));
MoneyInput.displayName = "MoneyInput";
