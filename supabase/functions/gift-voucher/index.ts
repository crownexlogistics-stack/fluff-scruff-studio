import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { z } from "npm:zod@3.23.8";
import {
  activateFromSession, checkVoucher, deliverVoucher, generateCode,
  notifyPurchaserRedeemed, REASON_TEXT,
} from "../_shared/giftVouchers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PRESETS = [25, 50, 75, 100];
const SEASONAL_SERVICES = ["Full Groom", "Bath & Brush", "Puppy Special"];

const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function activeOccasions(sb: any) {
  const { data: theme } = await sb.from("site_config").select("value").eq("key", "seasonal_theme").maybeSingle();
  const { data: vs } = await sb.from("site_config").select("value").eq("key", "voucher_settings").maybeSingle();
  const list = ["classic", "birthday"];
  if ((theme?.value as any)?.active === "halloween") list.push("halloween");
  if ((vs?.value as any)?.christmas === true) list.push("christmas");
  return list;
}

/** Server-side price for a seasonal package voucher: groom price + seasonal extra. */
async function seasonalPrice(sb: any, occasion: string, serviceName: string, breedId?: string | null) {
  if (!SEASONAL_SERVICES.includes(serviceName)) throw new Error("That service can't be used for this voucher");
  const { data: addon } = await sb.from("add_ons").select("name, price").ilike("name", `%${occasion}%`).eq("is_active", true).maybeSingle();
  if (!addon) throw new Error("This seasonal voucher isn't available right now");
  let base = 0;
  let label = serviceName;
  if (serviceName === "Puppy Special") {
    const { data: s } = await sb.from("services").select("fixed_price").eq("name", "Puppy Special").eq("is_active", true).maybeSingle();
    base = Number(s?.fixed_price ?? 0);
  } else {
    if (!breedId) throw new Error("Please choose the dog's breed");
    const { data: b } = await sb.from("breeds").select("name, price_full_groom, price_bath_brush").eq("id", breedId).maybeSingle();
    if (!b) throw new Error("Please choose the dog's breed");
    base = Number((serviceName === "Bath & Brush" ? b.price_bath_brush : b.price_full_groom) || 52);
    label = `${serviceName} (${b.name})`;
  }
  if (!(base > 0)) throw new Error("Price unavailable — please call us");
  return { amount: Math.round((base + Number(addon.price)) * 100) / 100, description: `${addon.name} + ${label}` };
}

async function requireStaff(req: Request, sb: any, managersOnly = false) {
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!token) return null;
  const { data } = await sb.auth.getUser(token);
  const user = data?.user;
  if (!user) return null;
  const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user.id);
  const r = (roles ?? []).map((x: any) => x.role);
  const allowed = managersOnly ? ["director", "manager"] : ["director", "manager", "groomer"];
  if (!r.some((x: string) => allowed.includes(x))) return null;
  const { data: staff } = await sb.from("staff").select("name").eq("auth_user_id", user.id).maybeSingle();
  return { id: user.id, name: staff?.name || user.email || "Staff" };
}

const phoneOk = (s?: string | null) => !s || /^[+0-9 ()-]{10,20}$/.test(s);

