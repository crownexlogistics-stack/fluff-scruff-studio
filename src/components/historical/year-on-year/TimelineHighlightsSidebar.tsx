import { Separator } from "@/components/ui/separator";
import type { Highlights } from "./useTimelineAnalytics";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

interface Props {
  highlights: Highlights;
}

export default function TimelineHighlightsSidebar({ highlights }: Props) {
  const { bestMonthEver, bestMonthThisYear, mostLoyalCustomer, topGroomer, busiestDay, vsLastYear } = highlights;
  const currentYear = new Date().getFullYear();
  const currentMonthName = MONTH_NAMES[new Date().getMonth()];
  const hasAny = bestMonthEver || mostLoyalCustomer || topGroomer || busiestDay;

  return (
    <div className="rounded-[20px] p-5 space-y-4 h-fit" style={{ backgroundColor: "#2D1B0E" }}>
      <h3 className="font-heading text-lg font-bold text-white">⭐ Highlights</h3>

      {!hasAny && (
        <p className="text-sm text-white/50">No data to show highlights</p>
      )}

      {bestMonthEver && (
        <>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">🏆 Best Month</p>
            <p className="text-sm font-bold" style={{ color: "#FFB800" }}>
              {bestMonthEver.month} {bestMonthEver.year}
            </p>
            <p className="text-lg font-bold" style={{ color: "#FFB800" }}>
              £{bestMonthEver.revenue.toLocaleString()}
            </p>
          </div>
          <Separator className="bg-white/10" />
        </>
      )}

      {bestMonthThisYear && (
        <>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">🏆 Best Month {currentYear}</p>
            <p className="text-sm font-bold" style={{ color: "#FFB800" }}>
              {bestMonthThisYear.month} {bestMonthThisYear.year}
            </p>
            <p className="text-lg font-bold" style={{ color: "#FFB800" }}>
              £{bestMonthThisYear.revenue.toLocaleString()}
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

      {vsLastYear && (
        <div>
          <p className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">📊 vs Last Year ({currentMonthName})</p>
          <p className="text-sm font-bold" style={{ color: vsLastYear.revenueChange >= 0 ? "#4ade80" : "#f87171" }}>
            Revenue {vsLastYear.revenueChange >= 0 ? "↑" : "↓"} {Math.abs(vsLastYear.revenueChange)}%
          </p>
          <p className="text-sm font-bold" style={{ color: vsLastYear.bookingsChange >= 0 ? "#4ade80" : "#f87171" }}>
            Bookings {vsLastYear.bookingsChange >= 0 ? "↑" : "↓"} {Math.abs(vsLastYear.bookingsChange)}%
          </p>
        </div>
      )}
    </div>
  );
}
