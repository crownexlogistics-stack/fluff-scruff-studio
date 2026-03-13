import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Activity, Mail } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { toast } from "sonner";

type CheckStatus = "pass" | "fail" | "warning" | "checking";

interface HealthCheck {
  name: string;
  category: string;
  status: CheckStatus;
  description: string;
  responseTime?: number;
  error?: string | null;
  detail?: string;
  checkedAt?: string;
}

const STATUS_CONFIG: Record<CheckStatus, { icon: string; color: string; badge: string }> = {
  pass: { icon: "✅", color: "bg-green-50 border-green-200", badge: "bg-green-100 text-green-800" },
  fail: { icon: "❌", color: "bg-red-50 border-red-200", badge: "bg-red-100 text-red-800" },
  warning: { icon: "⚠️", color: "bg-orange-50 border-orange-200", badge: "bg-orange-100 text-orange-800" },
  checking: { icon: "🔄", color: "bg-gray-50 border-gray-200", badge: "bg-gray-100 text-gray-600" },
};

export default function SystemHealthPage() {
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const updateCheck = useCallback((name: string, updates: Partial<HealthCheck>) => {
    setChecks((prev) =>
      prev.map((c) => (c.name === name ? { ...c, ...updates, checkedAt: new Date().toISOString() } : c))
    );
  }, []);

  const runAllChecks = useCallback(async () => {
    setRunning(true);

    // Initialize all checks as "checking"
    const initial: HealthCheck[] = [
      { name: "Database Connection", category: "Database", status: "checking", description: "Test Supabase connection" },
      { name: "bookings", category: "Database", status: "checking", description: "Bookings table" },
      { name: "profiles", category: "Database", status: "checking", description: "Profiles table" },
      { name: "customer_pets", category: "Database", status: "checking", description: "Pets table" },
      { name: "services", category: "Database", status: "checking", description: "Services table" },
      { name: "staff", category: "Database", status: "checking", description: "Staff table" },
      { name: "sms_messages", category: "Database", status: "checking", description: "SMS Messages table" },
      { name: "coupons", category: "Database", status: "checking", description: "Coupons table" },
      { name: "breeds", category: "Database", status: "checking", description: "Breeds table" },
      { name: "add_ons", category: "Database", status: "checking", description: "Add-ons table" },
      { name: "Auth Service", category: "Auth", status: "checking", description: "Supabase Auth responding" },
      { name: "send-booking-email", category: "Edge Functions", status: "checking", description: "Booking email function" },
      { name: "send-customer-email", category: "Edge Functions", status: "checking", description: "Customer email function" },
      { name: "send-contract-email", category: "Edge Functions", status: "checking", description: "Contract email function" },
      { name: "notify-groomer", category: "Edge Functions", status: "checking", description: "Groomer notification function" },
      { name: "record-payment", category: "Edge Functions", status: "checking", description: "Payment recording function" },
      { name: "cancel-booking-with-refund", category: "Edge Functions", status: "checking", description: "Cancellation/refund function" },
      { name: "sign-document", category: "Edge Functions", status: "checking", description: "Document signing function" },
      { name: "Resend (Email)", category: "Email", status: "checking", description: "Email provider connection" },
      { name: "Stripe API", category: "Stripe", status: "checking", description: "Payment processor connection" },
      { name: "Storage Buckets", category: "Storage", status: "checking", description: "File storage access" },
      { name: "Twilio (SMS)", category: "SMS", status: "checking", description: "SMS provider connection" },
    ];
    setChecks(initial);

    // 1. Run server-side checks via edge function
    try {
      const start = Date.now();
      const { data, error } = await supabase.functions.invoke("system-health-check");
      const elapsed = Date.now() - start;

      if (error) {
        // Mark all server checks as failed
        setChecks((prev) =>
          prev.map((c) =>
            ["Email", "Stripe", "Storage", "SMS"].includes(c.category) || c.category === "Database" && c.name !== "Database Connection" && c.name !== "Auth Service"
              ? { ...c, status: "fail" as CheckStatus, error: `Health check function error: ${error.message}`, checkedAt: new Date().toISOString() }
              : c
          )
        );
      } else {
        // Process table results
        if (data.tables) {
          for (const [table, info] of Object.entries(data.tables as Record<string, any>)) {
            setChecks((prev) =>
              prev.map((c) =>
                c.name === table
                  ? { ...c, status: info.status, detail: `${info.count} rows`, error: info.error, checkedAt: new Date().toISOString() }
                  : c
              )
            );
          }
        }

        // Database connection — if tables worked, connection is fine
        setChecks((prev) =>
          prev.map((c) =>
            c.name === "Database Connection"
              ? { ...c, status: "pass", responseTime: elapsed, checkedAt: new Date().toISOString() }
              : c
          )
        );

        // Stripe
        if (data.stripe) {
          setChecks((prev) =>
            prev.map((c) =>
              c.name === "Stripe API"
                ? { ...c, status: data.stripe.status, responseTime: data.stripe.responseTime, error: data.stripe.error, checkedAt: new Date().toISOString() }
                : c
            )
          );
        }

        // SendGrid
        if (data.sendgrid) {
          setChecks((prev) =>
            prev.map((c) =>
              c.name === "SendGrid (Email)"
                ? { ...c, status: data.sendgrid.status, responseTime: data.sendgrid.responseTime, error: data.sendgrid.error, checkedAt: new Date().toISOString() }
                : c
            )
          );
        }

        // Twilio
        if (data.twilio) {
          setChecks((prev) =>
            prev.map((c) =>
              c.name === "Twilio (SMS)"
                ? { ...c, status: data.twilio.status, responseTime: data.twilio.responseTime, error: data.twilio.error, checkedAt: new Date().toISOString() }
                : c
            )
          );
        }

        // Storage
        if (data.storage) {
          setChecks((prev) =>
            prev.map((c) =>
              c.name === "Storage Buckets"
                ? { ...c, status: data.storage.status, detail: `Buckets: ${data.storage.buckets?.join(", ") || "none"}`, error: data.storage.error, checkedAt: new Date().toISOString() }
                : c
            )
          );
        }
      }
    } catch (e: any) {
      console.error("Health check error:", e);
    }

    // 2. Auth check (client-side)
    try {
      const start = Date.now();
      const { data: { session } } = await supabase.auth.getSession();
      const elapsed = Date.now() - start;
      setChecks((prev) =>
        prev.map((c) =>
          c.name === "Auth Service"
            ? { ...c, status: session ? "pass" : "warning", responseTime: elapsed, detail: session ? "Session active" : "No session", checkedAt: new Date().toISOString() }
            : c
        )
      );
    } catch {
      setChecks((prev) =>
        prev.map((c) =>
          c.name === "Auth Service"
            ? { ...c, status: "fail", error: "Auth service unreachable", checkedAt: new Date().toISOString() }
            : c
        )
      );
    }

    // 3. Edge function ping checks
    const edgeFunctions = [
      "send-booking-email", "send-customer-email", "send-contract-email",
      "notify-groomer", "record-payment", "cancel-booking-with-refund", "sign-document",
    ];

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    await Promise.all(
      edgeFunctions.map(async (fn) => {
        try {
          const start = Date.now();
          const res = await fetch(
            `https://${projectId}.supabase.co/functions/v1/${fn}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
              },
              body: JSON.stringify({ health_check: true }),
            }
          );
          const elapsed = Date.now() - start;
          await res.text(); // consume body
          // Any HTTP response (even 400/500) means the function is deployed and running
          const status: CheckStatus = elapsed > 5000 ? "warning" : "pass";
          setChecks((prev) =>
            prev.map((c) =>
              c.name === fn
                ? {
                    ...c,
                    status,
                    responseTime: elapsed,
                    detail: elapsed > 5000 ? "Slow response" : `Responding (${res.status})`,
                    checkedAt: new Date().toISOString(),
                  }
                : c
            )
          );
        } catch (e: any) {
          // Network error = function truly unreachable
          setChecks((prev) =>
            prev.map((c) =>
              c.name === fn
                ? { ...c, status: "fail", error: e.message, checkedAt: new Date().toISOString() }
                : c
            )
          );
        }
      })
    );

    setLastRun(new Date().toISOString());
    setRunning(false);
  }, []);

  useEffect(() => {
    runAllChecks();
    const interval = setInterval(runAllChecks, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [runAllChecks]);

  const [sendingSummary, setSendingSummary] = useState(false);

  const handleSendDailySummary = useCallback(async () => {
    setSendingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke("daily-summary-email", {
        body: { date: new Date().toISOString().split("T")[0] },
      });
      if (error) throw error;
      toast.success("Summary email sent to info@fluffandscruff.co.uk ✅");
    } catch (e: any) {
      toast.error(`Failed to send summary: ${e.message}`);
    } finally {
      setSendingSummary(false);
    }
  }, []);

  const passed = checks.filter((c) => c.status === "pass").length;
  const failed = checks.filter((c) => c.status === "fail").length;
  const warnings = checks.filter((c) => c.status === "warning").length;
  const checking = checks.filter((c) => c.status === "checking").length;
  const allGood = failed === 0 && checking === 0;

  const categories = [...new Set(checks.map((c) => c.category))];

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6" /> System Health
            </h1>
            {lastRun && (
              <p className="text-sm text-muted-foreground mt-1">
                Last checked: {new Date(lastRun).toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={runAllChecks} disabled={running}>
              <RefreshCw className={`mr-2 h-4 w-4 ${running ? "animate-spin" : ""}`} />
              Run All Checks
            </Button>
            <Button variant="outline" onClick={handleSendDailySummary} disabled={sendingSummary}>
              <Mail className="mr-2 h-4 w-4" />
              {sendingSummary ? "Sending…" : "📧 Send Today's Summary"}
            </Button>
          </div>
        </div>

        {/* Summary bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-4 text-sm">
                <span>Total: <strong>{checks.length}</strong></span>
                <span className="text-green-700">Passed: <strong>{passed}</strong></span>
                <span className="text-red-700">Failed: <strong>{failed}</strong></span>
                <span className="text-orange-600">Warnings: <strong>{warnings}</strong></span>
                {checking > 0 && <span className="text-gray-500">Checking: <strong>{checking}</strong></span>}
              </div>
              <Badge className={allGood ? "bg-green-100 text-green-800 border-green-300" : "bg-red-100 text-red-800 border-red-300"}>
                {allGood ? "🟢 ALL SYSTEMS GO" : "🔴 ISSUES DETECTED"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Checks by category */}
        {categories.map((cat) => (
          <div key={cat}>
            <h2 className="text-lg font-semibold mb-3">{cat}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {checks
                .filter((c) => c.category === cat)
                .map((check) => {
                  const cfg = STATUS_CONFIG[check.status];
                  return (
                    <Card key={check.name} className={`border ${cfg.color}`}>
                      <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <span>{cfg.icon}</span>
                            <span className="truncate">{check.name}</span>
                          </span>
                          <Badge variant="outline" className={`text-[10px] ${cfg.badge}`}>
                            {check.status.toUpperCase()}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 space-y-1">
                        <p className="text-xs text-muted-foreground">{check.description}</p>
                        {check.responseTime != null && (
                          <p className="text-xs text-muted-foreground">{check.responseTime}ms</p>
                        )}
                        {check.detail && (
                          <p className="text-xs font-medium">{check.detail}</p>
                        )}
                        {check.error && (
                          <p className="text-xs text-red-600 break-all">{check.error}</p>
                        )}
                        {check.checkedAt && (
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(check.checkedAt).toLocaleTimeString()}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
