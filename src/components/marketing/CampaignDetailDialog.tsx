import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, MailCheck, MailOpen, MousePointerClick, UserMinus, CalendarCheck, MailX, Loader2 } from "lucide-react";

async function fetchAll<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

type Filter = "all" | "opened" | "clicked" | "booked" | "unsubscribed" | "failed" | "not_opened";

interface Recipient {
  email: string;
  sentAt: string | null;
  failed: boolean;
  error: string | null;
  opens: string[];
  clicks: { at: string; url: string | null }[];
  unsubAt: string | null;
  bookings: { id: string; name: string | null; date: string; price: number; createdAt: string }[];
}

const fmt = (d: string) => format(new Date(d), "d MMM, HH:mm");

export function CampaignDetailDialog({ campaignId, subject, open, onOpenChange }: {
  campaignId: string | null; subject: string; open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [limit, setLimit] = useState(100);

  const { data, isLoading, error } = useQuery({
    queryKey: ["campaign-detail", campaignId],
    enabled: !!campaignId && open,
    queryFn: async () => {
      const [sends, events, bookings] = await Promise.all([
        fetchAll<any>((f, t) => supabase.from("campaign_send_log").select("email, status, error_message, sent_at").eq("campaign_id", campaignId!).order("sent_at").range(f, t)),
        fetchAll<any>((f, t) => supabase.from("email_events").select("email, event_type, url, created_at").eq("campaign_id", campaignId!).order("created_at").range(f, t)),
        fetchAll<any>((f, t) => supabase.from("bookings").select("id, customer_name, customer_email, booking_date, total_price, created_at, status").eq("attributed_campaign_id", campaignId!).range(f, t)),
      ]);
      const firstSend = sends.find((s) => s.sent_at)?.sent_at;
      const unsubs = firstSend
        ? await fetchAll<any>((f, t) => supabase.from("email_unsubscribes").select("email, unsubscribed_at").gte("unsubscribed_at", firstSend).range(f, t))
        : [];
      return { sends, events, bookings, unsubs };
    },
  });

  const recipients = useMemo<Recipient[]>(() => {
    if (!data) return [];
    const map = new Map<string, Recipient>();
    const get = (e: string) => {
      const k = e.toLowerCase().trim();
      if (!map.has(k)) map.set(k, { email: k, sentAt: null, failed: false, error: null, opens: [], clicks: [], unsubAt: null, bookings: [] });
      return map.get(k)!;
    };
    for (const s of data.sends) {
      const r = get(s.email);
      r.sentAt = s.sent_at;
      r.failed = s.status !== "sent";
      r.error = s.error_message;
    }
    for (const e of data.events) {
      const r = get(e.email);
      if (e.event_type === "open") r.opens.push(e.created_at);
      else if (e.event_type === "click") r.clicks.push({ at: e.created_at, url: e.url });
    }
    for (const b of data.bookings) {
      if (!b.customer_email || ["Cancelled", "Refunded"].includes(b.status)) continue;
      get(b.customer_email).bookings.push({ id: b.id, name: b.customer_name, date: b.booking_date, price: Number(b.total_price), createdAt: b.created_at });
    }
    for (const u of data.unsubs) {
      const r = map.get(u.email.toLowerCase().trim());
      if (r && r.sentAt && u.unsubscribed_at >= r.sentAt) r.unsubAt = u.unsubscribed_at;
    }
    return Array.from(map.values()).sort((a, b) =>
      (b.bookings.length - a.bookings.length) || (b.clicks.length - a.clicks.length) || (b.opens.length - a.opens.length) || a.email.localeCompare(b.email));
  }, [data]);

  const counts = useMemo(() => ({
    all: recipients.length,
    opened: recipients.filter((r) => r.opens.length).length,
    clicked: recipients.filter((r) => r.clicks.length).length,
    booked: recipients.filter((r) => r.bookings.length).length,
    unsubscribed: recipients.filter((r) => r.unsubAt).length,
    failed: recipients.filter((r) => r.failed).length,
    not_opened: recipients.filter((r) => !r.failed && !r.opens.length).length,
  }), [recipients]);

  const revenue = recipients.reduce((s, r) => s + r.bookings.reduce((a, b) => a + b.price, 0), 0);
  const delivered = recipients.filter((r) => r.sentAt && !r.failed).length;
  const pct = (n: number) => (delivered > 0 ? `${((n / delivered) * 100).toFixed(1)}%` : "—");

  const filtered = recipients.filter((r) => {
    if (search && !r.email.includes(search.toLowerCase().trim())) return false;
    switch (filter) {
      case "opened": return r.opens.length > 0;
      case "clicked": return r.clicks.length > 0;
      case "booked": return r.bookings.length > 0;
      case "unsubscribed": return !!r.unsubAt;
      case "failed": return r.failed;
      case "not_opened": return !r.failed && !r.opens.length;
      default: return true;
    }
  });

  const tiles: { key: Filter; label: string; icon: any; value: number; sub: string }[] = [
    { key: "all", label: "Sent", icon: MailCheck, value: delivered, sub: counts.failed ? `${counts.failed} failed` : "delivered" },
    { key: "opened", label: "Opened", icon: MailOpen, value: counts.opened, sub: pct(counts.opened) },
    { key: "clicked", label: "Clicked", icon: MousePointerClick, value: counts.clicked, sub: pct(counts.clicked) },
    { key: "booked", label: "Booked", icon: CalendarCheck, value: counts.booked, sub: `£${revenue.toFixed(2)}` },
    { key: "unsubscribed", label: "Unsubscribed", icon: UserMinus, value: counts.unsubscribed, sub: pct(counts.unsubscribed) },
  ];

  const chips: { key: Filter; label: string }[] = [
    { key: "all", label: "Everyone" }, { key: "opened", label: "Opened" }, { key: "not_opened", label: "Didn't open" },
    { key: "clicked", label: "Clicked" }, { key: "booked", label: "Booked" }, { key: "unsubscribed", label: "Unsubscribed" },
    ...(counts.failed ? [{ key: "failed" as Filter, label: "Failed" }] : []),
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setFilter("all"); setSearch(""); setExpanded(null); setLimit(100); } }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl pr-6">{subject}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Loading campaign…</div>
        ) : error ? (
          <p className="text-destructive py-8 text-center">Couldn't load this campaign's details.</p>
        ) : recipients.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">No individual sending records exist for this campaign. Older campaigns were sent before per-email records were kept.</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {tiles.map((t) => (
                <button key={t.key} onClick={() => setFilter(t.key)}
                  className={`text-left rounded-xl border p-3 transition-colors hover:bg-muted/50 ${filter === t.key ? "border-primary bg-primary/5" : ""}`}>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium uppercase tracking-wider"><t.icon className="h-3.5 w-3.5" />{t.label}</div>
                  <p className="text-2xl font-bold font-heading mt-1">{t.value}</p>
                  <p className="text-xs text-muted-foreground">{t.sub}</p>
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <Button key={c.key} size="sm" variant={filter === c.key ? "default" : "outline"} className="h-7 rounded-full text-xs" onClick={() => { setFilter(c.key); setLimit(100); }}>
                    {c.label} · {counts[c.key]}
                  </Button>
                ))}
              </div>
              <Input placeholder="Search email…" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:ml-auto sm:w-56 h-8" />
            </div>

            <div className="border rounded-xl divide-y">
              {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nobody matches this filter.</p>}
              {filtered.slice(0, limit).map((r) => {
                const isOpen = expanded === r.email;
                const timeline = [
                  ...(r.sentAt ? [{ at: r.sentAt, icon: r.failed ? MailX : MailCheck, text: r.failed ? `Failed to send${r.error ? ` — ${r.error}` : ""}` : "Email sent" }] : []),
                  ...r.opens.map((at) => ({ at, icon: MailOpen, text: "Opened the email" })),
                  ...r.clicks.map((c) => ({ at: c.at, icon: MousePointerClick, text: `Clicked ${c.url ? c.url.replace(/^https?:\/\//, "").split("?")[0] : "a link"}` })),
                  ...r.bookings.map((b) => ({ at: b.createdAt, icon: CalendarCheck, text: `Booked for ${format(new Date(b.date), "EEE d MMM")} — £${b.price.toFixed(2)}` })),
                  ...(r.unsubAt ? [{ at: r.unsubAt, icon: UserMinus, text: "Unsubscribed" }] : []),
                ].sort((a, b) => a.at.localeCompare(b.at));
                return (
                  <div key={r.email}>
                    <button className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40" onClick={() => setExpanded(isOpen ? null : r.email)}>
                      {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      <span className="text-sm truncate flex-1 min-w-0">{r.bookings[0]?.name ? <><span className="font-medium">{r.bookings[0].name}</span> <span className="text-muted-foreground">· {r.email}</span></> : r.email}</span>
                      <div className="flex gap-1 shrink-0">
                        {r.failed && <Badge variant="destructive" className="text-[10px]">Failed</Badge>}
                        {r.opens.length > 0 && <Badge variant="outline" className="text-[10px]">Opened</Badge>}
                        {r.clicks.length > 0 && <Badge variant="secondary" className="text-[10px]">Clicked</Badge>}
                        {r.bookings.length > 0 && <Badge className="text-[10px]">Booked £{r.bookings.reduce((a, b) => a + b.price, 0).toFixed(0)}</Badge>}
                        {r.unsubAt && <Badge variant="destructive" className="text-[10px]">Unsubscribed</Badge>}
                      </div>
                    </button>
                    {isOpen && (
                      <ol className="px-12 pb-3 space-y-1.5">
                        {timeline.map((t, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <t.icon className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="text-muted-foreground w-24 shrink-0 text-xs">{fmt(t.at)}</span>
                            <span className="truncate">{t.text}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                );
              })}
              {filtered.length > limit && (
                <div className="p-3 text-center">
                  <Button variant="ghost" size="sm" onClick={() => setLimit(limit + 200)}>Show more ({filtered.length - limit} left)</Button>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Opens can be overcounted by inboxes that load images automatically. Unsubscribes shown are people who unsubscribed after receiving this email. Cancelled bookings are not counted.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
