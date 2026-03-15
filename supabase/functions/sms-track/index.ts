import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const url = new URL(req.url);
    const campaignName = url.searchParams.get("c") || "";
    const phoneHash = url.searchParams.get("p") || "";
    const destination = url.searchParams.get("url") || "https://fluffandscruff.co.uk";

    // Log click
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from("sms_link_clicks").insert({
      campaign_name: campaignName,
      phone_hash: phoneHash,
      destination_url: destination,
    });

    // 302 redirect
    return new Response(null, {
      status: 302,
      headers: { Location: destination },
    });
  } catch (error) {
    console.error("Track error:", error);
    const dest = new URL(req.url).searchParams.get("url") || "https://fluffandscruff.co.uk";
    return new Response(null, { status: 302, headers: { Location: dest } });
  }
});
