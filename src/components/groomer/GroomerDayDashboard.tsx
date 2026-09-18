import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { differenceInCalendarDays, format, isToday } from "date-fns";
import { toast } from "sonner";
import { AlertCircle, ArrowRight, CalendarDays, Check, ChevronRight, CircleDollarSign, Clock3, Dog, Inbox, MessageSquare, PawPrint, Send, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGroomerDay, type GroomerDayBooking } from "@/hooks/useGroomerDay";
import { useUnassignedInboxCount } from "@/hooks/useUnassignedInboxCount";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

function money(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: value % 1 ? 2 : 0 }).format(value);
}

function profileHref(booking: GroomerDayBooking) {
  if (booking.customer_email) return `/admin/customers/${encodeURIComponent(booking.customer_email)}`;
  if (booking.customer_phone) return `/admin/customers/phone:${encodeURIComponent(booking.customer_phone)}`;
  return null;
}

function statusFor(booking: GroomerDayBooking, nextId?: string) {
  if (booking.status === "Completed") return { label: "Completed", tone: "good" as const };
  if (booking.status === "Cancelled") return { label: "Cancelled", tone: "bad" as const };
  if (booking.status === "No Show") return { label: "No show", tone: "bad" as const };
  if (booking.id === nextId) return { label: "Next", tone: "next" as const };
  return { label: "Upcoming", tone: "neutral" as const };
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: { label: string; to: string } }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted-foreground">{children}</h2>
      {action && <Link to={action.to} className="text-xs font-bold text-primary hover:underline">{action.label}</Link>}
    </div>
  );
}

