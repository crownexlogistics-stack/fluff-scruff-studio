import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhoneToE164 } from "@/hooks/useUnreadSmsCount";

export interface GroomerDayBooking {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  dog_name: string;
  booking_date: string;
  booking_time: string;
  status: string;
  notes: string | null;
  total_price: number;
  deposit_paid: number;
  deposit_link_sent_at: string | null;
  booking_source: string | null;
  service_name: string;
  breed_name: string;
}

export function useGroomerDay(staffId: string) {
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const futureEnd = format(addDays(now, 90), "yyyy-MM-dd");
  const rangeStart = monthStart < weekStart ? monthStart : weekStart;

  const bookingsQ = useQuery({
    queryKey: ["groomer-day-bookings", staffId, rangeStart, futureEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, customer_name, customer_email, customer_phone, dog_name, booking_date, booking_time, status, notes, total_price, deposit_paid, deposit_link_sent_at, booking_source, services:service_id(name), breeds:breed_id(name)")
        .eq("staff_id", staffId)
        .gte("booking_date", rangeStart)
        .lte("booking_date", futureEnd)
        .order("booking_date")
        .order("booking_time");
      if (error) throw error;
      return (data || []).map((booking): GroomerDayBooking => ({
        id: booking.id,
        customer_name: booking.customer_name || "Customer",
        customer_email: booking.customer_email,
        customer_phone: booking.customer_phone,
        dog_name: booking.dog_name || "Dog",
        booking_date: booking.booking_date,
        booking_time: booking.booking_time || "00:00",
        status: booking.status,
        notes: booking.notes,
        total_price: Number(booking.total_price || 0),
        deposit_paid: Number(booking.deposit_paid || 0),
        deposit_link_sent_at: booking.deposit_link_sent_at,
        booking_source: booking.booking_source,
        service_name: booking.services?.name || "Service not set",
        breed_name: booking.breeds?.name || "",
      }));
    },
  });

  const commissionsQ = useQuery({
    queryKey: ["groomer-day-commissions", staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_records")
        .select("groomer_pay, created_at")
        .eq("staff_id", staffId);
      if (error) throw error;
      return data || [];
    },
  });

  const customerEmails = useMemo(
    () => [...new Set((bookingsQ.data || []).map((booking) => booking.customer_email).filter((email): email is string => Boolean(email)))],
    [bookingsQ.data],
  );
  const customerPhones = useMemo(
    () => [...new Set((bookingsQ.data || []).map((booking) => booking.customer_phone).filter((phone): phone is string => Boolean(phone)).map(normalizePhoneToE164))],
    [bookingsQ.data],
  );

  const notesQ = useQuery({
    queryKey: ["groomer-day-notes", customerEmails.join("|")],
    enabled: customerEmails.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_notes")
        .select("customer_email, note, created_at")
        .in("customer_email", customerEmails)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const map = new Map<string, { note: string; created_at: string }[]>();
      for (const row of data || []) {
        const key = row.customer_email.toLowerCase();
        const list = map.get(key) || [];
        if (list.length < 3) list.push({ note: row.note, created_at: row.created_at });
        map.set(key, list);
      }
      return map;
    },
  });

  const historyQ = useQuery({
    queryKey: ["groomer-day-history", staffId, customerEmails.join("|")],
    enabled: customerEmails.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("customer_email, booking_date")
        .eq("staff_id", staffId)
        .eq("status", "Completed")
        .lt("booking_date", today)
        .in("customer_email", customerEmails)
        .order("booking_date", { ascending: false });
      if (error) throw error;
      const map = new Map<string, { count: number; lastVisit: string }>();
      for (const row of data || []) {
        if (!row.customer_email) continue;
        const key = row.customer_email.toLowerCase();
        const current = map.get(key);
        map.set(key, { count: (current?.count || 0) + 1, lastVisit: current?.lastVisit || row.booking_date });
      }
      return map;
    },
  });

  const unreadQ = useQuery({
    queryKey: ["groomer-day-unread", staffId, customerPhones.join("|")],
    enabled: customerPhones.length > 0,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("sms_messages")
        .select("id", { count: "exact", head: true })
        .eq("direction", "inbound")
        .eq("is_read", false)
        .in("phone_number", customerPhones);
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 10000,
  });

  const bookings = bookingsQ.data || [];
  const todayBookings = bookings.filter((booking) => booking.booking_date === today);
  const activeToday = todayBookings.filter((booking) => !["Cancelled", "Refunded"].includes(booking.status));
  const completedToday = activeToday.filter((booking) => booking.status === "Completed");
  const remainingToday = activeToday.filter((booking) => ["Confirmed", "Pending"].includes(booking.status));
  const scheduledToday = activeToday.reduce((sum, booking) => sum + booking.total_price, 0);
  const currentTime = format(now, "HH:mm");
  const nextAppointment = bookings.find((booking) => {
    if (!["Confirmed", "Pending"].includes(booking.status)) return false;
    return booking.booking_date > today || (booking.booking_date === today && booking.booking_time.slice(0, 5) >= currentTime);
  }) || remainingToday[0] || null;

  const commissions = commissionsQ.data || [];
  const earningsFor = (start: string, end?: string) => {
    const rows = commissions.filter((row) => {
      const date = row.created_at.slice(0, 10);
      return date >= start && (!end || date <= end);
    });
    return { amount: rows.reduce((sum, row) => sum + Number(row.groomer_pay || 0), 0), count: rows.length };
  };

  const completedWeek = bookings.filter((booking) => booking.booking_date >= weekStart && booking.booking_date <= weekEnd && booking.status === "Completed").length;
  const completedMonth = bookings.filter((booking) => booking.booking_date >= monthStart && booking.booking_date <= monthEnd && booking.status === "Completed").length;
  const upcoming = bookings.filter((booking) => booking.booking_date >= today && ["Confirmed", "Pending"].includes(booking.status)).slice(0, 5);
  const missingDeposits = bookings.filter((booking) => booking.booking_date >= today && ["Confirmed", "Pending"].includes(booking.status) && booking.deposit_paid <= 0);

  return {
    isLoading: bookingsQ.isLoading || commissionsQ.isLoading,
    today,
    todayBookings,
    activeToday,
    completedToday,
    remainingToday,
    scheduledToday,
    nextAppointment,
    upcoming,
    missingDeposits,
    unreadMessages: unreadQ.data || 0,
    notesByEmail: notesQ.data || new Map(),
    historyByEmail: historyQ.data || new Map(),
    earnings: {
      week: earningsFor(weekStart, weekEnd),
      month: earningsFor(monthStart, monthEnd),
      all: { amount: commissions.reduce((sum, row) => sum + Number(row.groomer_pay || 0), 0), count: commissions.length },
    },
    performance: { completedWeek, completedMonth },
  };
}
