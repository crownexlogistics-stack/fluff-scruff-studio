import { AppLayout } from "@/components/AppLayout";
import { useOwnerDashboard } from "@/hooks/useOwnerDashboard";
import { OwnerHeader } from "@/components/dashboard/owner/OwnerHeader";
import { OwnerBriefingAI } from "@/components/dashboard/owner/OwnerBriefingAI";
import { OwnerAttention } from "@/components/dashboard/owner/OwnerAttention";
import { OwnerToday } from "@/components/dashboard/owner/OwnerToday";
import { OwnerMoney } from "@/components/dashboard/owner/OwnerMoney";
import { OwnerCapacity, OwnerForward } from "@/components/dashboard/owner/OwnerCapacity";
import { OwnerTeam } from "@/components/dashboard/owner/OwnerTeam";
import { OwnerActivity } from "@/components/dashboard/owner/OwnerActivity";
import { OwnerMarketing } from "@/components/dashboard/owner/OwnerMarketing";
import { UnavailableBookingsWarning } from "@/components/dashboard/UnavailableBookingsWarning";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * /admin — the owner's command centre.
 * Every number on this page comes from useOwnerDashboard(), the single
 * source of truth, so no two sections can disagree with each other.
 */
const AdminDashboard = () => {
  const d = useOwnerDashboard();

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

        {/* 8 — Recent activity */}
        <OwnerActivity d={d} />

        {/* 9 — Marketing snapshot */}
        <OwnerMarketing d={d} />
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
