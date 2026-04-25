import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ParsedCsvRow {
  date: string;
  amount: number;
  type: string; // "card" | "cash" | etc
}

/** Minimal CSV parser for Worldpay-style payment exports. */
function parsePaymentCsv(text: string): ParsedCsvRow[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const splitLine = (line: string) => {
    // simple CSV split that respects double quotes
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQ = !inQ;
      } else if (ch === "," && !inQ) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  const header = splitLine(lines[0]).map((h) => h.toLowerCase());
  const idxDate = header.indexOf("date");
  const idxAmount = header.indexOf("amount");
  const idxType = header.indexOf("type");

  if (idxDate === -1 || idxAmount === -1) return [];

  const rows: ParsedCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    const date = (cols[idxDate] || "").trim();
    const amount = parseFloat((cols[idxAmount] || "0").trim()) || 0;
    const type = idxType !== -1 ? (cols[idxType] || "").trim().toLowerCase() : "";
    if (date) rows.push({ date, amount, type });
  }
  return rows;
}

/** Try to coerce various Worldpay date formats into yyyy-mm-dd. */
function normaliseDate(d: string): string | null {
  if (!d) return null;
  // ISO 2026-04-01 or 2026-04-01T...
  const iso = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // dd/mm/yyyy or dd-mm-yyyy
  const uk = d.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (uk) {
    const dd = uk[1].padStart(2, "0");
    const mm = uk[2].padStart(2, "0");
    let yyyy = uk[3];
    if (yyyy.length === 2) yyyy = "20" + yyyy;
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const monthStart: string = body.month_start; // yyyy-mm-dd
    const monthEnd: string = body.month_end; // yyyy-mm-dd

    if (!monthStart || !monthEnd) {
      return new Response(JSON.stringify({ error: "month_start and month_end required (yyyy-mm-dd)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startUnix = Math.floor(new Date(`${monthStart}T00:00:00Z`).getTime() / 1000);
    const endUnix = Math.floor(new Date(`${monthEnd}T23:59:59Z`).getTime() / 1000);

    // ── 1. STRIPE ──────────────────────────────────
    let stripeTotal = 0;
    let stripeCount = 0;
    let stripeError: string | null = null;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey) {
      try {
        let hasMore = true;
        let startingAfter: string | undefined;
        let pages = 0;
        while (hasMore && pages < 10) {
          const params = new URLSearchParams({
            "created[gte]": String(startUnix),
            "created[lte]": String(endUnix),
            limit: "100",
          });
          if (startingAfter) params.set("starting_after", startingAfter);
          const r = await fetch(`https://api.stripe.com/v1/payment_intents?${params}`, {
            headers: { Authorization: `Bearer ${stripeKey}` },
          });
          if (!r.ok) {
            stripeError = `Stripe ${r.status}`;
            break;
          }
          const j = await r.json();
          const data: any[] = j.data || [];
          for (const pi of data) {
            if (pi.status === "succeeded" && Number(pi.amount_received) > 0) {
              stripeTotal += Number(pi.amount_received);
              stripeCount += 1;
            }
          }
          hasMore = !!j.has_more;
          if (hasMore && data.length > 0) startingAfter = data[data.length - 1].id;
          pages += 1;
        }
      } catch (e: any) {
        stripeError = e?.message || "Stripe fetch failed";
      }
    } else {
      stripeError = "STRIPE_SECRET_KEY not configured";
    }
    const stripePounds = stripeTotal / 100;

    // ── 2. WORLDPAY (from reconciliation_runs.raw_csv) ────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let worldpayCard = 0;
    let worldpayCash = 0;
    let worldpayHasData = false;
    try {
      const { data: runs } = await supabase
        .from("reconciliation_runs")
        .select("raw_csv")
        .not("raw_csv", "is", null)
        .order("uploaded_at", { ascending: false })
        .limit(50);

      const seenOrderTimes = new Set<string>();
      for (const run of runs ?? []) {
        const rows = parsePaymentCsv((run as any).raw_csv || "");
        for (const r of rows) {
          const d = normaliseDate(r.date);
          if (!d) continue;
          if (d < monthStart || d > monthEnd) continue;
          if (r.amount <= 0) continue;
          const key = `${d}|${r.amount}|${r.type}`;
          if (seenOrderTimes.has(key)) continue;
          seenOrderTimes.add(key);
          worldpayHasData = true;
          if (r.type === "cash") worldpayCash += r.amount;
          else worldpayCard += r.amount;
        }
      }
    } catch (_e) {
      // ignore — fall through with zeros
    }

    // ── 3. CASH at checkout from commissions / bookings ───
    // Use commission_records.created_at (when checkout was completed)
    let salonCashCollected = 0;
    try {
      const { data: comms } = await supabase
        .from("commission_records")
        .select("total_price, deposit_paid, final_charge, created_at")
        .gte("created_at", `${monthStart}T00:00:00`)
        .lte("created_at", `${monthEnd}T23:59:59`);
      for (const c of comms ?? []) {
        const charged = Number((c as any).final_charge) > 0
          ? Number((c as any).final_charge)
          : Number((c as any).total_price || 0);
        const balance = Math.max(0, charged - Number((c as any).deposit_paid || 0));
        salonCashCollected += balance;
      }
    } catch (_e) {
      // ignore
    }

    // ── 4. REVENUE this month (for comparison) ─────
    let revenue = 0;
    try {
      const { data: bookings } = await supabase
        .from("bookings")
        .select("total_price, final_charge, status")
        .gte("booking_date", monthStart)
        .lte("booking_date", monthEnd);
      for (const b of bookings ?? []) {
        if ((b as any).status === "Completed" || (b as any).status === "No Show") {
          const fc = Number((b as any).final_charge);
          revenue += fc > 0 ? fc : Number((b as any).total_price || 0);
        }
      }
    } catch (_e) {
      // ignore
    }

    // ── 5. BILLS due this month (for warning) ──────
    let billsThisMonth = 0;
    try {
      const { data: oneOff } = await supabase
        .from("expenses")
        .select("amount")
        .eq("expense_type", "one_off")
        .gte("expense_date", monthStart)
        .lte("expense_date", monthEnd);
      for (const e of oneOff ?? []) billsThisMonth += Number((e as any).amount || 0);

      // Recurring monthly expenses count once per month
      const { data: recurring } = await supabase
        .from("expenses")
        .select("amount, frequency, recurring_start_date, recurring_end_date")
        .eq("expense_type", "recurring");
      for (const e of recurring ?? []) {
        const freq = (e as any).frequency || "monthly";
        const amt = Number((e as any).amount || 0);
        if (amt <= 0) continue;
        const startD = (e as any).recurring_start_date as string | null;
        const endD = (e as any).recurring_end_date as string | null;
        if (startD && startD > monthEnd) continue;
        if (endD && endD < monthStart) continue;
        if (freq === "monthly") billsThisMonth += amt;
        else if (freq === "weekly") billsThisMonth += amt * 4;
        else if (freq === "annual") {
          // include if anniversary date falls in this month
          if (startD) {
            const m = startD.substring(5, 7);
            if (monthStart.substring(5, 7) === m) billsThisMonth += amt;
          }
        }
      }
    } catch (_e) {
      // ignore
    }

    const totalCash = stripePounds + worldpayCard + worldpayCash + salonCashCollected;

    return new Response(
      JSON.stringify({
        month_start: monthStart,
        month_end: monthEnd,
        stripe: {
          total: Math.round(stripePounds * 100) / 100,
          count: stripeCount,
          error: stripeError,
        },
        worldpay: {
          card: Math.round(worldpayCard * 100) / 100,
          cash: Math.round(worldpayCash * 100) / 100,
          has_data: worldpayHasData,
        },
        salon_cash_collected: Math.round(salonCashCollected * 100) / 100,
        total_cash: Math.round(totalCash * 100) / 100,
        revenue: Math.round(revenue * 100) / 100,
        difference: Math.round((totalCash - revenue) * 100) / 100,
        bills_due_this_month: Math.round(billsThisMonth * 100) / 100,
        last_updated: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});