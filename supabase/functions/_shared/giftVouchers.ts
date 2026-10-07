// Shared gift voucher logic: codes, lockout, delivery, activation, redemption notices.
// All voucher money/state changes happen server-side only.

export const SITE = "https://fluffandscruff.co.uk";
const FROM = "Fluff & Scruff Studio <info@fluffandscruff.co.uk>";
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

export function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `FS-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

export function normaliseCode(raw: string): string {
  const c = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = c.startsWith("FS") ? c.slice(2) : c;
  if (body.length !== 12) return "";
  return `FS-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
}

export function clientKey(req: Request): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";
  return `ip:${ip}`;
}

const MAX_FAILS = 5;
const WINDOW_MIN = 15;

export async function isLockedOut(supabase: any, key: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
  const { count } = await supabase
    .from("gift_voucher_attempts")
    .select("id", { count: "exact", head: true })
    .eq("client_key", key)
    .eq("success", false)
    .gte("created_at", since);
  return (count ?? 0) >= MAX_FAILS;
}

export async function logAttempt(supabase: any, key: string, success: boolean) {
  await supabase.from("gift_voucher_attempts").insert({ client_key: key, success });
}

export type VoucherCheck =
  | { ok: true; voucher: any }
  | { ok: false; reason: "invalid" | "used" | "expired" | "locked" };

/** Checks a code with lockout. Never reveals buyer/recipient details. */
export async function checkVoucher(supabase: any, req: Request, rawCode: string): Promise<VoucherCheck> {
  const key = clientKey(req);
  if (await isLockedOut(supabase, key)) return { ok: false, reason: "locked" };
  const code = normaliseCode(rawCode);
  if (!code) {
    await logAttempt(supabase, key, false);
    return { ok: false, reason: "invalid" };
  }
  const { data: v } = await supabase.from("gift_vouchers").select("*").eq("code", code).maybeSingle();
  if (!v || v.status === "pending_payment" || v.status === "cancelled") {
    await logAttempt(supabase, key, false);
    return { ok: false, reason: "invalid" };
  }
  await logAttempt(supabase, key, true);
  if (v.status === "redeemed" || v.status === "reserved") return { ok: false, reason: "used" };
  if (!v.expires_at || new Date(v.expires_at).getTime() <= Date.now()) return { ok: false, reason: "expired" };
  return { ok: true, voucher: v };
}

export const REASON_TEXT: Record<string, string> = {
  invalid: "That voucher code isn't valid. Please check it and try again.",
  used: "This voucher has already been used.",
  expired: "This voucher has expired.",
  locked: "Too many wrong attempts. Please wait 15 minutes and try again.",
};

const money = (n: number) => `£${Number(n).toFixed(2)}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const OCCASION: Record<string, { label: string; bg: string; accent: string; emoji: string }> = {
  classic: { label: "Gift Card", bg: "#2B2622", accent: "#FF6B35", emoji: "🐾" },
  birthday: { label: "Birthday Paws", bg: "#3A2A4A", accent: "#FFB347", emoji: "🎂" },
  halloween: { label: "Halloween Special", bg: "#1E1528", accent: "#FF7A1A", emoji: "🎃" },
  christmas: { label: "Festive Gift Card", bg: "#123524", accent: "#E8C46A", emoji: "🎄" },
};

export function cardUrl(v: any) {
  return `${SITE}/v/${v.view_token}`;
}

function cardHtml(v: any) {
  const o = OCCASION[v.occasion] ?? OCCASION.classic;
  const holder = v.recipient_name || v.purchaser_name;
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;margin:0 auto;background:${o.bg};border-radius:18px;color:#FFFAF4;font-family:Arial,sans-serif">
    <tr><td style="padding:22px 24px 6px">
      <div style="font-size:18px;font-weight:bold;letter-spacing:.5px">Fluff &amp; Scruff</div>
      <div style="font-size:11px;color:${o.accent};letter-spacing:2px;text-transform:uppercase">${o.emoji} ${esc(o.label)}</div>
    </td><td align="right" style="padding:22px 24px 6px;font-size:26px;font-weight:bold;color:${o.accent}">${money(v.amount)}</td></tr>
    <tr><td colspan="2" style="padding:22px 24px 6px;font-family:'Courier New',monospace;font-size:22px;letter-spacing:3px;font-weight:bold">${esc(v.code)}</td></tr>
    <tr><td style="padding:10px 24px 22px;font-size:11px;color:#d8cfc6">FOR<br><span style="font-size:14px;color:#FFFAF4;text-transform:uppercase">${esc(holder)}</span></td>
    <td align="right" style="padding:10px 24px 22px;font-size:11px;color:#d8cfc6">VALID THRU<br><span style="font-size:14px;color:#FFFAF4">${v.expires_at ? fmtDate(v.expires_at) : ""}</span></td></tr>
  </table>`;
}

