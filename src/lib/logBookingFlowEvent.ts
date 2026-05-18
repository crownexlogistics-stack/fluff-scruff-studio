import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "bookingFlowSessionId";

export function getBookingFlowSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // Fallback when sessionStorage unavailable (private mode, SSR)
    return crypto.randomUUID();
  }
}

export function resetBookingFlowSession(): string {
  const id = crypto.randomUUID();
  try {
    sessionStorage.setItem(SESSION_KEY, id);
  } catch { /* ignore */ }
  return id;
}

export interface LogBookingFlowEventParams {
  sessionId: string;
  step: string;
  action: string;
  payload?: Record<string, unknown>;
  customerEmail?: string | null;
  customerPhone?: string | null;
  bookingId?: string | null;
}

/**
 * Fire-and-forget audit log for the public booking flow.
 * Never throws — failures must not break the booking journey.
 */
export function logBookingFlowEvent(params: LogBookingFlowEventParams): void {
  try {
    const row: Record<string, unknown> = {
      session_id: params.sessionId,
      step: params.step,
      action: params.action,
      payload: params.payload ?? {},
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
    };
    if (params.customerEmail) row.customer_email = params.customerEmail;
    if (params.customerPhone) row.customer_phone = params.customerPhone;
    if (params.bookingId) row.booking_id = params.bookingId;

    void supabase
      .from("booking_flow_events" as never)
      .insert(row as never)
      .then(({ error }) => {
        if (error) {
          console.warn("[booking-flow-event] insert failed:", error.message);
        }
      });
  } catch (err) {
    console.warn("[booking-flow-event] caught error:", err);
  }
}

/**
 * After a booking is created, link every prior session event to it.
 */
export async function linkSessionToBooking(sessionId: string, bookingId: string): Promise<void> {
  try {
    await supabase
      .from("booking_flow_events" as never)
      .update({ booking_id: bookingId } as never)
      .eq("session_id", sessionId)
      .is("booking_id", null);
  } catch (err) {
    console.warn("[booking-flow-event] link to booking failed:", err);
  }
}