import { supabase } from "@/integrations/supabase/client";

/**
 * Log an action to the audit_logs table.
 * Fire-and-forget — never blocks the caller.
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await (supabase.from("audit_logs" as any) as any).insert({
      staff_id: staffId || null,
      user_id: user.id,
      action,
      details: details || null,
    });
  } catch {
    // Never block on audit failure
  }
}
