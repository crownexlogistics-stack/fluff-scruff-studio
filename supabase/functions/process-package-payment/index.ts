import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id } = await req.json();
    if (!session_id) throw new Error("Missing session_id");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const checkoutSession = await stripe.checkout.sessions.retrieve(session_id);
    if (checkoutSession.payment_status !== "paid") {
      throw new Error("Payment not completed");
    }

    const meta = checkoutSession.metadata || {};
    if (meta.type !== "package_booking") {
      throw new Error("Invalid session type");
    }

    // Check idempotency
    const { data: existingPkg } = await (supabase.from("package_bookings").select("id").eq("stripe_payment_intent_id", checkoutSession.payment_intent as string).maybeSingle() as any);
    if (existingPkg) {
      return new Response(JSON.stringify({ package_booking_id: existingPkg.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load pending data
    const { data: pending, error: pendingErr } = await supabase
      .from("package_checkout_pending")
      .select("*")
      .eq("id", meta.pending_id)
      .single();

    if (pendingErr || !pending) throw new Error("Pending checkout data not found");

    const sessionsData = pending.sessions_json || [];
    const totalPaid = Number(pending.total_price) || 0;
    const packageId = pending.package_id;
    const customerEmail = pending.customer_email;
    const customerName = pending.customer_name;
    const customerPhone = pending.customer_phone;
    const dogName = pending.dog_name;
    const breedId = pending.breed_id || null;

    // Get package info
    const { data: pkg } = await (supabase.from("packages").select("*").eq("id", packageId).single() as any);
    if (!pkg) throw new Error("Package not found");

    // Create package_booking
    const { data: pkgBooking, error: pbErr } = await (supabase.from("package_bookings").insert({
      package_id: packageId,
      customer_email: customerEmail,
      customer_name: customerName,
      customer_phone: customerPhone,
      dog_name: dogName,
      total_paid: totalPaid,
      sessions_total: pkg.session_count,
      sessions_used: 0,
      sessions_remaining: pkg.session_count,
      status: "active",
      stripe_payment_intent_id: checkoutSession.payment_intent as string,
      stripe_payment_status: "paid",
      notes: `Booked online. Breed: ${breedId || "not specified"}`,
    }).select("id").single() as any);

    if (pbErr) throw pbErr;
    const packageBookingId = pkgBooking.id;

    console.log(`[process-package-payment] Created package_booking ${packageBookingId}`);

    // Resolve service IDs
    const { data: allServices } = await supabase.from("services").select("id, name").eq("is_active", true);
    const serviceMap: Record<string, string> = {};
    for (const svc of (allServices || [])) {
      const lower = (svc.name || "").toLowerCase();
      if (lower.includes("full groom")) serviceMap["full_groom"] = svc.id;
      if (lower.includes("bath") && lower.includes("brush")) serviceMap["bath_brush"] = svc.id;
      if (lower.includes("teeth") || lower.includes("ultrasonic")) serviceMap["teeth_cleaning"] = svc.id;
    }

    // Helper: invoke check-availability for a single session
    async function isAvailable(staffId: string, date: string, time: string, durationMinutes: number, serviceId?: string | null): Promise<{ ok: boolean; reason?: string }> {
      const { data, error } = await supabase.functions.invoke("check-availability", {
        body: { groomer_id: staffId, date, start_time: time, duration_minutes: durationMinutes, service_id: serviceId ?? null },
      });
      if (error) return { ok: false, reason: error.message || "availability check failed" };
      if (!data?.available) return { ok: false, reason: data?.reason || "slot unavailable" };
      return { ok: true };
    }

    // Resolve duration per session (teeth = 30, otherwise breed default or 90)
    let breedDuration = 90;
    if (breedId) {
      const { data: breedRow } = await supabase.from("breeds").select("duration_minutes").eq("id", breedId).maybeSingle();
      if (breedRow?.duration_minutes) breedDuration = Number(breedRow.duration_minutes);
    }
    const durationFor = (serviceType: string) => serviceType === "teeth_cleaning" ? 30 : breedDuration;

    // Create individual bookings
    for (const session of sessionsData) {
      const sessionPrice = totalPaid / pkg.session_count;
      const serviceId = serviceMap[session.service_type] || null;
      const sessionStaffId: string | null = session.groomer_id || null;

      // SAFETY GUARD: package_online bookings must always have a staff_id
      if (!sessionStaffId) {
        console.error(`[process-package-payment] Session ${session.session_number} arrived with null groomer_id — refusing to insert. Front-end must resolve groomer before checkout.`);
        continue;
      }

      // Final availability re-check (race-condition guard) — should always pass because front-end already filtered
      const dur = durationFor(session.service_type);
      const avail = await isAvailable(sessionStaffId, session.date, session.time, dur, serviceId);
      if (!avail.ok) {
        console.error(`[process-package-payment] Session ${session.session_number} failed availability re-check: ${avail.reason}. Skipping insert.`);
        continue;
      }

      const { data: booking, error: bErr } = await supabase.from("bookings").insert({
        booking_date: session.date,
        booking_time: session.time + ":00",
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        dog_name: dogName,
        breed_id: breedId || null,
        service_id: serviceId,
        staff_id: sessionStaffId,
        status: "Confirmed",
        booking_source: "package_online",
        total_price: sessionPrice,
        deposit_paid: sessionPrice,
        notes: `📦 Session ${session.session_number} of ${pkg.session_count} — ${pkg.name}`,
      }).select("id").single();

      if (bErr) {
        console.error(`[process-package-payment] Failed to create booking for session ${session.session_number}:`, bErr);
        continue;
      }

      await (supabase.from("package_sessions").insert({
        package_booking_id: packageBookingId,
        booking_id: booking.id,
        session_number: session.session_number,
        service_type: session.service_type,
        scheduled_date: session.date,
        scheduled_time: session.time + ":00",
        status: "scheduled",
      }) as any);

      await supabase.from("booking_audit_log").insert({
        booking_id: booking.id,
        event_type: "created_online",
        note: `Package booking (online) — Session ${session.session_number} of ${pkg.session_count}`,
      });
    }

    // Trigger T&C signing email
    try {
      await supabase.functions.invoke("send-package-tc-email", {
        body: { package_booking_id: packageBookingId, type: "invite" },
      });
    } catch (e) {
      console.error("[process-package-payment] Failed to send TC email:", e);
    }

    // Send confirmation email
    try {
      const sessionDetails = sessionsData.map((s: any) =>
        `Session ${s.session_number}: ${s.date} at ${s.time}`
      ).join("\n");

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Fluff & Scruff Studio <info@fluffandscruff.co.uk>",
            to: [customerEmail],
            subject: `Package Booking Confirmed — ${pkg.name} 🐾`,
            html: `
              <div style="font-family: Nunito, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                <h1 style="font-family: Fredoka One, sans-serif; color: #2D1B0E;">Your Package is Booked! 🐾</h1>
                <p>Hi ${(customerName || "").split(" ")[0]},</p>
                <p>Thank you for booking the <strong>${pkg.name}</strong> for <strong>${dogName}</strong>.</p>
                <p><strong>Total Paid:</strong> £${totalPaid.toFixed(2)}</p>
                <h3 style="color: #FF6B35;">Your Sessions</h3>
                <pre style="background: #FFFAF4; padding: 12px; border-radius: 8px; font-size: 14px;">${sessionDetails}</pre>
                <p>You'll receive a separate email with a link to sign your package agreement.</p>
                <p>We'll send you a reminder before each session. If you need to reschedule, just give us 48 hours notice.</p>
                <p style="margin-top: 24px;">See you soon!<br/>Fluff & Scruff Studio 🐶</p>
              </div>
            `,
          }),
        });
      }
    } catch (e) {
      console.error("[process-package-payment] Failed to send confirmation email:", e);
    }

    // Notify salon
    try {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Fluff & Scruff Studio <info@fluffandscruff.co.uk>",
            to: ["info@fluffandscruff.co.uk"],
            subject: `📦 New Package Booking — ${customerName}`,
            html: `
              <p><strong>${customerName}</strong> has booked the <strong>${pkg.name}</strong> online.</p>
              <p>Dog: ${dogName} | Total Paid: £${totalPaid.toFixed(2)}</p>
              <p>Sessions: ${sessionsData.map((s: any) => `${s.date} at ${s.time}`).join(", ")}</p>
            `,
          }),
        });
      }
    } catch (e) {
      console.error("[process-package-payment] Failed to notify salon:", e);
    }

    // Clean up pending record
    await supabase.from("package_checkout_pending").delete().eq("id", meta.pending_id);

    return new Response(JSON.stringify({ package_booking_id: packageBookingId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[process-package-payment] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