const CheckoutSchema = z.object({
  occasion: z.enum(["classic", "birthday", "halloween", "christmas"]),
  amount: z.number().min(10).max(500).optional(),
  service_name: z.string().max(60).optional(),
  breed_id: z.string().uuid().optional().nullable(),
  purchaser_name: z.string().trim().min(2).max(100),
  purchaser_email: z.string().trim().email().max(255),
  purchaser_phone: z.string().trim().max(20).optional().nullable(),
  send_to: z.enum(["me", "recipient"]),
  recipient_name: z.string().trim().max(100).optional().nullable(),
  recipient_email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
  recipient_phone: z.string().trim().max(20).optional().nullable(),
  delivery_method: z.enum(["email", "sms", "both"]).default("email"),
  copy_to_purchaser: z.boolean().default(true),
  gift_message: z.string().trim().max(300).optional().nullable(),
  accepted_terms: z.literal(true),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = admin();
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    // ---------- PUBLIC ----------
    if (action === "options") {
      const occasions = await activeOccasions(sb);
      const seasonal: Record<string, number> = {};
      for (const o of occasions.filter((x) => x === "halloween" || x === "christmas")) {
        const { data: a } = await sb.from("add_ons").select("price").ilike("name", `%${o}%`).eq("is_active", true).maybeSingle();
        if (a) seasonal[o] = Number(a.price);
      }
      return json({ occasions, presets: PRESETS, seasonal_extra: seasonal, seasonal_services: SEASONAL_SERVICES });
    }

    if (action === "quote") {
      const occ = String(body.occasion || "");
      if (!(await activeOccasions(sb)).includes(occ)) return json({ error: "This voucher isn't available right now" }, 400);
      try {
        return json(await seasonalPrice(sb, occ, String(body.service_name || ""), body.breed_id ?? null));
      } catch (e) { return json({ error: (e as Error).message }, 400); }
    }

    if (action === "checkout") {
      const parsed = CheckoutSchema.safeParse(body);
      if (!parsed.success) return json({ error: "Please check the form — some details are missing or invalid." , fields: parsed.error.flatten().fieldErrors }, 400);
      const d = parsed.data;
      if (!phoneOk(d.purchaser_phone) || !phoneOk(d.recipient_phone)) return json({ error: "Please check the phone number" }, 400);
      if (!(await activeOccasions(sb)).includes(d.occasion)) return json({ error: "This voucher design isn't available right now" }, 400);

      let amount: number;
      let description: string;
      const seasonalPkg = (d.occasion === "halloween" || d.occasion === "christmas") && d.service_name;
      if (seasonalPkg) {
        try { ({ amount, description } = await seasonalPrice(sb, d.occasion, d.service_name!, d.breed_id)); }
        catch (e) { return json({ error: (e as Error).message }, 400); }
      } else if (d.occasion === "halloween") {
        return json({ error: "Please choose the service for the Halloween Special" }, 400);
      } else {
        if (!d.amount || Math.round(d.amount * 100) % 100 !== 0) return json({ error: "Please choose an amount in whole pounds (£10–£500)" }, 400);
        amount = d.amount;
        description = `£${amount} gift card`;
      }

      if (d.send_to === "recipient") {
        if (!d.recipient_name) return json({ error: "Please enter the recipient's name" }, 400);
        if ((d.delivery_method === "email" || d.delivery_method === "both") && !d.recipient_email) return json({ error: "Please enter the recipient's email" }, 400);
        if ((d.delivery_method === "sms" || d.delivery_method === "both") && !d.recipient_phone) return json({ error: "Please enter the recipient's mobile number" }, 400);
      }

      // unique code
      let code = generateCode();
      for (let i = 0; i < 5; i++) {
        const { data: clash } = await sb.from("gift_vouchers").select("id").eq("code", code).maybeSingle();
        if (!clash) break;
        code = generateCode();
      }

      const { data: v, error: insErr } = await sb.from("gift_vouchers").insert({
        code, amount, occasion: d.occasion, description,
        purchaser_name: d.purchaser_name, purchaser_email: d.purchaser_email.toLowerCase(), purchaser_phone: d.purchaser_phone || null,
        send_to: d.send_to,
        recipient_name: d.send_to === "recipient" ? d.recipient_name : null,
        recipient_email: d.send_to === "recipient" ? (d.recipient_email || null) : null,
        recipient_phone: d.send_to === "recipient" ? (d.recipient_phone || null) : null,
        delivery_method: d.send_to === "recipient" ? d.delivery_method : "email",
        copy_to_purchaser: d.send_to === "recipient" ? d.copy_to_purchaser : true,
        gift_message: d.gift_message || null,
      }).select("*").single();
      if (insErr) throw insErr;

      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
      const origin = req.headers.get("origin") || "https://fluffandscruff.co.uk";
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: d.purchaser_email,
        line_items: [{
          price_data: { currency: "gbp", unit_amount: Math.round(amount * 100), product_data: { name: `Fluff & Scruff Gift Voucher — ${description}` } },
          quantity: 1,
        }],
        success_url: `${origin}/vouchers/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/vouchers?cancelled=1`,
        metadata: { type: "gift_voucher", gift_voucher_id: v.id },
        payment_intent_data: { metadata: { type: "gift_voucher", gift_voucher_id: v.id } },
      }, { idempotencyKey: `gift-voucher-${v.id}` });
      await sb.from("gift_vouchers").update({ stripe_session_id: session.id }).eq("id", v.id);
      return json({ url: session.url });
    }

    if (action === "finalize") {
      const sid = String(body.session_id || "");
      if (!/^cs_[A-Za-z0-9_]+$/.test(sid)) return json({ error: "Invalid session" }, 400);
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
      const session = await stripe.checkout.sessions.retrieve(sid);
      if (session.metadata?.type !== "gift_voucher") return json({ error: "Invalid session" }, 400);
      await activateFromSession(sb, session);
      const { data: v } = await sb.from("gift_vouchers").select("view_token, status").eq("stripe_session_id", sid).maybeSingle();
      if (!v || v.status === "pending_payment") return json({ pending: true });
      return json({ view_token: v.view_token });
    }

    if (action === "validate") {
      const r = await checkVoucher(sb, req, String(body.code || ""));
      if (!r.ok) return json({ valid: false, reason: r.reason, message: REASON_TEXT[r.reason] });
      return json({ valid: true, code: r.voucher.code, amount: Number(r.voucher.amount), expires_at: r.voucher.expires_at });
    }

    if (action === "view") {
      const t = String(body.token || "");
      if (!/^[0-9a-f-]{36}$/i.test(t)) return json({ error: "Not found" }, 404);
      const { data: v } = await sb.from("gift_vouchers")
        .select("code, amount, occasion, description, recipient_name, purchaser_name, send_to, gift_message, expires_at, status, is_complimentary")
        .eq("view_token", t).maybeSingle();
      if (!v || v.status === "pending_payment") return json({ error: "Not found" }, 404);
      return json({
        code: v.code, amount: Number(v.amount), occasion: v.occasion, description: v.description,
        holder: v.recipient_name || v.purchaser_name,
        from: v.send_to === "recipient" && !v.is_complimentary ? v.purchaser_name : null,
        message: v.gift_message, expires_at: v.expires_at,
        status: v.status === "reserved" ? "redeemed" : v.status,
      });
    }

    // ---------- STAFF ----------
    if (action === "redeem_for_booking") {
      const staff = await requireStaff(req, sb);
      if (!staff) return json({ error: "Not allowed" }, 403);
      const bookingId = String(body.booking_id || "");
      const { data: b } = await sb.from("bookings")
        .select("id, total_price, deposit_paid, cash_collected, card_collected, voucher_code, status")
        .eq("id", bookingId).maybeSingle();
      if (!b) return json({ error: "Appointment not found" }, 404);
      if (b.voucher_code) return json({ error: `This appointment already used voucher ${b.voucher_code}` }, 400);
      if (["Cancelled", "Refunded", "No Show"].includes(b.status)) return json({ error: "This appointment is cancelled" }, 400);
      const r = await checkVoucher(sb, req, String(body.code || ""));
      if (!r.ok) return json({ error: REASON_TEXT[r.reason] }, 400);
      const v = r.voucher;
      const balance = Math.max(0, Number(b.total_price || 0) - Number(b.deposit_paid || 0) - Number(b.cash_collected || 0) - Number(b.card_collected || 0));
      if (balance <= 0) return json({ error: "Nothing left to pay on this appointment" }, 400);
      const applied = Math.round(Math.min(Number(v.amount), balance) * 100) / 100;
      const channel = body.channel === "phone" ? "phone" : "in_salon";
      const { data: red, error: redErr } = await sb.rpc("redeem_gift_voucher", {
        _code: v.code, _booking_id: b.id, _amount_applied: applied, _channel: channel, _by: staff.name, _from_reserved: false,
      });
      if (redErr || !red?.id) return json({ error: "This voucher has just been used — please check the code" }, 409);
      await sb.from("bookings").update({
        voucher_code: v.code,
        voucher_amount: applied,
        deposit_paid: Math.round((Number(b.deposit_paid || 0) + applied) * 100) / 100,
      }).eq("id", b.id);
      await sb.from("booking_audit_log").insert({
        booking_id: b.id, event_type: "voucher_applied", performed_by: staff.name,
        note: `Gift voucher ${v.code} applied (${channel === "phone" ? "over the phone" : "in salon"}): £${applied.toFixed(2)} of £${Number(v.amount).toFixed(2)}${applied < Number(v.amount) ? " — remaining voucher value forfeited (single use)" : ""}.`,
      });
      await notifyPurchaserRedeemed(sb, red);
      return json({ ok: true, applied, voucher_value: Number(v.amount) });
    }

    if (action === "resend" || action === "update_contact") {
      const staff = await requireStaff(req, sb, true);
      if (!staff) return json({ error: "Only managers can do this" }, 403);
      const { data: v } = await sb.from("gift_vouchers").select("*").eq("id", String(body.voucher_id || "")).maybeSingle();
      if (!v) return json({ error: "Voucher not found" }, 404);
      if (v.status === "pending_payment" || v.status === "cancelled") return json({ error: "This voucher isn't active" }, 400);
      let current = v;
      if (action === "update_contact") {
        const U = z.object({
          purchaser_email: z.string().trim().email().max(255).optional(),
          purchaser_phone: z.string().trim().max(20).nullable().optional(),
          recipient_name: z.string().trim().max(100).nullable().optional(),
          recipient_email: z.string().trim().email().max(255).nullable().optional().or(z.literal("")),
          recipient_phone: z.string().trim().max(20).nullable().optional(),
        }).safeParse(body.fields ?? {});
        if (!U.success) return json({ error: "Please check the email / phone" }, 400);
        const f: any = { ...U.data };
        if (f.recipient_email === "") f.recipient_email = null;
        if (!phoneOk(f.purchaser_phone) || !phoneOk(f.recipient_phone)) return json({ error: "Please check the phone number" }, 400);
        const { data: upd } = await sb.from("gift_vouchers").update(f).eq("id", v.id).select("*").single();
        current = upd;
        await sb.from("gift_voucher_events").insert({ voucher_id: v.id, event_type: "contact_updated", note: "Contact details corrected", performed_by: staff.name });
      }
      if (action === "resend" || body.resend) {
        if (current.status !== "active") return json({ error: "Only unused vouchers can be re-sent" }, 400);
        const channels = (Array.isArray(body.channels) ? body.channels : ["email"]).filter((c: string) => c === "email" || c === "sms");
        const target = body.target === "purchaser" ? "purchaser" : "recipient";
        let res;
        if (target === "purchaser" || current.send_to === "me") {
          res = await deliverVoucher(sb, { ...current, send_to: "me" }, { includePurchaserCopy: true, by: staff.name });
        } else {
          res = await deliverVoucher(sb, current, { channels, includePurchaserCopy: false, by: staff.name });
        }
        return json({ ok: true, ...res });
      }
      return json({ ok: true });
    }

    if (action === "issue") {
      const staff = await requireStaff(req, sb, true);
      if (!staff) return json({ error: "Only managers can issue vouchers" }, 403);
      const I = z.object({
        amount: z.number().min(5).max(500),
        occasion: z.enum(["classic", "birthday", "halloween", "christmas"]).default("classic"),
        recipient_name: z.string().trim().min(2).max(100),
        recipient_email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
        recipient_phone: z.string().trim().max(20).optional().nullable(),
        reason: z.string().trim().min(3).max(200),
        send: z.boolean().default(true),
      }).safeParse(body);
      if (!I.success) return json({ error: "Please fill in amount, name and reason" }, 400);
      const d = I.data;
      const now = new Date(); const exp = new Date(now); exp.setFullYear(exp.getFullYear() + 1);
      const hasEmail = !!d.recipient_email; const hasPhone = !!d.recipient_phone;
      const { data: v, error } = await sb.from("gift_vouchers").insert({
        code: generateCode(), amount: d.amount, occasion: d.occasion, description: `Complimentary — ${d.reason}`,
        status: "active", is_complimentary: true, issued_by: staff.name,
        purchaser_name: "Fluff & Scruff", purchaser_email: "info@fluffandscruff.co.uk",
        send_to: "recipient", recipient_name: d.recipient_name,
        recipient_email: d.recipient_email || null, recipient_phone: d.recipient_phone || null,
        delivery_method: hasEmail && hasPhone ? "both" : hasPhone ? "sms" : "email",
        copy_to_purchaser: false, purchased_at: now.toISOString(), expires_at: exp.toISOString(), amount_paid: 0,
      }).select("*").single();
      if (error) throw error;
      await sb.from("gift_voucher_events").insert({ voucher_id: v.id, event_type: "issued", note: `Complimentary voucher: ${d.reason}`, performed_by: staff.name });
      const res = d.send && (hasEmail || hasPhone) ? await deliverVoucher(sb, v, { by: staff.name }) : { sent: [], failed: [] };
      return json({ ok: true, code: v.code, view_token: v.view_token, ...res });
    }

    if (action === "cancel") {
      const staff = await requireStaff(req, sb, true);
      if (!staff) return json({ error: "Only managers can cancel vouchers" }, 403);
      const reason = String(body.reason || "").trim();
      if (reason.length < 3) return json({ error: "Please give a reason" }, 400);
      const { data: v } = await sb.from("gift_vouchers").update({ status: "cancelled" })
        .eq("id", String(body.voucher_id || "")).eq("status", "active").select("id").maybeSingle();
      if (!v) return json({ error: "Only unused vouchers can be cancelled" }, 400);
      await sb.from("gift_voucher_events").insert({ voucher_id: v.id, event_type: "cancelled", note: reason, performed_by: staff.name });
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("gift-voucher error", e);
    return json({ error: "Something went wrong — please try again." }, 500);
  }
});

