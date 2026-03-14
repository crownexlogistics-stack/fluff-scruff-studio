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
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        if (RESEND_API_KEY) {
          const { data: staff } = await supabase.from("staff").select("*").eq("id", staff_id).single();
          if (staff?.email) {
            const logoUrl = "https://fluffandscruff.co.uk/logo-transparent.png";
            const contractUrl = `https://fluffandscruff.co.uk/contract/sign/${staff_id}`;
            const signedDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
            
            const emails = ["info@fluffandscruff.co.uk"];
            if (staff.email) emails.push(staff.email);

            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
              },
              body: JSON.stringify({
                from: "Fluff & Scruff Studio <info@fluffandscruff.co.uk>",
                to: emails,
                reply_to: "info@fluffandscruff.co.uk",
                subject: `Contract Signed — ${staff.name}`,
                html: `
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
                `,
              }),
            });
          }
        }
      } catch (emailErr) { console.error("Confirmation email error:", emailErr); }

    } else if (document_type === "health_and_safety") {
      const { error } = await supabase.from("staff").update({
        hs_status: "signed",
        hs_signed_at: now,
        hs_signed_ip: ip_address || "unknown",
        hs_signature_data: signature_data,
      }).eq("id", staff_id);

      if (error) throw error;

      // After H&S is signed (both documents done), create auth account and send password setup email
      try {
        const { data: staff } = await supabase.from("staff").select("*").eq("id", staff_id).single();
        
        if (staff?.email && !staff.auth_user_id) {
          // Create auth user
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: staff.email,
            email_confirm: true,
            user_metadata: { full_name: staff.name },
          });

          if (authError) {
            console.error("Auth user creation error:", authError);
          } else if (authData.user) {
            const userId = authData.user.id;

            // Link auth user to staff record
            await supabase.from("staff").update({ auth_user_id: userId }).eq("id", staff_id);

            // Assign role based on staff role
            const roleMap: Record<string, string> = {
              groomer: "groomer",
              manager: "manager",
              director: "director",
              volunteer: "volunteer",
              work_placement: "work_placement",
            };
            const appRole = roleMap[staff.role] || "groomer";
            
            // Delete default customer role and insert correct one
            await supabase.from("user_roles").delete().eq("user_id", userId);
            await supabase.from("user_roles").insert({ user_id: userId, role: appRole });

            // Generate password reset link
            const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
              type: "recovery",
              email: staff.email,
              options: {
                redirectTo: "https://fluffandscruff.co.uk/reset-password",
              },
            });

            if (linkError) {
              console.error("Link generation error:", linkError);
            } else {
              // Send account setup email via Resend
              const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
              if (RESEND_API_KEY && linkData?.properties?.action_link) {
                const logoUrl = "https://fluff-scruff-studio.lovable.app/logo-transparent.png";
                const portalName = appRole === "manager" || appRole === "director" ? "Management Dashboard" : "Staff Portal";

                await fetch("https://api.resend.com/emails", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${RESEND_API_KEY}`,
                  },
                  body: JSON.stringify({
                    from: "Fluff & Scruff Studio <info@fluffandscruff.co.uk>",
                    to: [staff.email],
                    reply_to: "info@fluffandscruff.co.uk",
                    subject: `Set Up Your ${portalName} Account — Fluff & Scruff Studio`,
                    html: `
                      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                        <div style="text-align: center; padding: 16px 0;">
                          <img src="${logoUrl}" alt="Fluff & Scruff Studio" style="height: 60px; width: auto;" />
                        </div>
                        <h2 style="color: #1a1a1a;">Welcome to the Team! 🎉</h2>
                        <p>Hi <strong>${staff.name}</strong>,</p>
                        <p>Both your contract and Health & Safety policy have been signed successfully. Your <strong>${portalName}</strong> account is now ready!</p>
                        <p>Click the button below to set your password and access your portal:</p>
                        <p style="margin: 24px 0; text-align: center;">
                          <a href="${linkData.properties.action_link}" style="background-color: #3d4147; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                            Set Your Password
                          </a>
                        </p>
                        <p style="color: #666; font-size: 14px;">Once you've set your password, you can log in at any time from our website to view your schedule, messages, and more.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                        <p style="color: #999; font-size: 12px;">Fluff & Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL</p>
                      </div>
                    `,
                  }),
                });
              }
            }
          }
        }
      } catch (accountErr) {
        console.error("Account creation error:", accountErr);
      }

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
