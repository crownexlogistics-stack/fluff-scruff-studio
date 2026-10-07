import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, ExternalLink, Gift, Plus, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { OCCASIONS, type VoucherOccasion } from "@/components/vouchers/VoucherCard";

const SITE = "https://fluffandscruff.co.uk";

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("gift-voucher", { body });
  if (error) {
    let msg = "Something went wrong";
    if (error instanceof FunctionsHttpError) { try { msg = (await error.context.json())?.error ?? msg; } catch { /* */ } }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

const statusOf = (v: any) => {
  if (v.status === "active" && new Date(v.expires_at).getTime() < Date.now()) return { label: "Expired", variant: "secondary" as const };
  return ({
    active: { label: "Unused", variant: "default" as const },
    reserved: { label: "Being used", variant: "outline" as const },
    redeemed: { label: "Used", variant: "secondary" as const },
    cancelled: { label: "Cancelled", variant: "destructive" as const },
    pending_payment: { label: "Not paid", variant: "outline" as const },
  } as any)[v.status];
};

export default function GiftVouchersAdminPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "redeemed">("active");
  const [open, setOpen] = useState<any>(null);
  const [issueOpen, setIssueOpen] = useState(false);

  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ["gift_vouchers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("gift_vouchers" as any).select("*").neq("status", "pending_payment").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: christmas } = useQuery({
    queryKey: ["voucher_settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_config").select("value").eq("key", "voucher_settings").maybeSingle();
      return (data?.value as any)?.christmas === true;
    },
  });
  const toggleXmas = useMutation({
    mutationFn: async (on: boolean) => {
      const { error } = await supabase.from("site_config").upsert({ key: "voucher_settings", value: { christmas: on }, updated_at: new Date().toISOString() } as any);
      if (error) throw error;
    },
    onSuccess: (_, on) => { qc.invalidateQueries({ queryKey: ["voucher_settings"] }); toast.success(on ? "Christmas vouchers are now on sale" : "Christmas vouchers hidden"); },
    onError: () => toast.error("Couldn't change the setting"),
  });
  const { data: halloweenOn } = useQuery({
    queryKey: ["seasonal_theme_raw"],
    queryFn: async () => {
      const { data } = await supabase.from("site_config").select("value").eq("key", "seasonal_theme").maybeSingle();
      return (data?.value as any)?.active === "halloween";
    },
  });

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return vouchers.filter((v) => {
      if (filter === "active" && v.status !== "active") return false;
      if (filter === "redeemed" && v.status !== "redeemed") return false;
      if (!s) return true;
      return [v.code, v.purchaser_name, v.purchaser_email, v.purchaser_phone, v.recipient_name, v.recipient_email, v.recipient_phone]
        .some((x) => x && String(x).toLowerCase().includes(s.replace(/\s/g, "")) || (x && String(x).toLowerCase().includes(s)));
    });
  }, [vouchers, q, filter]);

  const totals = useMemo(() => {
    const paid = vouchers.filter((v) => !v.is_complimentary);
    return {
      sold: paid.length,
      revenue: paid.reduce((s, v) => s + Number(v.amount_paid || 0), 0),
      outstanding: vouchers.filter((v) => v.status === "active" && new Date(v.expires_at) > new Date()).reduce((s, v) => s + Number(v.amount), 0),
      used: vouchers.filter((v) => v.status === "redeemed").length,
    };
  }, [vouchers]);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl flex items-center gap-2"><Gift className="h-7 w-7 text-primary" />Gift Vouchers</h1>
            <p className="text-sm text-muted-foreground">Sold on the website at <a href={`${SITE}/vouchers`} target="_blank" rel="noreferrer" className="underline">fluffandscruff.co.uk/vouchers</a></p>
          </div>
          <Button onClick={() => setIssueOpen(true)}><Plus className="h-4 w-4 mr-1" />Issue free voucher</Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[["Vouchers sold", String(totals.sold)], ["Money taken", `£${totals.revenue.toFixed(2)}`], ["Unused value owed", `£${totals.outstanding.toFixed(2)}`], ["Used", String(totals.used)]].map(([l, v]) => (
            <div key={l} className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="font-heading text-2xl">{v}</p></div>
          ))}
        </div>

        <div className="rounded-2xl border bg-card p-4 grid sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between gap-3">
            <div><p className="font-semibold">🎃 Halloween voucher</p><p className="text-xs text-muted-foreground">{halloweenOn ? "On sale — follows the Halloween switch on the dashboard" : "Hidden — turn on the Halloween switch on the dashboard"}</p></div>
            <Badge variant={halloweenOn ? "default" : "secondary"}>{halloweenOn ? "On" : "Off"}</Badge>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div><p className="font-semibold">🎄 Christmas voucher</p><p className="text-xs text-muted-foreground">Turn on in Nov/Dec, off in January</p></div>
            <Switch checked={!!christmas} disabled={toggleXmas.isPending} onCheckedChange={(v) => toggleXmas.mutate(v)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]"><Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" /><Input className="pl-9" placeholder="Search code, name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {(["active", "redeemed", "all"] as const).map((k) => (
            <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>{k === "active" ? "Unused" : k === "redeemed" ? "Used" : "All"}</Button>
          ))}
        </div>

        <div className="rounded-2xl border bg-card divide-y">
          {isLoading && <p className="p-6 text-center text-muted-foreground">Loading…</p>}
          {!isLoading && list.length === 0 && <p className="p-6 text-center text-muted-foreground">No vouchers yet.</p>}
          {list.map((v) => {
            const st = statusOf(v);
            return (
              <button key={v.id} onClick={() => setOpen(v)} className="w-full text-left p-4 hover:bg-muted/50 flex flex-wrap items-center gap-3">
                <span className="text-xl">{OCCASIONS[v.occasion as VoucherOccasion]?.emoji ?? "🐾"}</span>
                <div className="flex-1 min-w-[200px]">
                  <p className="font-mono font-semibold">{v.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.is_complimentary ? `Free · ${v.issued_by}` : `Bought by ${v.purchaser_name}`}{v.recipient_name ? ` → ${v.recipient_name}` : ""} · {format(new Date(v.created_at), "d MMM yyyy")}
                  </p>
                </div>
                <p className="font-semibold">£{Number(v.amount).toFixed(2)}</p>
                <Badge variant={st.variant}>{st.label}</Badge>
              </button>
            );
          })}
        </div>
      </div>

      {open && <VoucherDialog v={open} onClose={() => setOpen(null)} onChanged={() => qc.invalidateQueries({ queryKey: ["gift_vouchers"] })} />}
      {issueOpen && <IssueDialog onClose={() => setIssueOpen(false)} onDone={() => qc.invalidateQueries({ queryKey: ["gift_vouchers"] })} />}
    </AppLayout>
  );
}

