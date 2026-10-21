import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { STAFF_DISCOUNT_OPTIONS, applyStaffDiscount } from "@/lib/staffDiscount";

export function StaffDiscountPicker({ subtotal, value, onChange, deposit = 0 }: { subtotal: number; value: number; onChange: (pct: number) => void; deposit?: number }) {
  const { discount, total } = applyStaffDiscount(subtotal, value);
  const paid = Math.max(0, Math.min(Number(deposit) || 0, total));
  const balance = Math.max(0, total - paid);
  const showBreakdown = subtotal > 0 && (value > 0 || paid > 0);
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
      {showBreakdown && (
        <div className="text-sm space-y-0.5 pt-1">
          <div className="flex justify-between text-muted-foreground"><span>Total price</span><span>£{subtotal.toFixed(2)}</span></div>
          {value > 0 && (
            <>
              <div className="flex justify-between text-primary"><span>{value}% discount</span><span>−£{discount.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Discounted total</span><span>£{total.toFixed(2)}</span></div>
            </>
          )}
          {paid > 0 && (
            <div className="flex justify-between text-muted-foreground"><span>Deposit paid</span><span>−£{paid.toFixed(2)}</span></div>
          )}
          <div className="flex justify-between font-semibold border-t pt-1 mt-1"><span>Balance to collect on the day</span><span>£{balance.toFixed(2)}</span></div>
        </div>
      )}
    </div>
  );
}
