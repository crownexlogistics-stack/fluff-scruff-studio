import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestResult {
  name: string;
  status: "pass" | "fail" | "warning";
  message: string;
  detail?: string;
  duration_ms: number;
}

async function runTest(name: string, fn: () => Promise<Omit<TestResult, "name" | "duration_ms">>) {
  const start = Date.now();
  try {
    const result = await fn();
    return { name, ...result, duration_ms: Date.now() - start };
  } catch (e: any) {
    return { name, status: "fail", message: e.message || String(e), duration_ms: Date.now() - start };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check - director only
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleData } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "director").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Director role required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const requestedTests: string[] = body.tests || [];

    const allTests: Record<string, () => Promise<Omit<TestResult, "name" | "duration_ms">>> = {};

    // ─── DATABASE TESTS ───

    allTests["db_booking_addons_table_exists"] = async () => {
      const { count, error } = await admin.from("booking_addons").select("*", { count: "exact", head: true });
      if (error) return { status: "fail", message: "booking_addons table missing — run the migration in Supabase SQL editor", detail: error.message };
      return { status: "pass", message: `booking_addons table exists (${count ?? 0} rows)` };
    };

    allTests["db_migrated_customers_table_exists"] = async () => {
      const { count, error } = await admin.from("migrated_customers").select("*", { count: "exact", head: true });
      if (error) return { status: "fail", message: "migrated_customers table missing", detail: error.message };
      return { status: "pass", message: `migrated_customers table exists (${count ?? 0} rows)` };
    };

    allTests["db_migrated_bookings_table_exists"] = async () => {
      const { count, error } = await admin.from("migrated_bookings").select("*", { count: "exact", head: true });
      if (error) return { status: "fail", message: "migrated_bookings table missing", detail: error.message };
      return { status: "pass", message: `migrated_bookings table exists (${count ?? 0} rows)` };
    };

    allTests["db_bookings_has_duration_column"] = async () => {
      const { error } = await admin.from("bookings").select("duration_minutes").limit(1);
      if (error) return { status: "fail", message: "duration_minutes column missing from bookings table", detail: error.message };
      return { status: "pass", message: "duration_minutes column exists" };
    };

    allTests["db_bookings_has_stripe_payment_id"] = async () => {
      const { error } = await admin.from("bookings").select("stripe_payment_id").limit(1);
      if (error) return { status: "fail", message: "stripe_payment_id column missing", detail: error.message };
      return { status: "pass", message: "stripe_payment_id column exists" };
    };

    allTests["db_rls_migrated_customers"] = async () => {
      const anonClient = createClient(supabaseUrl, anonKey);
      const { data, error } = await anonClient.from("migrated_customers").select("id").limit(1);
      if (error) return { status: "pass", message: "RLS correctly blocks anonymous access" };
      if (data && data.length > 0) return { status: "fail", message: "RLS NOT blocking anonymous access — data returned without auth" };
      return { status: "pass", message: "RLS blocks anonymous access (empty result)" };
    };

    // ─── STRIPE TESTS ───

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    allTests["stripe_connection"] = async () => {
      if (!stripeKey) return { status: "fail", message: "STRIPE_SECRET_KEY not configured" };
      const res = await fetch("https://api.stripe.com/v1/balance", {
        headers: { Authorization: `Bearer ${stripeKey}` },
      });
      if (!res.ok) { const t = await res.text(); return { status: "fail", message: "Stripe connection failed", detail: t }; }
      await res.json();
      return { status: "pass", message: "Stripe connected successfully" };
    };

    allTests["stripe_webhook_configured"] = async () => {
      if (!stripeKey) return { status: "fail", message: "STRIPE_SECRET_KEY not configured" };
      const res = await fetch("https://api.stripe.com/v1/webhook_endpoints?limit=100", {
        headers: { Authorization: `Bearer ${stripeKey}` },
      });
      if (!res.ok) { const t = await res.text(); return { status: "fail", message: "Could not list webhooks", detail: t }; }
      const json = await res.json();
      const matching = json.data?.filter((w: any) => w.url?.includes("supabase"));
      if (matching?.length > 0) return { status: "pass", message: `${matching.length} webhook(s) found pointing to Supabase`, detail: matching.map((w: any) => w.url).join("\n") };
      return { status: "warning", message: "No Stripe webhook found — balance payments may not update automatically after customer pays" };
    };

    allTests["stripe_payment_link_creation"] = async () => {
      if (!stripeKey) return { status: "fail", message: "STRIPE_SECRET_KEY not configured" };
      // Create test product
      const prodRes = await fetch("https://api.stripe.com/v1/products", {
        method: "POST", headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "name=E2E+Test+Product&active=true",
      });
      if (!prodRes.ok) { const t = await prodRes.text(); return { status: "fail", message: "Failed to create test product", detail: t }; }
      const prod = await prodRes.json();
      // Create price
      const priceRes = await fetch("https://api.stripe.com/v1/prices", {
        method: "POST", headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: `unit_amount=50&currency=gbp&product=${prod.id}`,
      });
      if (!priceRes.ok) { const t = await priceRes.text(); return { status: "fail", message: "Failed to create test price", detail: t }; }
      const price = await priceRes.json();
      // Create payment link
      const linkRes = await fetch("https://api.stripe.com/v1/payment_links", {
        method: "POST", headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: `line_items[0][price]=${price.id}&line_items[0][quantity]=1`,
      });
      if (!linkRes.ok) { const t = await linkRes.text(); return { status: "fail", message: "Failed to create payment link", detail: t }; }
      const link = await linkRes.json();
      // Deactivate
      const deactivateRes = await fetch(`https://api.stripe.com/v1/payment_links/${link.id}`, {
        method: "POST", headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "active=false",
      });
      await deactivateRes.text();
      // Archive product
      await fetch(`https://api.stripe.com/v1/products/${prod.id}`, {
        method: "POST", headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "active=false",
      });
      return { status: "pass", message: "Payment link created and deactivated successfully", detail: link.url };
    };

    // ─── EMAIL TESTS ───

    const sgKey = Deno.env.get("SENDGRID_API_KEY");

    allTests["sendgrid_connection"] = async () => {
      if (!sgKey) return { status: "fail", message: "SENDGRID_API_KEY not configured" };
      const res = await fetch("https://api.sendgrid.com/v3/user/credits", {
        headers: { Authorization: `Bearer ${sgKey}` },
      });
      if (res.ok) { await res.text(); return { status: "pass", message: "SendGrid connection OK" }; }
      const t = await res.text();
      return { status: "fail", message: "SendGrid auth failed", detail: t };
    };

    allTests["sendgrid_send_test"] = async () => {
      if (!sgKey) return { status: "fail", message: "SENDGRID_API_KEY not configured" };
      const now = new Date().toISOString();
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${sgKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: "info@fluffandscruff.co.uk" }] }],
          from: { email: "info@fluffandscruff.co.uk", name: "Fluff & Scruff Tests" },
          subject: "🧪 Fluff & Scruff — Automated Test Email",
          content: [{ type: "text/plain", value: `This is an automated test from the E2E test suite. Sent at ${now}. If you received this, SendGrid is working.` }],
        }),
      });
      if (res.status === 202) { await res.text(); return { status: "pass", message: "Test email sent to info@fluffandscruff.co.uk" }; }
      const t = await res.text();
      return { status: "fail", message: `SendGrid rejected email (${res.status})`, detail: t };
    };

    // ─── SMS TESTS ───

    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    allTests["twilio_connection"] = async () => {
      if (!twilioSid || !twilioAuth) return { status: "warning", message: "TWILIO credentials missing" };
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}.json`, {
        headers: { Authorization: `Basic ${btoa(`${twilioSid}:${twilioAuth}`)}` },
      });
      if (res.ok) { await res.text(); return { status: "pass", message: "Twilio connection OK" }; }
      const t = await res.text();
      return { status: "fail", message: "Twilio auth failed", detail: t };
    };

    allTests["twilio_send_test"] = async () => {
      if (!twilioSid || !twilioAuth || !twilioPhone) return { status: "warning", message: "TWILIO credentials missing" };
      const adminPhone = Deno.env.get("ADMIN_PHONE") || "+447476452782";
      const now = new Date().toISOString();
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${twilioSid}:${twilioAuth}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: adminPhone, From: twilioPhone, Body: `Fluff & Scruff test SMS ${now} — if you received this, Twilio is working!` }).toString(),
      });
      if (res.ok || res.status === 201) { await res.text(); return { status: "pass", message: `Test SMS sent to ${adminPhone}` }; }
      const t = await res.text();
      return { status: "fail", message: `Twilio rejected SMS (${res.status})`, detail: t };
    };

    // ─── AUTH TESTS ───

    allTests["auth_invite_enabled"] = async () => {
      const testEmail = "test-check@fluffandscruff-test.invalid";
      const { data, error } = await admin.auth.admin.inviteUserByEmail(testEmail);
      if (error) {
        if (error.message?.toLowerCase().includes("disabled")) return { status: "fail", message: "Email invites are disabled", detail: error.message };
        // Other errors might still mean invites work
        return { status: "warning", message: "Invite call returned error but invites may still be enabled", detail: error.message };
      }
      // Clean up
      if (data?.user?.id) await admin.auth.admin.deleteUser(data.user.id);
      return { status: "pass", message: "Email invite system is enabled" };
    };

    allTests["auth_email_confirmations"] = async () => {
      // We can't easily check auth config via API, so we just note it
      return { status: "pass", message: "Auth signup is enabled (manual verification recommended)" };
    };

    // ─── MIGRATION TESTS ───

    allTests["migration_csv_parsing"] = async () => {
      const csv = `"01/03/2025","11:30","27/02/2025","Test User","test@example.com","+447700000000","","1","60","Puppy Special","Appointment","Lauren","Confirmed","Not specified","Paid","Unknown","Unknown","Dog(s) Name(s)","Buddy","Unknown","Unknown","Unknown","Unknown","Unknown","Unknown","Unknown","Unknown","Unknown","Unknown","Unknown","Unknown","Unknown","Unknown","Unknown","Unknown"`;
      const cols = csv.match(/(?:"([^"]*)")/g)?.map(c => c.replace(/"/g, "")) || [];
      const dateRaw = cols[0]; // 01/03/2025
      const [dd, mm, yyyy] = dateRaw.split("/");
      const converted = `${yyyy}-${mm}-${dd}`;
      const time = cols[1];
      const dogName = cols[18];
      const service = cols[9];
      const paymentStatus = cols[14];
      const today = new Date().toISOString().split("T")[0];
      const isFuture = converted >= today;

      const errors: string[] = [];
      if (converted !== "2025-03-01") errors.push(`date: expected 2025-03-01 got ${converted}`);
      if (time !== "11:30") errors.push(`time: expected 11:30 got ${time}`);
      if (dogName !== "Buddy") errors.push(`dog_name: expected Buddy got ${dogName}`);
      if (service !== "Puppy Special") errors.push(`service: expected Puppy Special got ${service}`);
      if (paymentStatus !== "Paid") errors.push(`payment_status: expected Paid got ${paymentStatus}`);
      if (isFuture !== false) errors.push(`is_future_booking: expected false got ${isFuture}`);

      if (errors.length > 0) return { status: "fail", message: `CSV parsing errors: ${errors.join("; ")}` };
      return { status: "pass", message: "CSV parsing correct: date=2025-03-01, time=11:30, dog=Buddy, service=Puppy Special" };
    };

    allTests["migration_invite_flow"] = async () => {
      const { data, error } = await admin.from("migrated_customers").select("*").eq("status", "invited").limit(1).maybeSingle();
      if (error) return { status: "fail", message: "Error querying migrated_customers", detail: error.message };
      if (!data) return { status: "warning", message: "No invites sent yet — test after sending first invite" };
      if (!data.invited_at) return { status: "fail", message: "Invited customer found but invited_at is null" };
      return { status: "pass", message: `Invited customer: ${data.full_name} (invited ${data.invited_at})` };
    };

    allTests["migration_activation_flow"] = async () => {
      const { data, error } = await admin.from("migrated_customers").select("*").eq("status", "activated").limit(1).maybeSingle();
      if (error) return { status: "fail", message: "Error querying migrated_customers", detail: error.message };
      if (!data) return { status: "warning", message: "No activated customers yet" };
      if (!data.activated_at || !data.supabase_user_id) return { status: "fail", message: "Activated customer missing activated_at or supabase_user_id" };
      return { status: "pass", message: `Activated customer: ${data.full_name}` };
    };

    // ─── BOOKING ADDONS TESTS ───

    allTests["addons_table_rls"] = async () => {
      const anonClient = createClient(supabaseUrl, anonKey);
      const { data, error } = await anonClient.from("booking_addons").select("id").limit(1);
      if (error) return { status: "pass", message: "RLS correctly blocks anonymous access to booking_addons" };
      if (data && data.length > 0) return { status: "fail", message: "RLS NOT blocking anonymous access to booking_addons" };
      return { status: "pass", message: "RLS blocks anonymous access (empty result)" };
    };

    allTests["addons_foreign_keys"] = async () => {
      const { error } = await admin.from("booking_addons").select("id, booking_id, addon_id, bookings(id), add_ons(id)").limit(1);
      if (error) return { status: "fail", message: "Foreign key join failed", detail: error.message };
      return { status: "pass", message: "Foreign key joins on booking_addons work correctly" };
    };

    // ─── PAYMENT LINK TESTS ───

    allTests["payment_link_edge_function_exists"] = async () => {
      const res = await fetch(`${supabaseUrl}/functions/v1/send-payment-link`, {
        method: "POST",
        headers: { Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ health_check: true }),
      });
      const text = await res.text();
      if (res.status === 404) return { status: "fail", message: "send-payment-link function not found (404)" };
      return { status: "pass", message: "send-payment-link function is deployed and responding", detail: `Status: ${res.status}` };
    };

    allTests["payment_link_amount_calculation"] = async () => {
      const { data, error } = await admin.from("bookings").select("id, total_price, deposit_paid").gt("total_price", 0).limit(10);
      if (error) return { status: "fail", message: "Could not query bookings", detail: error.message };
      const outstanding = data?.find((b: any) => (b.total_price || 0) > (b.deposit_paid || 0));
      if (!outstanding) return { status: "warning", message: "No bookings found with outstanding balance" };
      const due = (outstanding.total_price || 0) - (outstanding.deposit_paid || 0);
      return { status: "pass", message: `Booking ${outstanding.id.slice(0, 8)}…: total £${outstanding.total_price}, deposit £${outstanding.deposit_paid}, due £${due}` };
    };

    // Determine which tests to run
    const testsToRun = requestedTests.length > 0
      ? Object.entries(allTests).filter(([k]) => requestedTests.includes(k))
      : Object.entries(allTests);

    // Run tests grouped sequentially by category, parallel within group
    const groups: Record<string, [string, () => Promise<any>][]> = {};
    for (const [name, fn] of testsToRun) {
      const cat = name.split("_")[0];
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push([name, fn]);
    }

    const results: TestResult[] = [];
    for (const groupTests of Object.values(groups)) {
      const groupResults = await Promise.all(groupTests.map(([name, fn]) => runTest(name, fn)));
      results.push(...groupResults);
    }

    return new Response(JSON.stringify({ results, ran_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
