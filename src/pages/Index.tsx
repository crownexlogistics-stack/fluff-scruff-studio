import { AppLayout } from "@/components/AppLayout";
import { useOwnerDashboard } from "@/hooks/useOwnerDashboard";
import { OwnerHeader } from "@/components/dashboard/owner/OwnerHeader";
import { OwnerBriefingAI } from "@/components/dashboard/owner/OwnerBriefingAI";
import { OwnerAttention } from "@/components/dashboard/owner/OwnerAttention";
import { OwnerToday } from "@/components/dashboard/owner/OwnerToday";
import { OwnerMoney } from "@/components/dashboard/owner/OwnerMoney";
import { OwnerCapacity, OwnerForward } from "@/components/dashboard/owner/OwnerCapacity";
import { OwnerTeam } from "@/components/dashboard/owner/OwnerTeam";
import { OwnerGroomerRetention } from "@/components/dashboard/owner/OwnerGroomerRetention";
import { OwnerActivity } from "@/components/dashboard/owner/OwnerActivity";
import { OwnerMarketing } from "@/components/dashboard/owner/OwnerMarketing";
import { UnavailableBookingsWarning } from "@/components/dashboard/UnavailableBookingsWarning";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState } from "react";
import { endOfMonth, endOfWeek, endOfYear, format, startOfDay, startOfMonth, startOfWeek, startOfYear } from "date-fns";
import { OwnerPeriodReport } from "@/components/dashboard/owner/OwnerPeriodReport";
import { useBusinessBeginning } from "@/hooks/useBusinessBeginning";
import type { ReportingPeriodKey, ReportingRange } from "@/hooks/useOwnerReportingPeriod";

/**
 * /admin — the owner's command centre.
 * Every number on this page comes from useOwnerDashboard(), the single
 * source of truth, so no two sections can disagree with each other.
 */
const AdminDashboard = () => {
  const d = useOwnerDashboard();
  const beginning = useBusinessBeginning();
  const [period, setPeriod] = useState<ReportingPeriodKey>("month");
  const [customStart, setCustomStart] = useState(startOfMonth(new Date()));
  const [customEnd, setCustomEnd] = useState(new Date());
  const range = useMemo<ReportingRange>(() => {
    const now = new Date();
    if (period === "today") return { key: period, start: startOfDay(now), end: startOfDay(now), label: `Today · ${format(now, "d MMMM yyyy")}` };
    if (period === "week") return { key: period, start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }), label: `This week · ${format(startOfWeek(now, { weekStartsOn: 1 }), "d MMM")} – ${format(endOfWeek(now, { weekStartsOn: 1 }), "d MMM yyyy")}` };
    if (period === "year") return { key: period, start: startOfYear(now), end: endOfYear(now), label: `Year to date · 1 January – ${format(now, "d MMMM yyyy")}` };
    if (period === "beginning") {
      const start = beginning.data ?? startOfDay(now);
      return { key: period, start, end: now, label: beginning.data ? `Since beginning · ${format(start, "d MMMM yyyy")} – ${format(now, "d MMMM yyyy")}` : "Since beginning" };
    }
    if (period === "custom") return { key: period, start: customStart, end: customEnd, label: `Custom · ${format(customStart, "d MMMM yyyy")} – ${format(customEnd, "d MMMM yyyy")}` };
    return { key: "month", start: startOfMonth(now), end: endOfMonth(now), label: `This month · ${format(startOfMonth(now), "d MMMM")} – ${format(endOfMonth(now), "d MMMM yyyy")}` };
  }, [period, beginning.data, customStart, customEnd]);

  if (d.isLoading) {
    return (
      <AppLayout>
        <div className="max-w-[1200px] mx-auto space-y-6">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-[1200px] mx-auto space-y-8 md:space-y-10 pb-10">
        {/* 1 — Daily briefing */}
        <OwnerHeader d={d} />
        <OwnerPeriodReport
          range={range}
          onPeriod={setPeriod}
          onCustomStart={(date) => { setCustomStart(date); if (date > customEnd) setCustomEnd(date); }}
          onCustomEnd={(date) => { setCustomEnd(date); if (date < customStart) setCustomStart(date); }}
        />
        <OwnerBriefingAI />

        {/* 2 — Needs your attention */}
        <div className="space-y-3">
          <UnavailableBookingsWarning />
          <OwnerAttention alerts={d.alerts} />
        </div>

        {/* 3 — Today's business */}
        <OwnerToday d={d} />

        {/* 4 — Money */}
        <OwnerMoney d={d} />

        {/* 5 — Bookings & capacity */}
        <OwnerCapacity d={d} />

        {/* 6 — Forward bookings */}
        <OwnerForward d={d} />

        {/* 7 — Team */}
        <OwnerTeam d={d} />
        <OwnerGroomerRetention />

        {/* 8 — Recent activity */}
        <OwnerActivity d={d} />

        {/* 9 — Marketing snapshot */}
        <OwnerMarketing d={d} />
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
