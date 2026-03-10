import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Determine which month to archive
    let completedMonth: number;
    let completedYear: number;

    try {
      const body = await req.json();
      if (body?.month && body?.year) {
        completedMonth = Number(body.month);
        completedYear = Number(body.year);
      } else {
        throw new Error("use auto");
      }
    } catch {
      // Auto-calculate most recently completed month
      const now = new Date();
      completedMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      completedYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    }

    // Build date range for the completed month
    const startDate = `${completedYear}-${String(completedMonth).padStart(2, "0")}-01`;
    const endMonth = completedMonth === 12 ? 1 : completedMonth + 1;
    const endYear = completedMonth === 12 ? completedYear + 1 : completedYear;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

    // Query live bookings for that month
    const { data: bookings, error: fetchError } = await supabase
      .from("bookings")
      .select(
        "id, customer_name, customer_email, customer_phone, dog_name, booking_date, booking_time, total_price, status, staff_id, service_id, created_at"
      )
      .gte("booking_date", startDate)
      .lt("booking_date", endDate);

    if (fetchError) {
      throw new Error(`Failed to fetch bookings: ${fetchError.message}`);
    }

    if (!bookings || bookings.length === 0) {
      return new Response(
        JSON.stringify({ archived: 0, month: completedMonth, year: completedYear, message: "No bookings found for this month" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch staff names for mapping
    const staffIds = [...new Set(bookings.filter(b => b.staff_id).map(b => b.staff_id))];
    let staffMap: Record<string, string> = {};
    if (staffIds.length > 0) {
      const { data: staffData } = await supabase
        .from("staff")
        .select("id, name")
        .in("id", staffIds);
      if (staffData) {
        staffData.forEach((s: any) => { staffMap[s.id] = s.name; });
      }
    }

    // Fetch service names
    const serviceIds = [...new Set(bookings.filter(b => b.service_id).map(b => b.service_id))];
    let serviceMap: Record<string, string> = {};
    if (serviceIds.length > 0) {
      const { data: serviceData } = await supabase
        .from("services")
        .select("id, name")
        .in("id", serviceIds);
      if (serviceData) {
        serviceData.forEach((s: any) => { serviceMap[s.id] = s.name; });
      }
    }

    // Map to wix_historical_bookings schema
    const archiveRows = bookings.map((b: any) => ({
      customer_name: b.customer_name || "",
      customer_email: b.customer_email?.toLowerCase().trim() || "",
      customer_phone: b.customer_phone || "",
      service_name: b.service_id ? (serviceMap[b.service_id] || "Booking") : "Booking",
      groomer_name: b.staff_id ? (staffMap[b.staff_id] || "") : "",
      appointment_date: b.booking_date ? `${b.booking_date}T${b.booking_time || "00:00:00"}` : null,
      booking_status: b.status || "Confirmed",
      payment_status: "Paid",
      price_charged: Number(b.total_price) || 0,
      dog_name: b.dog_name || "",
      dog_breed: "",
      registration_date: b.created_at || null,
      source: "live",
      created_month: completedMonth,
      created_year: completedYear,
      wix_order_number: `LIVE-${b.id}`,
      excluded_from_revenue: (b.status || "").toLowerCase().includes("cancel"),
      revenue_recognised: !(b.status || "").toLowerCase().includes("cancel"),
    }));

    // Upsert in batches
    const BATCH = 100;
    let archived = 0;
    for (let i = 0; i < archiveRows.length; i += BATCH) {
      const batch = archiveRows.slice(i, i + BATCH);
      const { error: upsertError } = await supabase
        .from("wix_historical_bookings")
        .upsert(batch, { onConflict: "wix_order_number", ignoreDuplicates: true });
      if (upsertError) {
        console.error("Batch upsert error:", upsertError);
      } else {
        archived += batch.length;
      }
    }

    const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    return new Response(
      JSON.stringify({
        archived,
        month: monthNames[completedMonth],
        monthNumber: completedMonth,
        year: completedYear,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Archive error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