export function GroomerDayDashboard({ staffId, staffName }: { staffId: string; staffName: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const data = useGroomerDay(staffId);
  const aiInboxCount = useUnassignedInboxCount();
  const [sendingId, setSendingId] = useState<string | null>(null);
  const firstName = staffName.split(" ")[0] || "there";
  const next = data.nextAppointment;
  const nextEmail = next?.customer_email?.toLowerCase();
  const nextNotes = nextEmail ? data.notesByEmail.get(nextEmail) || [] : [];
  const nextHistory = nextEmail ? data.historyByEmail.get(nextEmail) : undefined;

  const depositMutation = useMutation({
    mutationFn: async (booking: GroomerDayBooking) => {
      setSendingId(booking.id);
      const { data: result, error } = await supabase.functions.invoke("send-payment-link", {
        body: { booking_id: booking.id, send_via: booking.customer_email ? "email" : "sms", payment_type: "deposit" },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      const { error: updateError } = await supabase.from("bookings").update({ deposit_link_sent_at: new Date().toISOString() } as any).eq("id", booking.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Deposit link sent");
      queryClient.invalidateQueries({ queryKey: ["groomer-day-bookings"] });
    },
    onError: () => toast.error("The deposit link could not be sent"),
    onSettled: () => setSendingId(null),
  });

  const attentionCount = data.missingDeposits.length + data.unreadMessages + aiInboxCount;
  const nextWeekCount = useMemo(() => data.upcoming.filter((booking) => booking.booking_date > data.today).length, [data.today, data.upcoming]);
  const summaryStats: { label: string; value: string | number; icon: LucideIcon }[] = [
    { label: "Today's appointments", value: data.activeToday.length, icon: CalendarDays },
    { label: "Completed", value: data.completedToday.length, icon: Check },
    { label: "Remaining", value: data.remainingToday.length, icon: Clock3 },
    { label: "Scheduled value", value: data.activeToday.length ? money(data.scheduledToday) : "—", icon: CircleDollarSign },
  ];

  if (data.isLoading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading your day…</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-10">
      <header className="border-b border-border/70 pb-6">
        <p className="text-sm font-bold text-primary">{format(new Date(), "EEEE d MMMM")}</p>
        <h1 className="mt-1 text-3xl md:text-4xl text-foreground">Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {firstName} 👋</h1>
        <p className="mt-2 text-base text-muted-foreground">
          {data.activeToday.length > 0
            ? `You have ${data.activeToday.length} appointment${data.activeToday.length === 1 ? "" : "s"} today.`
            : next
              ? `You have no appointments today. Your next booking is ${format(new Date(`${next.booking_date}T${next.booking_time}`), "EEEE 'at' HH:mm")}.`
              : "You have no appointments today or in the next 90 days."}
          {data.activeToday.length === 0 && nextWeekCount > 0 ? ` ${nextWeekCount} upcoming appointment${nextWeekCount === 1 ? " is" : "s are"} visible below.` : ""}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 md:grid-cols-4">
        {summaryStats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-card p-4 md:p-5">
            <Icon className="mb-4 h-4 w-4 text-primary" />
            <p className="font-heading text-2xl text-foreground">{value}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
        <div className="space-y-8">
          <section className="space-y-3">
            <SectionTitle>Next appointment</SectionTitle>
            {next ? (
              <div className="overflow-hidden rounded-2xl bg-foreground text-background shadow-sm">
                <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:p-7">
                  <div>
                    <div className="mb-5 flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground"><Dog className="h-5 w-5" /></div>
                      <div>
                        <h3 className="text-2xl text-background">{next.dog_name}</h3>
                        <p className="text-sm text-background/65">{next.service_name}{next.breed_name ? ` · ${next.breed_name}` : ""}</p>
                      </div>
                    </div>
                    <p className="text-lg font-bold">{format(new Date(`${next.booking_date}T${next.booking_time}`), isToday(new Date(`${next.booking_date}T00:00:00`)) ? "HH:mm" : "EEE d MMM · HH:mm")}</p>
                    <p className="mt-1 text-sm text-background/70">{next.customer_name}</p>
                    {(next.notes || nextNotes.length > 0) && (
                      <div className="mt-5 border-l-2 border-primary pl-3 text-sm text-background/80">
                        {next.notes && <p>{next.notes}</p>}
                        {nextNotes.map((note) => <p key={note.created_at} className="mt-1">{note.note}</p>)}
                      </div>
                    )}
                    {nextHistory?.lastVisit && <p className="mt-4 text-xs text-background/55">Previous visit: {format(new Date(`${nextHistory.lastVisit}T00:00:00`), "d MMMM yyyy")} · {nextHistory.count} completed before this booking</p>}
                  </div>
                  <div className="flex items-end">
                    <Button onClick={() => navigate("/portal/bookings")} className="w-full sm:w-auto">Open appointment <ArrowRight /></Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No upcoming appointment is currently booked.</div>
            )}
          </section>

          <section className="space-y-3">
            <SectionTitle action={{ label: "Open calendar", to: "/portal/bookings" }}>Today's schedule</SectionTitle>
            {data.todayBookings.length > 0 ? (
              <div className="divide-y divide-border/70 border-y border-border/70">
                {data.todayBookings.map((booking) => {
                  const status = statusFor(booking, next?.booking_date === data.today ? next.id : undefined);
                  const href = profileHref(booking);
                  return (
                    <div key={booking.id} className="grid grid-cols-[58px_minmax(0,1fr)_auto] items-center gap-3 py-4 md:grid-cols-[70px_1fr_1fr_auto]">
                      <p className="font-heading text-lg">{booking.booking_time.slice(0, 5)}</p>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-foreground">{booking.dog_name}</p>
                        <p className="truncate text-xs text-muted-foreground md:hidden">{booking.service_name} · {booking.customer_name}</p>
                      </div>
                      <div className="hidden min-w-0 md:block"><p className="truncate text-sm">{booking.service_name}</p><p className="truncate text-xs text-muted-foreground">{booking.customer_name}</p></div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={cn("whitespace-nowrap", status.tone === "good" && "border-success/30 bg-success/10 text-success", status.tone === "bad" && "border-destructive/30 bg-destructive/10 text-destructive", status.tone === "next" && "border-primary/30 bg-primary/10 text-primary")}>{status.label}</Badge>
                        {href && <Button variant="ghost" size="icon" asChild aria-label={`View ${booking.customer_name}`}><Link to={href}><ChevronRight /></Link></Button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="border-y border-border/70 py-8 text-center text-sm text-muted-foreground">No appointments today.</p>}
          </section>

          <section className="space-y-3">
            <SectionTitle action={{ label: "My bookings", to: "/portal/bookings" }}>Coming up</SectionTitle>
            {data.upcoming.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {data.upcoming.slice(0, 4).map((booking) => (
                  <Link key={booking.id} to="/portal/bookings" className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3 transition-colors hover:bg-muted/50">
                    <div className="min-w-12 text-center"><p className="text-[10px] font-bold uppercase text-muted-foreground">{format(new Date(`${booking.booking_date}T00:00:00`), "EEE")}</p><p className="font-heading text-lg">{format(new Date(`${booking.booking_date}T00:00:00`), "d")}</p></div>
                    <div className="min-w-0"><p className="truncate text-sm font-bold">{booking.booking_time.slice(0,5)} · {booking.dog_name}</p><p className="truncate text-xs text-muted-foreground">{booking.customer_name} · {booking.service_name}</p></div>
                  </Link>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No upcoming bookings in the next 90 days.</p>}
          </section>
        </div>

        <aside className="space-y-8">
          <section className="space-y-3">
            <SectionTitle>Needs me</SectionTitle>
            <div className="rounded-2xl border border-border/70 bg-card p-4">
              {attentionCount === 0 ? (
                <div className="flex gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-success/10 text-success"><Check /></div><div><p className="font-bold">You're all caught up</p><p className="text-sm text-muted-foreground">Nothing needs your attention right now.</p></div></div>
              ) : (
                <div className="divide-y divide-border/70">
                  {data.unreadMessages > 0 && <Link to="/portal/messages" className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"><MessageSquare className="mt-0.5 h-4 w-4 text-primary"/><span className="flex-1 text-sm"><strong>{data.unreadMessages} unread customer message{data.unreadMessages === 1 ? "" : "s"}</strong><span className="block text-muted-foreground">Open customer conversations</span></span><ChevronRight className="h-4 w-4"/></Link>}
                  {aiInboxCount > 0 && <Link to="/ai-inbox" className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"><Inbox className="mt-0.5 h-4 w-4 text-primary"/><span className="flex-1 text-sm"><strong>{aiInboxCount} AI case{aiInboxCount === 1 ? "" : "s"} waiting</strong><span className="block text-muted-foreground">Review unassigned calls and requests</span></span><ChevronRight className="h-4 w-4"/></Link>}
                  {data.missingDeposits.slice(0, 3).map((booking) => (
                    <div key={booking.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"><AlertCircle className="mt-0.5 h-4 w-4 text-warning"/><div className="min-w-0 flex-1 text-sm"><strong className="block truncate">Deposit missing · {booking.dog_name}</strong><span className="block text-muted-foreground">{differenceInCalendarDays(new Date(`${booking.booking_date}T00:00:00`), new Date()) === 0 ? "Today" : format(new Date(`${booking.booking_date}T00:00:00`), "EEE d MMM")}</span></div>{booking.deposit_link_sent_at ? <Badge variant="secondary">Sent</Badge> : <Button size="sm" variant="outline" disabled={sendingId === booking.id} onClick={() => depositMutation.mutate(booking)}><Send /> Send</Button>}</div>
                  ))}
                  {data.missingDeposits.length > 3 && <Link to="/portal/bookings" className="block pt-3 text-xs font-bold text-primary">View {data.missingDeposits.length - 3} more</Link>}
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle>Groomer Assistant</SectionTitle>
            <div className="rounded-2xl bg-primary/10 p-5">
              <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary"/><h3 className="font-heading text-lg">What do you need help with?</h3></div>
              <div className="mt-4 flex flex-wrap gap-2">{["Today's schedule", "Next appointment", "Customer information"].map((label) => <Badge key={label} variant="outline" className="bg-background/70">{label}</Badge>)}</div>
              <Button asChild className="mt-5 w-full"><Link to="/portal/assistant">Ask Assistant <ArrowRight /></Link></Button>
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle action={{ label: "View details", to: "/portal/finance" }}>My earnings</SectionTitle>
            <div className="divide-y divide-border/70 rounded-2xl border border-border/70 bg-card px-4">
              {[["This week", data.earnings.week], ["This month", data.earnings.month], ["All time", data.earnings.all]].map(([label, stat]) => {
                const value = stat as { amount: number; count: number };
                return <div key={String(label)} className="flex items-center justify-between py-3"><div><p className="text-xs font-bold uppercase text-muted-foreground">{label as string}</p><p className="text-xs text-muted-foreground">{value.count} completed appointment{value.count === 1 ? "" : "s"}</p></div><p className="font-heading text-xl">{money(value.amount)}</p></div>;
              })}
            </div>
            <p className="text-xs text-muted-foreground">Your earnings are based on commission records created from completed appointments.</p>
          </section>

          {(data.performance.completedWeek > 0 || data.performance.completedMonth > 0) && (
            <section className="space-y-3">
              <SectionTitle>My performance</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/60 p-4"><PawPrint className="h-4 w-4 text-primary"/><p className="mt-4 font-heading text-2xl">{data.performance.completedWeek}</p><p className="text-xs text-muted-foreground">Completed this week</p></div>
                <div className="rounded-xl bg-muted/60 p-4"><Dog className="h-4 w-4 text-primary"/><p className="mt-4 font-heading text-2xl">{data.performance.completedMonth}</p><p className="text-xs text-muted-foreground">Completed this month</p></div>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