function shell(inner: string) {
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,sans-serif;color:#2B2622">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px">${inner}
  <p style="font-size:12px;color:#8a7f75;margin-top:28px">Fluff &amp; Scruff Grooming Studio · Hornchurch · <a href="${SITE}/terms" style="color:#8a7f75">Terms &amp; Conditions</a></p>
  </div></body></html>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("Email is not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Email failed [${res.status}]: ${await res.text()}`);
}

function toE164(phone: string): string | null {
  let p = String(phone || "").replace(/[^0-9+]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (p.startsWith("0")) p = "+44" + p.slice(1);
  if (p.startsWith("44")) p = "+" + p;
  if (/^7\d{9}$/.test(p)) p = "+44" + p;
  return /^\+\d{10,15}$/.test(p) ? p : null;
}

async function sendSms(to: string, body: string) {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_PHONE_NUMBER");
  if (!sid || !token || !from) throw new Error("SMS is not configured");
  const num = toE164(to);
  if (!num) throw new Error("That mobile number doesn't look right");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: num, From: from, Body: body }),
  });
  if (!res.ok) throw new Error(`SMS failed [${res.status}]: ${await res.text()}`);
}

/**
 * Sends the voucher card. channels override the stored delivery choice (admin resend).
 * Returns a list of what was sent and any failures.
 */
