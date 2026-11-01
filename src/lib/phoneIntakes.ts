import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const intakeDetailsSchema = z.object({
  first_name: z.string().trim().min(1, "Enter your first name").max(100),
  surname: z.string().trim().min(1, "Enter your surname").max(100),
  email: z.string().trim().email("Enter a valid email address").max(255),
  dog_name: z.string().trim().min(1, "Enter your dog's name").max(100),
  breed: z.string().trim().min(1, "Enter the breed or crossbreed").max(120),
  notes: z.string().trim().max(4000),
  alternatives: z.string().trim().max(2000),
});
export type IntakePhoto = { path: string; name: string; type: string; size: number };
export type PhoneIntake = {
  id: string; token: string; created_at: string; created_by_name: string; phone: string;
  status: "awaiting" | "submitted" | "booked" | "closed"; first_name: string | null;
  surname: string | null; email: string | null; dog_name: string | null; breed: string | null;
  notes: string | null; alternatives: string | null; attachments: IntakePhoto[];
  submitted_at: string | null; slot_date: string | null; slot_time: string | null;
  staff_id: string | null; service_id: string | null; duration_minutes: number;
  hold_expires_at: string | null; hold_released_at: string | null; booking_id: string | null;
};
export function normalizeIntakeMobile(value: string) {
  const clean = value.replace(/[\s()-]/g, "");
  if (!/^(07\d{9}|\+447\d{9})$/.test(clean)) throw new Error("Enter a valid UK mobile number");
  return clean;
}
export function holdIsActive(row: Pick<PhoneIntake, "hold_expires_at" | "hold_released_at" | "status">, now = Date.now()) {
  return (row.status === "awaiting" || row.status === "submitted") && !row.hold_released_at && !!row.hold_expires_at && Date.parse(row.hold_expires_at) > now;
}
export function intakeLink(token: string) { return `https://fluffandscruff.co.uk/intake/${token}`; }
export async function intakeAction<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("phone-intake", { body });
  if (error) {
    const response = error.context;
    if (response instanceof Response) {
      const payload = await response.json().catch(() => null);
      if (payload?.error) throw new Error(payload.error);
    }
    throw new Error("Couldn't connect. Please try again.");
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}