import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get active automation rules
    const { data: rules, error: rulesErr } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("is_active", true);
    if (rulesErr) throw rulesErr;
    if (!rules?.length) {
      return new Response(JSON.stringify({ message: "No active automations", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all bookings for analysis
    const { data: bookings } = await supabase
      .from("bookings")
      .select("customer_email, customer_name, status, booking_date, created_at")
      .not("customer_email", "is", null)
      .order("booking_date", { ascending: false });

    // Get unsubscribes
    const { data: unsubs } = await supabase.from("email_unsubscribes").select("email");
    const unsubSet = new Set((unsubs || []).map((u: any) => u.email.toLowerCase()));

    // Get already-sent automation emails
    const { data: existingSends } = await supabase.from("automation_sends").select("rule_id, customer_email");
    const sentSet = new Set((existingSends || []).map((s: any) => `${s.rule_id}::${s.customer_email.toLowerCase()}`));

    // Build customer map
    const customerMap = new Map<string, { email: string; name: string; completedCount: number; lastBooking: string; firstBooking: string; openedCampaign: boolean }>();
    for (const b of (bookings || [])) {
      if (!b.customer_email) continue;
      const key = b.customer_email.toLowerCase().trim();
      if (unsubSet.has(key)) continue;
      const existing = customerMap.get(key);
      const isCompleted = b.status === "Completed";
      if (existing) {
        if (isCompleted) existing.completedCount++;
        if (b.booking_date > existing.lastBooking) existing.lastBooking = b.booking_date;
        if (b.booking_date < existing.firstBooking) existing.firstBooking = b.booking_date;
      } else {
        customerMap.set(key, {
          email: b.customer_email,
          name: b.customer_name,
          completedCount: isCompleted ? 1 : 0,
          lastBooking: b.booking_date,
          firstBooking: b.booking_date,
          openedCampaign: false,
        });
      }
    }

    // Check email events for re-engagement (opened but didn't book)
    const { data: emailEvents } = await supabase
      .from("email_events")
      .select("email, event_type")
      .eq("event_type", "open");
    const openedEmails = new Set((emailEvents || []).map((e: any) => e.email.toLowerCase()));

    for (const [key, cust] of customerMap) {
      if (openedEmails.has(key)) cust.openedCampaign = true;
    }

    const now = new Date();
    const unsubscribeBaseUrl = `${supabaseUrl}/functions/v1/handle-unsubscribe`;
    let totalSent = 0;

    for (const rule of rules) {
      const config = rule.trigger_config as any;
      let targetCustomers: typeof customerMap extends Map<string, infer V> ? V[] : never[] = [];

      switch (rule.trigger_type) {
        case "win_back": {
          const days = config.days_inactive || 60;
          const cutoff = new Date(now);
          cutoff.setDate(cutoff.getDate() - days);
          const cutoffStr = cutoff.toISOString().slice(0, 10);
          targetCustomers = Array.from(customerMap.values()).filter(
            c => c.completedCount >= 1 && c.lastBooking < cutoffStr
          );
          break;
        }
        case "welcome_series": {
          const daysAfter = config.days_after_first || 3;
          const cutoff = new Date(now);
          cutoff.setDate(cutoff.getDate() - daysAfter);
          const cutoffStr = cutoff.toISOString().slice(0, 10);
          targetCustomers = Array.from(customerMap.values()).filter(
            c => c.completedCount === 1 && c.firstBooking <= cutoffStr
          );
          break;
        }
        case "re_engagement": {
          const days = config.days_since_open || 14;
          const cutoff = new Date(now);
          cutoff.setDate(cutoff.getDate() - days);
          const cutoffStr = cutoff.toISOString().slice(0, 10);
          targetCustomers = Array.from(customerMap.values()).filter(
            c => c.openedCampaign && c.lastBooking < cutoffStr
          );
          break;
        }
      }

      // Filter already sent
      const newTargets = targetCustomers.filter(
        c => !sentSet.has(`${rule.id}::${c.email.toLowerCase()}`)
      );

      // Send emails
      for (const customer of newTargets) {
        const unsubUrl = `${unsubscribeBaseUrl}?email=${encodeURIComponent(customer.email)}`;
        const personalizedHtml = rule.email_html
          .replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubUrl)
          .replace(/\{\{CUSTOMER_NAME\}\}/g, customer.name || "there");

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Fluff & Scruff Studio <info@fluffandscruff.co.uk>",
            to: [customer.email],
            reply_to: "info@fluffandscruff.co.uk",
            subject: rule.email_subject.replace(/\{\{CUSTOMER_NAME\}\}/g, customer.name || "there"),
            html: personalizedHtml,
          }),
        });

        if (res.ok) {
          totalSent++;
          // Record send to prevent duplicates
          await supabase.from("automation_sends").insert({
            rule_id: rule.id,
            customer_email: customer.email.toLowerCase(),
          });
        } else {
          console.error(`Automation send failed for ${customer.email}:`, await res.text());
        }
      }
    }

    return new Response(JSON.stringify({ success: true, sent: totalSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