export async function deliverVoucher(
  supabase: any,
  v: any,
  opts: { channels?: ("email" | "sms")[]; includePurchaserCopy?: boolean; by?: string } = {},
) {
  const sent: string[] = [];
  const failed: string[] = [];
  const toRecipient = v.send_to === "recipient";
  const link = cardUrl(v);
  const fromName = v.is_complimentary ? "Fluff & Scruff" : v.purchaser_name;
  const channels = opts.channels ?? (toRecipient
    ? (v.delivery_method === "both" ? ["email", "sms"] : [v.delivery_method])
    : ["email"]);

  const message = v.gift_message ? `<p style="font-style:italic;background:#FFFAF4;border-radius:12px;padding:14px 16px">“${esc(v.gift_message)}”</p>` : "";

  if (toRecipient) {
    if (channels.includes("email") && v.recipient_email) {
      try {
        await sendEmail(
          v.recipient_email,
          `🐾 ${fromName} sent you a Fluff & Scruff gift card`,
          shell(`<h1 style="font-size:22px">Hi ${esc(v.recipient_name || "there")}!</h1>
          <p>${esc(fromName)} has sent you a <strong>${money(v.amount)}</strong> Fluff &amp; Scruff gift card.</p>${message}
          ${cardHtml(v)}
          <p style="text-align:center;margin:22px 0"><a href="${link}" style="background:#FF6B35;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">View &amp; save your card</a></p>
          <p style="font-size:13px">To use it, book online at <a href="${SITE}/book">${SITE.replace("https://", "")}/book</a> and enter your code at payment, or call us and quote the code. Single use, valid until ${fmtDate(v.expires_at)}.</p>`),
        );
        sent.push(`email to ${v.recipient_email}`);
      } catch (e) { failed.push(`email: ${(e as Error).message}`); }
    }
    if (channels.includes("sms") && v.recipient_phone) {
      try {
        await sendSms(v.recipient_phone,
          `Hi ${v.recipient_name || "there"}! ${fromName} has sent you a ${money(v.amount)} Fluff & Scruff gift card 🐾 View and save it here: ${link}`);
        sent.push(`text to ${v.recipient_phone}`);
      } catch (e) { failed.push(`text: ${(e as Error).message}`); }
    }
  }

  const purchaserCopy = opts.includePurchaserCopy ?? (!toRecipient || v.copy_to_purchaser);
  if (purchaserCopy && v.purchaser_email && !v.is_complimentary) {
    try {
      await sendEmail(
        v.purchaser_email,
        toRecipient ? "Your Fluff & Scruff gift card (your copy)" : "Your Fluff & Scruff gift card is ready 🐾",
        shell(`<h1 style="font-size:22px">Thank you, ${esc(v.purchaser_name)}!</h1>
        <p>${toRecipient ? `Here's your copy of the gift card you sent to <strong>${esc(v.recipient_name || "")}</strong>.` : "Here's your gift card — print it, forward this email, or screenshot the card."}</p>
        ${message}${cardHtml(v)}
        <p style="text-align:center;margin:22px 0"><a href="${link}" style="background:#FF6B35;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Open card to save or print</a></p>
        <p style="font-size:13px"><strong>Receipt:</strong> ${money(v.amount_paid ?? v.amount)} paid by card. Valid until ${fmtDate(v.expires_at)}. Single use, no cash value.</p>`),
      );
      sent.push(`copy to ${v.purchaser_email}`);
    } catch (e) { failed.push(`buyer copy: ${(e as Error).message}`); }
  }

  await supabase.from("gift_vouchers")
    .update({ last_sent_at: new Date().toISOString(), send_count: (v.send_count ?? 0) + 1 })
    .eq("id", v.id);
  await supabase.from("gift_voucher_events").insert({
    voucher_id: v.id,
    event_type: "sent",
    note: [sent.length ? `Sent: ${sent.join(", ")}` : "", failed.length ? `Failed: ${failed.join("; ")}` : ""].filter(Boolean).join(" · ") || "Nothing to send",
    performed_by: opts.by ?? "System",
  });
  return { sent, failed };
}

/** Privacy-safe: no date, time, service or dog details. */
export async function notifyPurchaserRedeemed(supabase: any, v: any) {
  if (v.is_complimentary || !v.purchaser_email || v.purchaser_notified_at) return;
  try {
    const who = v.send_to === "recipient" && v.recipient_name ? v.recipient_name : "your gift card";
    await sendEmail(
      v.purchaser_email,
      "Your Fluff & Scruff gift has been used 🐾",
      shell(`<h1 style="font-size:22px">Hi ${esc(v.purchaser_name)},</h1>
      <p>Great news! The Fluff &amp; Scruff gift card you bought${v.send_to === "recipient" && v.recipient_name ? ` for <strong>${esc(who)}</strong>` : ""} has just been used.</p>
      <p>Thank you for sharing the Fluff &amp; Scruff love!</p><p>— The Fluff &amp; Scruff Team</p>`),
    );
    await supabase.from("gift_vouchers").update({ purchaser_notified_at: new Date().toISOString() }).eq("id", v.id);
  } catch (e) {
    console.error("notifyPurchaserRedeemed failed", e);
  }
}

/** Idempotently activates a paid voucher from a Stripe Checkout session and sends it. */
export async function activateFromSession(supabase: any, session: any) {
  const voucherId = session?.metadata?.gift_voucher_id;
  if (!voucherId) return { ok: false, reason: "no_voucher" };
  if (session.payment_status !== "paid") return { ok: false, reason: "not_paid" };
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  const now = new Date();
  const expires = new Date(now);
  expires.setFullYear(expires.getFullYear() + 1);
  const { data: v } = await supabase
    .from("gift_vouchers")
    .update({
      status: "active",
      purchased_at: now.toISOString(),
      expires_at: expires.toISOString(),
      stripe_payment_intent_id: pi,
      amount_paid: (session.amount_total ?? 0) / 100,
    })
    .eq("id", voucherId)
    .eq("stripe_session_id", session.id)
    .eq("status", "pending_payment")
    .select("*")
    .maybeSingle();
  if (!v) return { ok: true, already: true }; // already activated (idempotent)
  await supabase.from("gift_voucher_events").insert({
    voucher_id: v.id, event_type: "purchased", note: `Paid £${Number(v.amount_paid).toFixed(2)} by card (${pi ?? "Stripe"})`, performed_by: "Stripe",
  });
  await deliverVoucher(supabase, v);
  return { ok: true, voucher: v };
}
