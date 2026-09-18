import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function normalisePhone(phone?: string | null): string | null {
  if (!phone) return null;
  let p = String(phone).replace(/[^0-9+]/g, "");
  if (!p) return null;
  if (p.startsWith("+440")) p = "+44" + p.slice(4);
  if (p.startsWith("0044")) p = "+44" + p.slice(4);
  if (/^44/.test(p)) p = "+" + p;
  if (p.startsWith("0")) p = "+44" + p.slice(1);
  if (/^7[0-9]{9}$/.test(p)) p = "+44" + p;
  return p;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
    const phoneRaw = typeof body?.phone === "string" ? body.phone : null;
    const name = typeof body?.name === "string" ? body.name.slice(0, 200) : null;
    const channel = ["online", "phone", "staff"].includes(body?.channel) ? body.channel : "online";
    const logAttempt = body?.log !== false;

    if (!email && !phoneRaw) return json({ blocked: false });

    const phone = normalisePhone(phoneRaw);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const filters: string[] = [];
    if (email) filters.push(`email.ilike.${email}`);
    if (phone) filters.push(`phone_normalised.eq.${phone}`);

    const { data, error } = await supabase
      .from("customer_blacklist")
      .select("id, email, phone_normalised, reason")
      .eq("status", "active")
      .or(filters.join(","))
      .limit(1);

    if (error) {
      console.error("[check-blacklist] lookup failed:", error.message);
      // Fail open so a database hiccup never blocks genuine customers.
      return json({ blocked: false });
    }

    const hit = data?.[0];
    if (!hit) return json({ blocked: false });

    const matchedOn = email && hit.email && hit.email.toLowerCase() === email ? "email" : "phone";

    if (logAttempt) {
      await supabase.from("blacklist_block_events").insert({
        blacklist_id: hit.id,
        matched_on: matchedOn,
        matched_value: matchedOn === "email" ? email : phone,
        channel,
        attempted_name: name,
      });
    }

    console.log(`[check-blacklist] blocked ${matchedOn} via ${channel}`);
    return json({ blocked: true, matched_on: matchedOn, reason: hit.reason, blacklist_id: hit.id });
  } catch (e) {
    console.error("[check-blacklist] error:", e);
    return json({ blocked: false });
  }
});
