import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * NumericInput — a free-format text input that only accepts numbers (digits and one decimal point).
 * No browser spinner arrows. Use this for ALL numeric fields across the app.
 *
 * Props:
 *  - value: number | string
 *  - onValueChange: (value: number) => void  — fires with the parsed number (0 if empty)
 *  - allowDecimals?: boolean (default true)
 *  - placeholder?: string
 *  - className?: string
 *  - ...rest of InputHTMLAttributes (except type, onChange, inputMode)
 */

export interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "inputMode"> {
  value: number | string;
  onValueChange: (value: number) => void;
  allowDecimals?: boolean;
}

const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ className, value, onValueChange, allowDecimals = true, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;

      // Allow empty string while typing
      if (raw === "") {
        onValueChange(0);
        return;
      }

      // Only allow digits and optionally one decimal point
      const pattern = allowDecimals ? /^[0-9]*\.?[0-9]*$/ : /^[0-9]*$/;
      if (!pattern.test(raw)) return;

      onValueChange(parseFloat(raw) || 0);
    };

    // Display: show the raw value so user can type freely, but show "0" → "" isn't forced
    const displayValue = value === 0 || value === "0" ? "0" : String(value);

    return (
      <input
        ref={ref}
        type="text"
        inputMode={allowDecimals ? "decimal" : "numeric"}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        value={displayValue}
        onChange={handleChange}
        {...props}
      />
    );
  },
);
NumericInput.displayName = "NumericInput";

export { NumericInput };
