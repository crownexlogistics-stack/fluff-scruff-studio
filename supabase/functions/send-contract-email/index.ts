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
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { staff_id, type, signing_url } = await req.json();

    if (!staff_id) {
      return new Response(JSON.stringify({ error: "staff_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch staff details
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("*")
      .eq("id", staff_id)
      .single();

    if (staffError || !staff) {
      throw new Error("Staff member not found");
    }

    const adminEmail = "info@fluffandscruff.co.uk";
    // Temporary: using onboarding@resend.dev until domain is verified
    const fromEmail = "Fluff & Scruff Studio <onboarding@resend.dev>";
    const replyTo = "info@fluffandscruff.co.uk";

    if (type === "send_for_signature") {
      // Send contract signing invitation to the groomer
      if (!staff.email) {
        return new Response(
          JSON.stringify({ error: "Staff member has no email address. Please add one first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          reply_to: replyTo,
          to: [staff.email],
          subject: "Your Groomer Contract from Fluff & Scruff Studio",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #1a1a1a;">Fluff & Scruff Studio</h2>
              <p>Hi ${staff.name},</p>
              <p>Please click the link below to review and sign your self-employed agreement:</p>
              <p style="margin: 24px 0;">
                <a href="${signing_url}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Review & Sign Contract
                </a>
              </p>
              <p style="color: #666;">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="color: #2563eb; word-break: break-all;">${signing_url}</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL</p>
            </div>
          `,
        }),
      });

      if (!res.ok) {
        const errData = await res.text();
        throw new Error(`Failed to send email: ${errData}`);
      }

      // Update contract status to sent
      await supabase.from("staff").update({ contract_status: "sent" }).eq("id", staff_id);

      return new Response(JSON.stringify({ success: true, message: "Contract sent for signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (type === "signed_confirmation") {
      // Send confirmation to both groomer and admin
      const emails = [adminEmail];
      if (staff.email) emails.push(staff.email);

      const signedDate = staff.signed_at
        ? new Date(staff.signed_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        : "Unknown";

      const contractUrl = signing_url || `${supabaseUrl.replace('.supabase.co', '')}/contract/sign/${staff_id}`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          reply_to: replyTo,
          to: emails,
          subject: `Contract Signed — ${staff.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #1a1a1a;">Contract Signed ✓</h2>
              <p>The self-employed groomer contract for <strong>${staff.name}</strong> has been signed.</p>
              <ul style="line-height: 2;">
                <li><strong>Signed on:</strong> ${signedDate}</li>
                <li><strong>IP Address:</strong> ${staff.signed_ip || "Unknown"}</li>
              </ul>
              <p style="margin: 24px 0;">
                <a href="${contractUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View Signed Contract
                </a>
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL</p>
            </div>
          `,
        }),
      });

      if (!res.ok) {
        const errData = await res.text();
        throw new Error(`Failed to send confirmation email: ${errData}`);
      }

      return new Response(JSON.stringify({ success: true, message: "Confirmation emails sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid type. Use 'send_for_signature' or 'signed_confirmation'." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
