import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function fmt(n: number | null | undefined): string {
  if (n == null) return "£0.00";
  return `£${Number(n).toFixed(2)}`;
}

function formatDate(d: Date): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Determine yesterday's date
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split("T")[0];

    // Allow manual override of date
    let body: any = {};
    try { body = await req.json(); } catch { /* no body is fine for cron */ }

    const targetDate = body?.date || yStr;
    const displayDate = new Date(targetDate + "T00:00:00Z");
    const dateLabel = formatDate(displayDate);

    // ── STAT 1: New bookings made that day ──
    const { data: newBookingsData } = await supabase
      .from("bookings")
      .select("total_price")
      .gte("created_at", `${targetDate}T00:00:00`)
      .lt("created_at", `${targetDate}T23:59:59.999`)
      .neq("status", "Cancelled");

    const newBookingsCount = newBookingsData?.length || 0;
    const newBookingsValue = newBookingsData?.reduce((sum, b) => sum + Number(b.total_price || 0), 0) || 0;

    // ── STAT 2: Cancellations that day ──
    const { data: cancelledData } = await supabase
      .from("bookings")
      .select("id")
      .eq("status", "Cancelled")
      .gte("created_at", `${targetDate}T00:00:00`)
      .lt("created_at", `${targetDate}T23:59:59.999`);

    const cancellationsCount = cancelledData?.length || 0;

    // ── STAT 3: Completed appointments that day ──
    const { data: completedData } = await supabase
      .from("bookings")
      .select("id, total_price, staff_id, final_charge")
      .eq("booking_date", targetDate)
      .eq("status", "Completed");

    const completedCount = completedData?.length || 0;
    const grossRevenue = completedData?.reduce((sum, b) => sum + Number(b.final_charge ?? b.total_price ?? 0), 0) || 0;

    // ── STAT 4: Groomer pay for that day ──
    const { data: commissionData } = await supabase
      .from("commission_records")
      .select("groomer_pay, staff_id, booking_id, studio_share")
      .gte("created_at", `${targetDate}T00:00:00`)
      .lt("created_at", `${targetDate}T23:59:59.999`);

    const totalGroomerPay = commissionData?.reduce((sum, c) => sum + Number(c.groomer_pay || 0), 0) || 0;

    // ── STAT 5: Salon net ──
    const salonNet = grossRevenue - totalGroomerPay;

    // ── STAT 6: Groomer breakdown ──
    const staffIds = [...new Set(completedData?.map((b) => b.staff_id).filter(Boolean) || [])];
    const { data: staffData } = await supabase
      .from("staff")
      .select("id, name")
      .in("id", staffIds.length ? staffIds : ["00000000-0000-0000-0000-000000000000"]);

    const staffMap: Record<string, string> = {};
    staffData?.forEach((s) => { staffMap[s.id] = s.name; });

    const commissionByBooking: Record<string, number> = {};
    commissionData?.forEach((c) => {
      commissionByBooking[c.booking_id] = Number(c.groomer_pay || 0);
    });

    const groomerStats: Record<string, { appointments: number; revenue: number; pay: number | null }> = {};
    completedData?.forEach((b) => {
      const name = staffMap[b.staff_id] || "Unassigned";
      if (!groomerStats[name]) {
        groomerStats[name] = { appointments: 0, revenue: 0, pay: null };
      }
      groomerStats[name].appointments += 1;
      groomerStats[name].revenue += Number(b.final_charge ?? b.total_price ?? 0);
      const cPay = commissionByBooking[b.id];
      if (cPay !== undefined) {
        groomerStats[name].pay = (groomerStats[name].pay ?? 0) + cPay;
      }
    });

    // ── BUILD EMAIL HTML ──
    const hasAppointments = completedCount > 0;

    const groomerRows = Object.entries(groomerStats)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([name, s]) =>
          `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f0e6d3;font-size:14px;color:#4a3728;">${name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0e6d3;font-size:14px;color:#4a3728;text-align:center;">${s.appointments}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0e6d3;font-size:14px;color:#4a3728;text-align:right;">${fmt(s.revenue)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0e6d3;font-size:14px;color:#4a3728;text-align:right;">${s.pay !== null ? fmt(s.pay) : "Pay TBC"}</td>
          </tr>`
      )
      .join("");

    const newBookingsSection = newBookingsCount > 0
      ? `<p style="margin:0 0 4px;font-size:14px;color:#4a3728;"><strong>${newBookingsCount}</strong> new appointments booked</p>
         <p style="margin:0;font-size:14px;color:#4a3728;">Value: <strong>${fmt(newBookingsValue)}</strong></p>`
      : `<p style="margin:0;font-size:14px;color:#888;">No new bookings today</p>`;

    const cancellationsSection = cancellationsCount > 0
      ? `<p style="margin:0;font-size:14px;color:#4a3728;"><strong>${cancellationsCount}</strong> appointment${cancellationsCount !== 1 ? "s" : ""} cancelled</p>`
      : `<p style="margin:0;font-size:14px;color:#2d8a4e;">No cancellations ✅</p>`;

    const appointmentsSection = hasAppointments
      ? `<div style="margin-bottom:8px;">
            <p style="margin:0 0 4px;font-size:14px;color:#4a3728;">Appointments completed: <strong>${completedCount}</strong></p>
            <p style="margin:0 0 4px;font-size:14px;color:#4a3728;">Gross revenue: <strong>${fmt(grossRevenue)}</strong></p>
            <p style="margin:0;font-size:14px;color:#4a3728;">Groomer pay: <strong>${fmt(totalGroomerPay)}</strong></p>
          </div>
          <div style="background:#fdf6ee;border:2px solid #e8b44a;border-radius:8px;padding:16px;text-align:center;margin:16px 0;">
            <p style="margin:0;font-size:12px;color:#b8860b;text-transform:uppercase;letter-spacing:1px;">💰 Salon Made Today</p>
            <p style="margin:4px 0 0;font-size:28px;font-weight:bold;color:#4a3728;">${fmt(salonNet)}</p>
          </div>`
      : `<p style="margin:0;font-size:14px;color:#888;">No appointments today — enjoy your day off! 🐾</p>`;

    const groomerSection = hasAppointments && Object.keys(groomerStats).length > 0
      ? `<div style="margin-top:24px;">
            <h3 style="margin:0 0 12px;font-size:16px;color:#4a3728;">Groomer Breakdown</h3>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#fdf6ee;">
                  <th style="padding:8px 12px;text-align:left;font-size:12px;color:#b8860b;text-transform:uppercase;letter-spacing:0.5px;">Groomer</th>
                  <th style="padding:8px 12px;text-align:center;font-size:12px;color:#b8860b;text-transform:uppercase;letter-spacing:0.5px;">Appts</th>
                  <th style="padding:8px 12px;text-align:right;font-size:12px;color:#b8860b;text-transform:uppercase;letter-spacing:0.5px;">Revenue</th>
                  <th style="padding:8px 12px;text-align:right;font-size:12px;color:#b8860b;text-transform:uppercase;letter-spacing:0.5px;">Pay</th>
                </tr>
              </thead>
              <tbody>${groomerRows}</tbody>
            </table>
          </div>`
      : "";

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background-color:#f8f4ee;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f4ee;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#e8b44a,#d4943a);border-radius:12px 12px 0 0;padding:32px;text-align:center;">
              <h1 style="margin:0 0 8px;font-size:24px;color:#ffffff;">🐾 Fluff & Scruff</h1>
              <p style="margin:0;font-size:14px;color:#fff8e7;">Daily Summary</p>
              <p style="margin:8px 0 0;font-size:16px;color:#ffffff;font-weight:bold;">${dateLabel}</p>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px;border-radius:0 0 12px 12px;">
              
              <!-- New Bookings -->
              <div style="margin-bottom:24px;">
                <h3 style="margin:0 0 8px;font-size:14px;color:#b8860b;text-transform:uppercase;letter-spacing:1px;">📅 Bookings Made Today</h3>
                ${newBookingsSection}
              </div>

              <hr style="border:none;border-top:1px solid #f0e6d3;margin:0 0 24px;" />

              <!-- Cancellations -->
              <div style="margin-bottom:24px;">
                <h3 style="margin:0 0 8px;font-size:14px;color:#b8860b;text-transform:uppercase;letter-spacing:1px;">❌ Cancellations Today</h3>
                ${cancellationsSection}
              </div>

              <hr style="border:none;border-top:1px solid #f0e6d3;margin:0 0 24px;" />

              <!-- Appointments -->
              <div style="margin-bottom:8px;">
                <h3 style="margin:0 0 8px;font-size:14px;color:#b8860b;text-transform:uppercase;letter-spacing:1px;">✂️ Appointments Today</h3>
                ${appointmentsSection}
              </div>

              ${groomerSection}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px;text-align:center;">
              <p style="margin:0;font-size:14px;color:#b8860b;">Have a great evening! 🐾</p>
              <p style="margin:4px 0 0;font-size:12px;color:#999;">Fluff & Scruff Studio</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // ── SEND VIA RESEND ──
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Fluff & Scruff Studio <onboarding@resend.dev>",
        to: ["info@fluffandscruff.co.uk"],
        reply_to: "info@fluffandscruff.co.uk",
        subject: `🐾 Fluff & Scruff — Daily Summary ${dateLabel}`,
        html: htmlBody,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      throw new Error(`Resend error ${emailRes.status}: ${errText}`);
    }

    return new Response(
      JSON.stringify({ success: true, date: targetDate, stats: { newBookingsCount, cancellationsCount, completedCount, grossRevenue, totalGroomerPay, salonNet } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Daily summary error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
