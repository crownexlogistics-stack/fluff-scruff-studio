import { supabase } from "@/integrations/supabase/client";

let cachedIp: string | null = null;

async function getClientIp(): Promise<string | null> {
  if (cachedIp) return cachedIp;
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    cachedIp = data.ip || null;
    return cachedIp;
  } catch {
    return null;
  }
}

/**
 * Log an action to the audit_logs table.
 * Fire-and-forget — never blocks the caller.
 * Automatically captures IP address and user identity.
 */
export async function logAudit({
  staffId,
  action,
  details,
}: {
  staffId?: string;
  action: string;
  details?: string;
}) {
  try {
    const [{ data: { user } }, ip] = await Promise.all([
      supabase.auth.getUser(),
      getClientIp(),
    ]);
    if (!user) return;

    await (supabase.from("audit_logs" as any) as any).insert({
      staff_id: staffId || null,
      user_id: user.id,
      action,
      details: details || null,
      ip_address: ip || null,
    });
  } catch {
    // Never block on audit failure
  }
}
