import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sendEmail(apiKey: string, to: string[], subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: "Fluff & Scruff Studio <onboarding@resend.dev>",
      to,
      reply_to: "info@fluffandscruff.co.uk",
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errData = await res.text();
    throw new Error(`Resend error: ${errData}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: authErr } = await supabaseAuth.auth.getClaims(token);
    if (authErr || !claimsData?.claims) throw new Error("Not authenticated");
    const caller = { id: claimsData.claims.sub as string };

    const { migrated_customer_id } = await req.json();
    if (!migrated_customer_id) {
      return new Response(JSON.stringify({ error: "migrated_customer_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up migrated customer
    const { data: customer, error: custErr } = await supabase
      .from("migrated_customers")
      .select("*")
      .eq("id", migrated_customer_id)
      .single();

    if (custErr || !customer) {
      return new Response(JSON.stringify({ error: "Customer not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate email exists and is properly formatted
    const email = (customer.email || "").trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: `Customer "${customer.full_name || "unknown"}" has no valid email address on file. Cannot send invite.` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstName = (customer.full_name || "").split(" ")[0] || "there";
    const redirectUrl = "https://fluffandscruff.co.uk/welcome";

    // Create user without sending Supabase's default invite email
    const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: false,
      user_metadata: {
        migrated: true,
        full_name: customer.full_name || "",
        migrated_customer_id: customer.id,
      },
    });

    if (createErr) {
      if (!createErr.message?.includes("already been registered") && !createErr.message?.includes("already exists")) {
        throw createErr;
      }
    }

    // Generate a password recovery link to use as the "set up account" link
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: redirectUrl },
    });

    const ctaUrl = linkData?.properties?.action_link || redirectUrl;

    // Now send the branded email via Resend
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Fluff &amp; Scruff</title>
</head>
<body style="margin:0;padding:0;background-color:#FFFAF4;font-family:'Nunito',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFFAF4;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td align="center" style="padding:32px 40px 16px;">
              <img src="https://fluffandscruff.co.uk/logo-transparent.png" alt="Fluff & Scruff" width="80" style="width:80px;height:auto;" />
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:8px 40px 32px;">
              <h1 style="font-family:'Fredoka One','Nunito',Arial,sans-serif;font-size:24px;color:#1a1a1a;margin:0 0 16px;text-align:center;">
                Fluff &amp; Scruff has a brand new home online 🐾
              </h1>
              
              <p style="font-size:16px;color:#333;line-height:1.6;margin:0 0 16px;">
                Hi ${firstName},
              </p>
              
              <p style="font-size:16px;color:#333;line-height:1.6;margin:0 0 16px;">
                We've been busy behind the scenes building something special for you and your pup!
              </p>
              
              <p style="font-size:16px;color:#333;line-height:1.6;margin:0 0 16px;">
                Fluff &amp; Scruff Studio now has its very own website — and your full appointment history is already loaded in and waiting for you.
              </p>
              
              <p style="font-size:16px;color:#333;line-height:1.6;margin:0 0 24px;">
                Click below to set your password and take a look:
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="background-color:#F97316;border-radius:30px;">
                          <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:14px 40px;font-family:'Fredoka One','Nunito',Arial,sans-serif;font-size:16px;color:#ffffff;text-decoration:none;font-weight:bold;">
                            Set Up My Account 🐾
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 8px;">
                Once you're in you'll be able to:
              </p>
              
              <table cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
                <tr><td style="padding:4px 0;font-size:15px;color:#333;">✅ See all your past appointments</td></tr>
                <tr><td style="padding:4px 0;font-size:15px;color:#333;">📅 Book your next appointment in seconds</td></tr>
                <tr><td style="padding:4px 0;font-size:15px;color:#333;">🔄 Reschedule or cancel appointments yourself</td></tr>
                <tr><td style="padding:4px 0;font-size:15px;color:#333;">📸 View your pup's grooming photos</td></tr>
                <tr><td style="padding:4px 0;font-size:15px;color:#333;">💡 Get daily breed care tips</td></tr>
              </table>
              
              <p style="font-size:16px;color:#333;line-height:1.6;margin:16px 0 8px;">
                We can't wait to see you and your pup soon!
              </p>
              
              <p style="font-size:16px;color:#333;line-height:1.6;margin:0 0 4px;">
                With love,
              </p>
              <p style="font-size:16px;color:#333;line-height:1.6;margin:0;font-weight:bold;">
                The Fluff &amp; Scruff Team 🐾
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 40px 24px;border-top:1px solid #f0ebe4;">
              <p style="font-size:12px;color:#999;text-align:center;margin:0;">
                138 Hillview Avenue, Hornchurch RM11 2DL
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await sendEmail(
      resendKey,
      [email],
      "Fluff & Scruff has a brand new home online 🐾",
      emailHtml
    );

    // Update status
    await supabase
      .from("migrated_customers")
      .update({ status: "invited", invited_at: new Date().toISOString() })
      .eq("id", customer.id);

    // Audit log
    await supabase.from("audit_logs").insert({
      user_id: caller.id,
      action: "migration_invite_sent",
      details: `Sent migration invite to ${email} (${customer.full_name || "unknown"})`,
    });

    return new Response(JSON.stringify({ success: true, email: customer.email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
