import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { staff_id, title, description, priority, product_link } = await req.json();
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    // Get groomer name
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const staffRes = await fetch(`${supabaseUrl}/rest/v1/staff?id=eq.${staff_id}&select=name`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const staffData = await staffRes.json();
    const groomerName = staffData?.[0]?.name || "Unknown Groomer";

    const priorityLabel = priority === "urgent" ? "🔴 URGENT" : "Normal";
    const priorityHtml = priority === "urgent"
      ? '<span style="color:red;font-weight:bold;">🔴 URGENT</span>'
      : "Normal";

    const htmlBody = `
      <h2>New Purchase Request</h2>
      <p><strong>Groomer:</strong> ${groomerName}</p>
      <p><strong>Item:</strong> ${title}</p>
      ${description ? `<p><strong>Description:</strong> ${description}</p>` : ""}
      <p><strong>Priority:</strong> ${priorityHtml}</p>
      ${product_link ? `<p><strong>Product Link:</strong> <a href="${product_link}">${product_link}</a></p>` : ""}
      <br/>
      <p><a href="https://fluff-scruff-studio.lovable.app/purchase-orders" style="background:#7c3aed;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">View in Admin Panel</a></p>
    `;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: "Fluff & Scruff Studio <info@fluffandscruff.co.uk>",
        to: ["info@fluffandscruff.co.uk"],
        subject: `🛒 New Purchase Request — ${priorityLabel} — ${title} from ${groomerName}`,
        html: htmlBody,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("Resend error:", errText);
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
