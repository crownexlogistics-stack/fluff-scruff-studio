import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { staff_id, document_type, signature_data, ip_address } = await req.json();

    if (!staff_id || !document_type || !signature_data) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date().toISOString();

    if (document_type === "contract") {
      const { error } = await supabase.from("staff").update({
        contract_status: "signed",
        signed_at: now,
        signed_ip: ip_address || "unknown",
        contract_signature_data: signature_data,
      }).eq("id", staff_id);

      if (error) throw error;

      // Send confirmation email
      try {
        const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
        if (SENDGRID_API_KEY) {
          const { data: staff } = await supabase.from("staff").select("*").eq("id", staff_id).single();
          if (staff?.email) {
            const logoUrl = "https://fluff-scruff-studio.lovable.app/logo-transparent.png";
            const contractUrl = `https://fluff-scruff-studio.lovable.app/contract/sign/${staff_id}`;
            const signedDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
            
            const emails = ["info@fluffandscruff.co.uk"];
            if (staff.email) emails.push(staff.email);

            await fetch("https://api.sendgrid.com/v3/mail/send", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SENDGRID_API_KEY}`,
              },
              body: JSON.stringify({
                personalizations: [{ to: emails.map(email => ({ email })) }],
                from: { email: "info@fluffandscruff.co.uk", name: "Fluff & Scruff Studio" },
                subject: `Contract Signed — ${staff.name}`,
                content: [{ type: "text/html", value: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                    <div style="text-align: center; padding: 16px 0;">
                      <img src="${logoUrl}" alt="Fluff & Scruff Studio" style="height: 60px; width: auto;" />
                    </div>
                    <h2 style="color: #1a1a1a;">Contract Signed ✓</h2>
                    <p>The self-employed groomer contract for <strong>${staff.name}</strong> has been signed.</p>
                    <ul style="line-height: 2;">
                      <li><strong>Signed on:</strong> ${signedDate}</li>
                      <li><strong>IP Address:</strong> ${ip_address || "Unknown"}</li>
                    </ul>
                    <p style="margin: 24px 0;">
                      <a href="${contractUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                        View Signed Contract
                      </a>
                    </p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                    <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL</p>
                  </div>
                ` }],
              }),
            });
          }
        }
      } catch { /* non-blocking */ }

    } else if (document_type === "health_and_safety") {
      const { error } = await supabase.from("staff").update({
        hs_status: "signed",
        hs_signed_at: now,
        hs_signed_ip: ip_address || "unknown",
        hs_signature_data: signature_data,
      }).eq("id", staff_id);

      if (error) throw error;
    } else {
      return new Response(JSON.stringify({ error: "Invalid document_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
