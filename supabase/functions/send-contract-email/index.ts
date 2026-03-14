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
      from: "Fluff & Scruff Studio <info@fluffandscruff.co.uk>",
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
    const logoUrl = "https://fluffandscruff.co.uk/logo-transparent.png";

    const emailHeader = `
      <div style="text-align: center; padding: 16px 0;">
        <img src="${logoUrl}" alt="Fluff & Scruff Studio" style="height: 60px; width: auto;" />
      </div>
    `;

    if (type === "send_for_signature") {
      if (!staff.email) {
        return new Response(
          JSON.stringify({ error: "Staff member has no email address. Please add one first." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await sendEmail(RESEND_API_KEY, [staff.email], "Your Documents from Fluff & Scruff Studio", `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          ${emailHeader}
          <p>Hi ${staff.name},</p>
          <p>Please click the link below to review and sign your self-employed agreement and Health & Safety Policy:</p>
          <p style="margin: 24px 0;">
            <a href="${signing_url}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Review & Sign Documents
            </a>
          </p>
          <p style="color: #666;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="color: #2563eb; word-break: break-all;">${signing_url}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL · 01708 606655</p>
        </div>
      `);

      await supabase.from("staff").update({ contract_status: "sent", hs_status: "sent" }).eq("id", staff_id);

      return new Response(JSON.stringify({ success: true, message: "Contract sent for signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (type === "signed_confirmation") {
      const emails = [adminEmail];
      if (staff.email) emails.push(staff.email);

      const signedDate = staff.signed_at
        ? new Date(staff.signed_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
        : "Unknown";

      const contractUrl = signing_url || `https://fluffandscruff.co.uk/contract/sign/${staff_id}`;

      await sendEmail(RESEND_API_KEY, emails, `Contract Signed — ${staff.name}`, `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          ${emailHeader}
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
          <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL · 01708 606655</p>
        </div>
      `);

      return new Response(JSON.stringify({ success: true, message: "Confirmation emails sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (type === "send_hs_for_signature") {
      if (!staff.email) {
        return new Response(
          JSON.stringify({ error: "Staff member has no email address." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await sendEmail(RESEND_API_KEY, [staff.email], "Health & Safety Policy — Fluff & Scruff Studio", `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          ${emailHeader}
          <p>Hi ${staff.name},</p>
          <p>Please click the link below to review and sign the Health & Safety Policy:</p>
          <p style="margin: 24px 0;">
            <a href="${signing_url}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Review & Sign Health & Safety Policy
            </a>
          </p>
          <p style="color: #666;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="color: #2563eb; word-break: break-all;">${signing_url}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL · 01708 606655</p>
        </div>
      `);

      return new Response(JSON.stringify({ success: true, message: "H&S policy sent for signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (type === "resend_account_email") {
      if (!staff.email || !staff.auth_user_id) {
        return new Response(
          JSON.stringify({ error: "No account exists for this staff member yet." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "recovery",
        email: staff.email,
        options: { redirectTo: "https://fluffandscruff.co.uk/reset-password" },
      });
      if (linkError) throw linkError;

      const roleMap: Record<string, string> = { groomer: "groomer", manager: "manager", director: "director" };
      const appRole = roleMap[staff.role?.toLowerCase()] || "groomer";
      const portalName = appRole === "manager" || appRole === "director" ? "Management Dashboard" : "Staff Portal";

      await sendEmail(RESEND_API_KEY, [staff.email], `Set Up Your ${portalName} Account — Fluff & Scruff Studio`, `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          ${emailHeader}
          <h2 style="color: #1a1a1a;">Welcome to the Team! 🎉</h2>
          <p>Hi <strong>${staff.name}</strong>,</p>
          <p>Your <strong>${portalName}</strong> account is ready! Click the button below to set your password:</p>
          <p style="margin: 24px 0; text-align: center;">
            <a href="${linkData.properties.action_link}" style="background-color: #3d4147; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
              Set Your Password
            </a>
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL · 01708 606655</p>
        </div>
      `);

      return new Response(JSON.stringify({ success: true, message: "Account setup email re-sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (type === "force_password_reset") {
      if (!staff.email || !staff.auth_user_id) {
        return new Response(
          JSON.stringify({ error: "No account exists for this staff member yet." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "recovery",
        email: staff.email,
        options: { redirectTo: "https://fluffandscruff.co.uk/reset-password" },
      });
      if (linkError) throw linkError;

      await sendEmail(RESEND_API_KEY, [staff.email], "Password Reset — Fluff & Scruff Studio", `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          ${emailHeader}
          <h2 style="color: #1a1a1a;">Password Reset</h2>
          <p>Hi <strong>${staff.name}</strong>,</p>
          <p>Your manager has requested a password reset for your account. Click the button below to set a new password:</p>
          <p style="margin: 24px 0; text-align: center;">
            <a href="${linkData.properties.action_link}" style="background-color: #3d4147; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
              Reset Password
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">If you didn't expect this, please contact the salon.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL · 01708 606655</p>
        </div>
      `);

      return new Response(JSON.stringify({ success: true, message: "Password reset email sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid type." }), {
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
