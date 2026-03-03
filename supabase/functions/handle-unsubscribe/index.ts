import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const url = new URL(req.url);
  const email = url.searchParams.get("email");

  if (!email) {
    return new Response("<h1>Invalid unsubscribe link</h1>", {
      status: 400, headers: { "Content-Type": "text/html" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from("email_unsubscribes").upsert(
      { email: email.toLowerCase() },
      { onConflict: "email" }
    );

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title></head>
<body style="font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9f5f0;">
<div style="text-align:center;padding:40px;max-width:400px;">
  <div style="font-size:48px;margin-bottom:16px;">🐾</div>
  <h1 style="color:#2D3142;margin-bottom:8px;">You've been unsubscribed</h1>
  <p style="color:#666;line-height:1.6;">You will no longer receive marketing emails from Fluff & Scruff Studio.</p>
  <p style="color:#999;font-size:13px;margin-top:24px;">If this was a mistake, contact us at info@fluffandscruff.co.uk</p>
</div>
</body>
</html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return new Response("<h1>Something went wrong. Please try again.</h1>", {
      status: 500, headers: { "Content-Type": "text/html" },
    });
  }
});
