import { supabase } from "@/integrations/supabase/client";

export interface BlacklistCheckResult {
  blocked: boolean;
  matched_on?: "email" | "phone";
  reason?: string;
  blacklist_id?: string;
}

/**
 * Server-side blacklist check. Fails open (never blocks) if the check itself errors,
 * so a connection problem can't stop genuine customers from booking.
 */
export async function checkBlacklist(params: {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  channel: "online" | "phone" | "staff";
  log?: boolean;
}): Promise<BlacklistCheckResult> {
  try {
    const { data, error } = await supabase.functions.invoke("check-blacklist", { body: params });
    if (error) return { blocked: false };
    return (data as BlacklistCheckResult) || { blocked: false };
  } catch {
    return { blocked: false };
  }
}

export const BLACKLIST_CUSTOMER_MESSAGE =
  "Oops — something went wrong on our side and we couldn't complete this booking. Please try again later or give the salon a call.";