function VoucherDialog({ v, onClose, onChanged }: { v: any; onClose: () => void; onChanged: () => void }) {
  const [f, setF] = useState({
    purchaser_email: v.purchaser_email || "", purchaser_phone: v.purchaser_phone || "",
    recipient_name: v.recipient_name || "", recipient_email: v.recipient_email || "", recipient_phone: v.recipient_phone || "",
  });
  const [busy, setBusy] = useState(false);
  const usable = v.status === "active" && new Date(v.expires_at) > new Date();

  const { data: events = [] } = useQuery({
    queryKey: ["gift_voucher_events", v.id],
    queryFn: async () => {
      const { data } = await supabase.from("gift_voucher_events" as any).select("*").eq("voucher_id", v.id).order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });
  const { data: booking } = useQuery({
    queryKey: ["voucher-booking", v.redeemed_booking_id],
    enabled: !!v.redeemed_booking_id,
    queryFn: async () => {
      const { data } = await supabase.from("bookings").select("customer_name, dog_name, booking_date, booking_time").eq("id", v.redeemed_booking_id).maybeSingle();
      return data;
    },
  });

  const run = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try {
      const r = await call({ voucher_id: v.id, ...body });
      if (r?.failed?.length) toast.error(`Some messages failed: ${r.failed.join("; ")}`);
      else toast.success(r?.sent?.length ? `${ok}: ${r.sent.join(", ")}` : ok);
      onChanged();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const toRecipient = v.send_to === "recipient";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-mono">{v.code}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(v.code); toast.success("Code copied"); }}><Copy className="h-4 w-4 mr-1" />Copy code</Button>
            <Button size="sm" variant="outline" asChild><a href={`/v/${v.view_token}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1" />Open card</a></Button>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-3">
            <p className="text-muted-foreground">Value</p><p className="font-semibold">£{Number(v.amount).toFixed(2)}</p>
            <p className="text-muted-foreground">Type</p><p>{v.description || OCCASIONS[v.occasion as VoucherOccasion]?.label}</p>
            <p className="text-muted-foreground">Status</p><p>{statusOf(v).label}</p>
            <p className="text-muted-foreground">Expires</p><p>{v.expires_at ? format(new Date(v.expires_at), "d MMM yyyy") : "—"}</p>
            {v.status === "redeemed" && (<>
              <p className="text-muted-foreground">Used</p>
              <p>{v.redeemed_at ? format(new Date(v.redeemed_at), "d MMM yyyy HH:mm") : ""} · {v.redeemed_channel === "online" ? "online" : v.redeemed_channel === "phone" ? "by phone" : "in salon"} · £{Number(v.amount_applied || 0).toFixed(2)} applied</p>
              {booking && (<><p className="text-muted-foreground">Appointment</p><p>{booking.customer_name} · {booking.dog_name} · {format(new Date(booking.booking_date), "d MMM")} {String(booking.booking_time).slice(0, 5)}</p></>)}
            </>)}
            {v.gift_message && (<><p className="text-muted-foreground">Message</p><p className="italic">“{v.gift_message}”</p></>)}
          </div>

          <div className="space-y-2">
            <p className="font-semibold">Buyer {v.is_complimentary && "(free voucher)"}</p>
            {!v.is_complimentary && <p>{v.purchaser_name}</p>}
            {!v.is_complimentary && <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Email</Label><Input value={f.purchaser_email} onChange={set("purchaser_email")} disabled={!usable} /></div>
              <div><Label className="text-xs">Phone</Label><Input value={f.purchaser_phone} onChange={set("purchaser_phone")} disabled={!usable} /></div>
            </div>}
          </div>
          {toRecipient && (
            <div className="space-y-2">
              <p className="font-semibold">Recipient</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2"><Label className="text-xs">Name</Label><Input value={f.recipient_name} onChange={set("recipient_name")} disabled={!usable} /></div>
                <div><Label className="text-xs">Email</Label><Input value={f.recipient_email} onChange={set("recipient_email")} disabled={!usable} /></div>
                <div><Label className="text-xs">Mobile</Label><Input value={f.recipient_phone} onChange={set("recipient_phone")} disabled={!usable} /></div>
              </div>
            </div>
          )}

          {usable ? (
            <div className="space-y-2 rounded-xl border p-3">
              <Button className="w-full" variant="outline" disabled={busy} onClick={() => run({ action: "update_contact", fields: f }, "Details saved")}>Save details</Button>
              {toRecipient && (
                <div className="grid grid-cols-2 gap-2">
                  <Button disabled={busy || !f.recipient_email} onClick={() => run({ action: "update_contact", fields: f, resend: true, channels: ["email"], target: "recipient" }, "Re-sent")}><Send className="h-4 w-4 mr-1" />Email recipient</Button>
                  <Button disabled={busy || !f.recipient_phone} onClick={() => run({ action: "update_contact", fields: f, resend: true, channels: ["sms"], target: "recipient" }, "Re-sent")}><Send className="h-4 w-4 mr-1" />Text recipient</Button>
                </div>
              )}
              {!v.is_complimentary && <Button className="w-full" disabled={busy || !f.purchaser_email} onClick={() => run({ action: "update_contact", fields: f, resend: true, target: "purchaser" }, "Re-sent")}><Send className="h-4 w-4 mr-1" />Email buyer a copy</Button>}
              <Button className="w-full" variant="ghost" disabled={busy} onClick={() => {
                const reason = window.prompt("Why are you cancelling this voucher? (it can't be used after this)");
                if (reason) run({ action: "cancel", reason }, "Voucher cancelled").then(onClose);
              }}>Cancel voucher</Button>
            </div>
          ) : <p className="text-muted-foreground">Used, expired or cancelled vouchers can't be edited or re-sent.</p>}

          <div>
            <p className="font-semibold mb-2">History</p>
            <ul className="space-y-2">
              {events.map((e) => (
                <li key={e.id} className="text-xs border-l-2 border-primary/40 pl-3">
                  <p className="font-medium">{format(new Date(e.created_at), "d MMM yyyy HH:mm")} · {e.performed_by}</p>
                  <p className="text-muted-foreground">{e.note}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IssueDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ amount: "", recipient_name: "", recipient_email: "", recipient_phone: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    setBusy(true);
    try {
      const r = await call({ action: "issue", amount: Number(f.amount), recipient_name: f.recipient_name, recipient_email: f.recipient_email || null, recipient_phone: f.recipient_phone || null, reason: f.reason, occasion: "classic" });
      toast.success(`Voucher ${r.code} created${r.sent?.length ? ` and sent (${r.sent.join(", ")})` : ""}`);
      if (r.failed?.length) toast.error(`Sending failed: ${r.failed.join("; ")}`);
      onDone(); onClose();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Issue a free voucher</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Value (£)</Label><Input inputMode="numeric" value={f.amount} onChange={set("amount")} placeholder="50" /></div>
          <div><Label>Recipient name</Label><Input value={f.recipient_name} onChange={set("recipient_name")} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Email (optional)</Label><Input value={f.recipient_email} onChange={set("recipient_email")} /></div>
            <div><Label>Mobile (optional)</Label><Input value={f.recipient_phone} onChange={set("recipient_phone")} /></div>
          </div>
          <div><Label>Reason</Label><Input value={f.reason} onChange={set("reason")} placeholder="e.g. Charity raffle prize" /></div>
          <Button className="w-full" disabled={busy || !f.amount || !f.recipient_name || f.reason.length < 3} onClick={submit}>{busy ? "Creating…" : "Create voucher"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
