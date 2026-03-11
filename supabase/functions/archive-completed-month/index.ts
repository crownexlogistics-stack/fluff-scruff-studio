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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Read optional { month, year } from request body
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
      const now = new Date();
      completedMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      completedYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    }

    // 2. Delete any existing live records for this month/year
    const { error: deleteError } = await supabaseAdmin
      .from("wix_historical_bookings")
      .delete()
      .eq("source", "live")
      .eq("created_month", completedMonth)
      .eq("created_year", completedYear);

    if (deleteError) {
      console.error("Delete error:", deleteError);
    }

    // 3. Build date range and query live bookings
    const startDate = `${completedYear}-${String(completedMonth).padStart(2, "0")}-01`;
    const endDate = completedMonth === 12
      ? `${completedYear + 1}-01-01`
      : `${completedYear}-${String(completedMonth + 1).padStart(2, "0")}-01`;

    const { data: liveBookings, error: fetchError } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, customer_name, customer_email, customer_phone, dog_name, booking_date, booking_time, total_price, status, staff_id, service_id, created_at"
      )
      .gte("booking_date", startDate)
      .lt("booking_date", endDate);

    if (fetchError) {
      throw new Error(`Failed to fetch bookings: ${fetchError.message}`);
    }

    if (!liveBookings || liveBookings.length === 0) {
      return new Response(
        JSON.stringify({ archived: 0, month: completedMonth, year: completedYear, message: "No bookings found for this month" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch staff names
    const staffIds = [...new Set(liveBookings.filter(b => b.staff_id).map(b => b.staff_id))];
    let staffMap: Record<string, string> = {};
    if (staffIds.length > 0) {
      const { data: staffData } = await supabaseAdmin
        .from("staff")
        .select("id, name")
        .in("id", staffIds);
      if (staffData) {
        staffData.forEach((s: any) => { staffMap[s.id] = s.name; });
      }
    }

    // Fetch service names
    const serviceIds = [...new Set(liveBookings.filter(b => b.service_id).map(b => b.service_id))];
    let serviceMap: Record<string, string> = {};
    if (serviceIds.length > 0) {
      const { data: serviceData } = await supabaseAdmin
        .from("services")
        .select("id, name")
        .in("id", serviceIds);
      if (serviceData) {
        serviceData.forEach((s: any) => { serviceMap[s.id] = s.name; });
      }
    }

    // 4. Map each booking to wix_historical_bookings schema
    const mappedRecords = liveBookings.map((b: any) => ({
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

    // 5. Insert all mapped records
    const { error: insertError } = await supabaseAdmin
      .from("wix_historical_bookings")
      .insert(mappedRecords);

    if (insertError) {
      throw new Error(`Insert error: ${insertError.message}`);
    }

    // 6. Return result
    return new Response(
      JSON.stringify({
        archived: mappedRecords.length,
        month: completedMonth,
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
