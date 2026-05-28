import { Separator } from "@/components/ui/separator";
import type { Highlights } from "./useTimelineAnalytics";

interface Props {
  highlights: Highlights;
}

export default function TimelineHighlightsSidebar({ highlights }: Props) {
  const { bestWeekEver, bestWeekRecent, mostLoyalCustomer, topGroomer, busiestDay, vsLastWeek } = highlights;
  const hasAny = bestWeekEver || mostLoyalCustomer || topGroomer || busiestDay;

  return (
    <div className="rounded-[20px] p-5 space-y-4 h-fit" style={{ backgroundColor: "#2D1B0E" }}>
      <h3 className="font-heading text-lg font-bold text-white">⭐ Highlights</h3>

      {!hasAny && (
        <p className="text-sm text-white/50">No data to show highlights</p>
      )}

      {bestWeekEver && (
        <>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">🏆 Best Week Ever</p>
            <p className="text-sm font-bold" style={{ color: "#FFB800" }}>
              Wk of {bestWeekEver.label}
            </p>
            <p className="text-lg font-bold" style={{ color: "#FFB800" }}>
              £{bestWeekEver.revenue.toLocaleString()}
            </p>
          </div>
          <Separator className="bg-white/10" />
        </>
      )}

      {bestWeekRecent && (
        <>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">🏆 Best Week (last 12)</p>
            <p className="text-sm font-bold" style={{ color: "#FFB800" }}>
              Wk of {bestWeekRecent.label}
            </p>
            <p className="text-lg font-bold" style={{ color: "#FFB800" }}>
              £{bestWeekRecent.revenue.toLocaleString()}
            </p>
          </div>
          <Separator className="bg-white/10" />
        </>
      )}

      {mostLoyalCustomer && (
        <>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">❤️ Most Loyal</p>
            <p className="text-sm font-bold text-white">{mostLoyalCustomer.name}</p>
            <p className="text-xs text-white/70">
              {mostLoyalCustomer.bookings} bookings · £{mostLoyalCustomer.spend.toLocaleString()}
            </p>
          </div>
          <Separator className="bg-white/10" />
        </>
      )}

      {topGroomer && (
        <>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">✂️ Top Groomer</p>
            <p className="text-sm font-bold text-white">{topGroomer.name}</p>
            <p className="text-lg font-bold" style={{ color: "#FFB800" }}>
              £{topGroomer.revenue.toLocaleString()}
            </p>
          </div>
          <Separator className="bg-white/10" />
        </>
      )}

      {busiestDay && (
        <>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">📅 Busiest Day</p>
            <p className="text-sm font-bold" style={{ color: "#FFB800" }}>{busiestDay}</p>
          </div>
          <Separator className="bg-white/10" />
        </>
      )}

      {vsLastWeek && (
        <div>
          <p className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">📊 vs Last Week</p>
          <p className="text-sm font-bold" style={{ color: vsLastWeek.revenueChange >= 0 ? "#4ade80" : "#f87171" }}>
            Revenue {vsLastWeek.revenueChange >= 0 ? "↑" : "↓"} {Math.abs(vsLastWeek.revenueChange)}%
          </p>
          <p className="text-sm font-bold" style={{ color: vsLastWeek.bookingsChange >= 0 ? "#4ade80" : "#f87171" }}>
            Bookings {vsLastWeek.bookingsChange >= 0 ? "↑" : "↓"} {Math.abs(vsLastWeek.bookingsChange)}%
          </p>
        </div>
      )}
    </div>
  );
}
