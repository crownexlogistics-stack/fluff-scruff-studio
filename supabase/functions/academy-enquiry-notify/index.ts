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
    const { first_name, last_name, email, phone, programme_interest, message, referral_source } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not set");
      return new Response(JSON.stringify({ error: "Email not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toLocaleString("en-GB", { timeZone: "Europe/London" });

    // Send notification to studio
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Fluff & Scruff Studio <info@fluffandscruff.co.uk>",
        to: ["info@fluffandscruff.co.uk"],
        subject: `🎓 New Academy Enquiry — ${first_name} ${last_name}`,
        html: `
          <h2>New Academy Enquiry</h2>
          <p><strong>Name:</strong> ${first_name} ${last_name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Programme:</strong> ${programme_interest || "Not specified"}</p>
          <p><strong>Referral Source:</strong> ${referral_source || "Not specified"}</p>
          <p><strong>Message:</strong> ${message || "None"}</p>
          <p><strong>Submitted:</strong> ${now}</p>
        `,
      }),
    });

    // Send confirmation to enquirer
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Fluff & Scruff Studio <info@fluffandscruff.co.uk>",
        to: [email],
        subject: "Thanks for your interest — Fluff & Scruff Academy 🐾",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #3D2314;">Hi ${first_name},</h2>
            <p>Thank you for your interest in the Fluff & Scruff Academy! We have received your registration and will be in touch within 2 working days to discuss next steps.</p>
            <p>If you have any questions in the meantime, please don't hesitate to WhatsApp us on <strong>+44 7476 452782</strong> or call <strong>01708 606655</strong>.</p>
            <p>We look forward to speaking with you!</p>
            <p>Warm regards,<br/><strong>Sevak</strong><br/>Fluff & Scruff Studio</p>
          </div>
        `,
      }),
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("academy-enquiry-notify error:", err);
    return new Response(JSON.stringify({ error: "Failed to send emails" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
