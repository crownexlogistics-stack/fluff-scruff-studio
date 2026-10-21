import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { STAFF_DISCOUNT_OPTIONS, applyStaffDiscount } from "@/lib/staffDiscount";

export function StaffDiscountPicker({ subtotal, value, onChange }: { subtotal: number; value: number; onChange: (pct: number) => void }) {
  const { discount, total } = applyStaffDiscount(subtotal, value);
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Label>Would you like to give the customer a discount?</Label>
      <div className="flex flex-wrap gap-2">
        {STAFF_DISCOUNT_OPTIONS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              value === p ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted",
            )}
          >
            {p === 0 ? "No discount" : `${p}% off`}
          </button>
        ))}
      </div>
      {value > 0 && subtotal > 0 && (
        <div className="text-sm space-y-0.5">
          <div className="flex justify-between text-muted-foreground"><span>Price</span><span>£{subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-primary"><span>{value}% discount</span><span>−£{discount.toFixed(2)}</span></div>
          <div className="flex justify-between font-semibold"><span>Customer pays</span><span>£{total.toFixed(2)}</span></div>
        </div>
      )}
    </div>
  );
}
