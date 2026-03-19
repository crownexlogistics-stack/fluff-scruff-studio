import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logoUrl = "https://fluffandscruff.co.uk/logo-transparent.png";
const siteUrl = "https://fluffandscruff.co.uk";

const TC_POINTS = [
  "Full payment is required upfront at time of booking.",
  "All session dates must be agreed at the time of purchase.",
  "Sessions may be rescheduled with a minimum of 48 hours notice. Sessions missed without 48 hours notice may be counted as used at the salon's discretion.",
  "If you do not attend a session without notice (no-show), that session is counted as used with no refund or replacement.",
  "If you cancel your package, a refund will be issued for remaining unused sessions at the package price per session.",
  "Packages are non-transferable to another person or dog.",
  "Sessions do not expire whilst the package is active.",
  "The discounted price is locked in at the time of purchase and will not be affected by future price increases.",
  "Fluff & Scruff Studio reserves the right to decline a session if there are welfare or behavioural concerns regarding your dog.",
  "These terms are governed by English law.",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, package_booking_id, tc_signature_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load package booking with package info
    const { data: pb, error: pbErr } = await supabase
      .from("package_bookings")
      .select("*, packages(name, package_type, session_count, discount_percentage)")
      .eq("id", package_booking_id)
      .single();

    if (pbErr || !pb) {
      return new Response(JSON.stringify({ error: "Package booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (type === "invite") {
      // Generate signing token and create TC record
      const signingToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await supabase.from("package_tc_signatures").insert({
        package_booking_id,
        customer_email: pb.customer_email,
        customer_name: pb.customer_name,
        signing_token: signingToken,
        token_expires_at: expiresAt.toISOString(),
        status: "pending",
      });

      // Update email_sent_at
      await supabase.from("package_tc_signatures")
        .update({ email_sent_at: new Date().toISOString() })
        .eq("signing_token", signingToken);

      const signUrl = `${siteUrl}/sign-package-tc?token=${signingToken}`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Fluff & Scruff Studio <info@fluffandscruff.co.uk>",
          to: [pb.customer_email],
          reply_to: "info@fluffandscruff.co.uk",
          subject: "Action Required — Please Sign Your Package Agreement | Fluff & Scruff Studio",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <div style="text-align: center; padding: 16px 0;">
                <img src="${logoUrl}" alt="Fluff & Scruff Studio" style="height: 60px; width: auto;" />
              </div>
              <h2 style="color: #1a1a1a;">Your Package Agreement</h2>
              <p>Hi <strong>${pb.customer_name}</strong>,</p>
              <p>Thank you for purchasing your package deal with Fluff & Scruff Studio! Here are your package details:</p>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Package</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${pb.packages?.name || "Package Deal"}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Sessions</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${pb.sessions_total} sessions</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Total Paid</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">£${Number(pb.total_paid).toFixed(2)}</td></tr>
                <tr><td style="padding: 8px; color: #666;">Discount</td><td style="padding: 8px; font-weight: bold;">${pb.packages?.discount_percentage}% off</td></tr>
              </table>
              <p>Before we can confirm your sessions, we need you to review and sign our Package Deal Terms & Conditions.</p>
              <p style="margin: 24px 0; text-align: center;">
                <a href="${signUrl}" style="background-color: #3d4147; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                  Sign Your Agreement
                </a>
              </p>
              <p style="color: #666; font-size: 14px;">Please note: your sessions cannot be confirmed until the agreement is signed.</p>
              <p style="color: #666; font-size: 14px;">If you have any questions, please contact us at <a href="mailto:info@fluffandscruff.co.uk">info@fluffandscruff.co.uk</a> or call us at the salon.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL</p>
            </div>
          `,
        }),
      });

      return new Response(JSON.stringify({ success: true, token: signingToken }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (type === "signed_confirmation") {
      // Load the TC signature
      const { data: tcSig } = await supabase
        .from("package_tc_signatures")
        .select("*")
        .eq("id", tc_signature_id)
        .single();

      if (!tcSig) {
        return new Response(JSON.stringify({ error: "Signature not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Load sessions for listing dates
      const { data: sessions } = await supabase
        .from("package_sessions")
        .select("session_number, scheduled_date, scheduled_time, service_type")
        .eq("package_booking_id", package_booking_id)
        .order("session_number");

      const signedDate = new Date(tcSig.signed_at).toLocaleString("en-GB", {
        day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      });

      const sessionRows = (sessions || []).map((s: any) => {
        const date = s.scheduled_date ? new Date(s.scheduled_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "TBC";
        const time = s.scheduled_time ? s.scheduled_time.substring(0, 5) : "TBC";
        const svc = (s.service_type || "").replace("_", " ");
        return `<tr><td style="padding: 6px 8px; border-bottom: 1px solid #eee;">Session ${s.session_number}</td><td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${date}</td><td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${time}</td><td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-transform: capitalize;">${svc}</td></tr>`;
      }).join("");

      const tcHtml = TC_POINTS.map((p, i) => `<li style="margin-bottom: 8px;">${p}</li>`).join("");

      // Send confirmation to customer
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Fluff & Scruff Studio <info@fluffandscruff.co.uk>",
          to: [pb.customer_email],
          reply_to: "info@fluffandscruff.co.uk",
          subject: "Package Agreement Signed — Fluff & Scruff Studio",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <div style="text-align: center; padding: 16px 0;">
                <img src="${logoUrl}" alt="Fluff & Scruff Studio" style="height: 60px; width: auto;" />
              </div>
              <h2 style="color: #1a1a1a;">Agreement Signed ✓</h2>
              <p>Hi <strong>${pb.customer_name}</strong>,</p>
              <p>Thank you for signing your Package Deal Agreement. Here's a summary for your records:</p>
              <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Signed as</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${tcSig.signature_text}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Date & Time</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${signedDate}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Package</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${pb.packages?.name || "Package Deal"}</td></tr>
                <tr><td style="padding: 8px; color: #666;">Total Paid</td><td style="padding: 8px; font-weight: bold;">£${Number(pb.total_paid).toFixed(2)}</td></tr>
              </table>
              <h3 style="color: #1a1a1a; margin-top: 24px;">Your Booked Sessions</h3>
              <table style="width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 14px;">
                <tr style="background: #f9f9f9;"><th style="padding: 6px 8px; text-align: left;">Session</th><th style="padding: 6px 8px; text-align: left;">Date</th><th style="padding: 6px 8px; text-align: left;">Time</th><th style="padding: 6px 8px; text-align: left;">Service</th></tr>
                ${sessionRows}
              </table>
              <h3 style="color: #1a1a1a; margin-top: 24px;">Terms & Conditions Agreed</h3>
              <ol style="font-size: 13px; color: #555; line-height: 1.6;">${tcHtml}</ol>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="color: #666; font-size: 14px;">If you have any questions about your package, please contact us at <a href="mailto:info@fluffandscruff.co.uk">info@fluffandscruff.co.uk</a>.</p>
              <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL</p>
            </div>
          `,
        }),
      });

      // Send notification to salon
      const profileUrl = `${siteUrl}/admin/customers/${encodeURIComponent(pb.customer_email)}`;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Fluff & Scruff Studio <info@fluffandscruff.co.uk>",
          to: ["info@fluffandscruff.co.uk"],
          reply_to: "info@fluffandscruff.co.uk",
          subject: `✅ Package T&C Signed — ${pb.customer_name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <div style="text-align: center; padding: 16px 0;">
                <img src="${logoUrl}" alt="Fluff & Scruff Studio" style="height: 60px; width: auto;" />
              </div>
              <h2 style="color: #1a1a1a;">Package T&C Signed ✓</h2>
              <ul style="line-height: 2;">
                <li><strong>Customer:</strong> ${pb.customer_name} (${pb.customer_email})</li>
                <li><strong>Package:</strong> ${pb.packages?.name || "Package Deal"}</li>
                <li><strong>Signed on:</strong> ${signedDate}</li>
                <li><strong>IP Address:</strong> ${tcSig.ip_address || "Unknown"}</li>
              </ul>
              <p style="margin: 24px 0;">
                <a href="${profileUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View Customer Profile
                </a>
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL</p>
            </div>
          `,
        }),
      });

      // Log to audit
      await supabase.from("booking_audit_log").insert({
        booking_id: package_booking_id,
        event_type: "package_tc_signed",
        note: `Package T&C signed by ${pb.customer_name} (${pb.customer_email})`,
        performed_by: pb.customer_name,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (type === "resend_invite") {
      // Delete old pending tokens and create new one
      await supabase
        .from("package_tc_signatures")
        .delete()
        .eq("package_booking_id", package_booking_id)
        .eq("status", "pending");

      // Re-invoke with invite type
      const response = await fetch(`${supabaseUrl}/functions/v1/send-package-tc-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ type: "invite", package_booking_id }),
      });

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid type" }), {
      status: 400,
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
