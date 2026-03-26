import { supabase } from "@/integrations/supabase/client";

interface ActivityLogEntry {
  staffId: string;
  actionType: string;
  actionSummary: string;
  bookingId?: string;
  customerName?: string;
  dogName?: string;
  bookingDate?: string;
  bookingTime?: string;
  serviceName?: string;
  extraDetails?: Record<string, any>;
}

export async function logGroomerActivity(entry: ActivityLogEntry) {
  try {
    await supabase.from("groomer_activity_log" as any).insert({
      staff_id: entry.staffId,
      action_type: entry.actionType,
      action_summary: entry.actionSummary,
      booking_id: entry.bookingId || null,
      customer_name: entry.customerName || null,
      dog_name: entry.dogName || null,
      booking_date: entry.bookingDate || null,
      booking_time: entry.bookingTime || null,
      service_name: entry.serviceName || null,
      extra_details: entry.extraDetails || null,
    } as any);
  } catch (e) {
    console.error("Failed to log groomer activity:", e);
  }
}
