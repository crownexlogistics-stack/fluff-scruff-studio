// Mirrors the HTML templates used by the `send-booking-email` edge function.
// Used to reconstruct the exact wording of automated emails that were sent
// before the rendered body started being stored in `booking_emails`.

export interface BookingEmailContext {
  customer_name?: string | null;
  dog_name?: string | null;
  breed_name?: string | null;
  service_name?: string | null;
  booking_date?: string | null;
  booking_time?: string | null;
  total_price?: number | string | null;
}

const FOOTER = `
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
  <p style="color: #999; font-size: 12px;">Fluff &amp; Scruff Studio · 138 Hillview Avenue, Hornchurch RM11 2DL · 01708 606655</p>`;

const ADDRESS_BLOCK = `
  <p style="background: #f8f8f8; padding: 16px; border-radius: 8px; margin: 16px 0;">
    📍 <strong>Fluff &amp; Scruff Studio</strong><br/>
    138 Hillview Avenue, Hornchurch RM11 2DL<br/>
    📞 <a href="tel:01708606655" style="color: #1a1a1a;">01708 606655</a> · WhatsApp: <a href="https://wa.me/447476452782" style="color: #1a1a1a;">+44 7476 452782</a>
  </p>`;

const wrap = (inner: string) =>
  `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">${inner}${FOOTER}</div>`;

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function buildBookingEmailSubject(emailType: string, ctx: BookingEmailContext): string {
  const dog = ctx.dog_name || "your dog";
  const dateFormatted = formatDate(ctx.booking_date);
  switch (emailType) {
    case "confirmation":
      return `Booking Confirmed — ${dog} on ${dateFormatted}`;
    case "reminder_24h":
      return `Reminder: ${dog}'s appointment tomorrow`;
    case "reminder_2h":
      return `${dog}'s appointment is in 2 hours!`;
    case "appointment_updated":
      return `Appointment Updated — ${dog} on ${dateFormatted}`;
    case "no_show":
      return `Missed Appointment — ${dog} on ${dateFormatted}`;
    default:
      return emailType;
  }
}

export function buildBookingEmailHtml(emailType: string, ctx: BookingEmailContext): string | null {
  const name = ctx.customer_name || "there";
  const dog = ctx.dog_name || "your dog";
  const breedName = ctx.breed_name || "";
  const serviceName = ctx.service_name || "Grooming";
  const dateFormatted = formatDate(ctx.booking_date);
  const timeFormatted = (ctx.booking_time || "").slice(0, 5);
  const price = ctx.total_price != null ? Number(ctx.total_price).toFixed(2) : null;

  const detailsTable = `
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 8px 0; color: #666;">Dog</td><td style="padding: 8px 0; font-weight: bold;">${dog}${breedName ? ` (${breedName})` : ""}</td></tr>
      <tr><td style="padding: 8px 0; color: #666;">Service</td><td style="padding: 8px 0; font-weight: bold;">${serviceName}</td></tr>
      <tr><td style="padding: 8px 0; color: #666;">Date</td><td style="padding: 8px 0; font-weight: bold;">${dateFormatted}</td></tr>
      <tr><td style="padding: 8px 0; color: #666;">Time</td><td style="padding: 8px 0; font-weight: bold;">${timeFormatted}</td></tr>
      ${price ? `<tr><td style="padding: 8px 0; color: #666;">Price</td><td style="padding: 8px 0; font-weight: bold;">£${price}</td></tr>` : ""}
    </table>`;

  switch (emailType) {
    case "confirmation":
      return wrap(`
        <h2 style="color: #1a1a1a;">Booking Confirmed ✓</h2>
        <p>Hi ${name},</p>
        <p>Your appointment has been booked! Here are the details:</p>
        ${detailsTable}
        ${ADDRESS_BLOCK}
        <p style="color: #666;">Need to make changes or cancel? You can do this from your profile up to 48 hours before your appointment. If your appointment is less than 48 hours away, please call or email us directly at <a href="mailto:info@fluffandscruff.co.uk" style="color: #1a1a1a;">info@fluffandscruff.co.uk</a>.</p>`);
    case "reminder_24h":
      return wrap(`
        <h2 style="color: #1a1a1a;">Appointment Tomorrow 🐾</h2>
        <p>Hi ${name},</p>
        <p>Just a friendly reminder that <strong>${dog}</strong> has an appointment tomorrow:</p>
        <p style="background: #f8f8f8; padding: 16px; border-radius: 8px; font-size: 18px; text-align: center;">
          <strong>${dateFormatted}</strong> at <strong>${timeFormatted}</strong>
        </p>
        <p><strong>Service:</strong> ${serviceName}</p>
        ${ADDRESS_BLOCK}
        <p style="color: #666;">Need to reschedule? Reply to this email and we'll help.</p>`);
    case "reminder_2h":
      return wrap(`
        <h2 style="color: #1a1a1a;">See You Soon! 🐶</h2>
        <p>Hi ${name},</p>
        <p><strong>${dog}</strong> is due at the studio at <strong>${timeFormatted}</strong> today.</p>
        ${ADDRESS_BLOCK}
        <p style="color: #666;">Running late? Reply to this email to let us know.</p>`);
    case "appointment_updated":
      return wrap(`
        <h2 style="color: #1a1a1a;">Your Appointment Has Been Updated 📝</h2>
        <p>Hi ${name},</p>
        <p>We've made a change to <strong>${dog}</strong>'s appointment. Here are the updated details:</p>
        ${detailsTable}
        ${ADDRESS_BLOCK}
        <p style="color: #666;">Questions? Simply reply to this email and we'll help.</p>`);
    case "no_show":
      return wrap(`
        <h2 style="color: #1a1a1a;">Missed Appointment</h2>
        <p>Hi ${name},</p>
        <p>We noticed that <strong>${dog}</strong> didn't make it to the appointment today at <strong>${timeFormatted}</strong>.</p>
        <p>We hope everything is okay! If you'd like to rebook, please get in touch and we'll find a new time that works for you.</p>
        ${ADDRESS_BLOCK}
        <p style="color: #666; font-size: 13px;">Please note that deposits for missed appointments are non-refundable as per our booking terms.</p>`);
    default:
      return null;
  }
}
