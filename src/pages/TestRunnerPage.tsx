import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Play, RefreshCw, ClipboardCopy } from "lucide-react";
import { toast } from "sonner";

interface TestResult {
  name: string;
  status: "pass" | "fail" | "warning" | "running" | "not_run";
  message: string;
  detail?: string;
  duration_ms: number;
}

const TEST_GROUPS: Record<string, { label: string; tests: { key: string; label: string }[] }> = {
  db: {
    label: "Database",
    tests: [
      { key: "db_booking_addons_table_exists", label: "Booking Add-ons Table" },
      { key: "db_migrated_customers_table_exists", label: "Migrated Customers Table" },
      { key: "db_migrated_bookings_table_exists", label: "Migrated Bookings Table" },
      { key: "db_bookings_has_duration_column", label: "Bookings Duration Column" },
      { key: "db_bookings_has_stripe_payment_id", label: "Bookings Stripe Payment ID" },
      { key: "db_rls_migrated_customers", label: "RLS on Migrated Customers" },
    ],
  },
  stripe: {
    label: "Stripe",
    tests: [
      { key: "stripe_connection", label: "Stripe Connection" },
      { key: "stripe_webhook_configured", label: "Stripe Webhooks" },
      { key: "stripe_payment_link_creation", label: "Payment Link Creation" },
    ],
  },
  sendgrid: {
    label: "Email",
    tests: [
      { key: "sendgrid_connection", label: "SendGrid Connection" },
      { key: "sendgrid_send_test", label: "SendGrid Send Test" },
    ],
  },
  twilio: {
    label: "SMS",
    tests: [
      { key: "twilio_connection", label: "Twilio Connection" },
      { key: "twilio_send_test", label: "Twilio Send Test" },
    ],
  },
  auth: {
    label: "Auth",
    tests: [
      { key: "auth_invite_enabled", label: "Email Invite System" },
      { key: "auth_email_confirmations", label: "Email Confirmations" },
    ],
  },
  migration: {
    label: "Migration",
    tests: [
      { key: "migration_csv_parsing", label: "CSV Parsing" },
      { key: "migration_invite_flow", label: "Invite Flow" },
      { key: "migration_activation_flow", label: "Activation Flow" },
    ],
  },
  addons: {
    label: "Add-ons",
    tests: [
      { key: "addons_table_rls", label: "Add-ons Table RLS" },
      { key: "addons_foreign_keys", label: "Add-ons Foreign Keys" },
    ],
  },
  payment: {
    label: "Payment Links",
    tests: [
      { key: "payment_link_edge_function_exists", label: "Edge Function Exists" },
      { key: "payment_link_amount_calculation", label: "Amount Calculation" },
    ],
  },
};

const allTestKeys = Object.values(TEST_GROUPS).flatMap((g) => g.tests.map((t) => t.key));

const statusIcon = (s: TestResult["status"]) => {
  switch (s) {
    case "pass": return "✅";
    case "fail": return "❌";
    case "warning": return "⚠️";
    case "running": return "🔄";
    default: return "⬜";
  }
};

export default function TestRunnerPage() {
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const firstFailRef = useRef<HTMLDivElement | null>(null);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const runTests = useCallback(async (testsToRun: string[]) => {
    setRunning(true);
    // Mark all as running
    const initial: Record<string, TestResult> = {};
    testsToRun.forEach((k) => {
      initial[k] = { name: k, status: "running", message: "Running…", duration_ms: 0 };
    });
    setResults((prev) => ({ ...prev, ...initial }));

    try {
      const { data, error } = await supabase.functions.invoke("run-e2e-tests", {
        body: { tests: testsToRun },
      });

      if (error) {
        toast.error("Test suite error: " + error.message);
        testsToRun.forEach((k) => {
          initial[k] = { name: k, status: "fail", message: error.message, duration_ms: 0 };
        });
        setResults((prev) => ({ ...prev, ...initial }));
      } else {
        const map: Record<string, TestResult> = {};
        (data.results || []).forEach((r: TestResult) => {
          map[r.name] = r;
        });
        setResults((prev) => ({ ...prev, ...map }));
        setLastRun(data.ran_at || new Date().toISOString());

        // Scroll to first fail
        setTimeout(() => firstFailRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
      }
    } catch (e: any) {
      toast.error("Failed to invoke test function");
    }
    setRunning(false);
  }, []);

  const resultList = Object.values(results);
  const passed = resultList.filter((r) => r.status === "pass").length;
  const failed = resultList.filter((r) => r.status === "fail").length;
  const warnings = resultList.filter((r) => r.status === "warning").length;
  const total = resultList.filter((r) => r.status !== "running" && r.status !== "not_run").length;

  const copyReport = () => {
    const lines = [
      `Fluff & Scruff E2E Test Report — ${new Date().toLocaleString()}`,
      `Passed: ${passed} | Failed: ${failed} | Warnings: ${warnings}`,
      "",
      ...resultList.map((r) => `${statusIcon(r.status)} ${r.name}: ${r.message}${r.detail ? ` (${r.detail})` : ""} [${r.duration_ms}ms]`),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Report copied to clipboard");
  };

  let firstFailAssigned = false;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">🧪 End-to-End Test Suite</h1>
            <p className="text-muted-foreground text-sm">Automated checks for all critical systems</p>
            {lastRun && <p className="text-xs text-muted-foreground mt-1">Last run: {new Date(lastRun).toLocaleString()}</p>}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => runTests(allTestKeys)} disabled={running} className="bg-primary">
              <Play className="mr-2 h-4 w-4" /> Run All Tests
            </Button>
            <Button variant="outline" onClick={() => runTests([...selected])} disabled={running || selected.size === 0}>
              Run Selected ({selected.size})
            </Button>
            {total > 0 && (
              <Button variant="outline" onClick={copyReport}>
                <ClipboardCopy className="mr-2 h-4 w-4" /> Copy Report
              </Button>
            )}
          </div>
        </div>

        {/* Summary */}
        {total > 0 && (
          <Card>
            <CardContent className="py-4 flex flex-wrap items-center gap-3">
              <Badge variant="secondary">{total} Total</Badge>
              <Badge className="bg-green-600 text-white">{passed} Passed</Badge>
              {failed > 0 && <Badge variant="destructive">{failed} Failed</Badge>}
              {warnings > 0 && <Badge className="bg-yellow-500 text-white">{warnings} Warnings</Badge>}
              <span className="ml-auto font-semibold text-sm">
                {failed === 0 ? "✅ ALL TESTS PASSED" : `❌ ${failed} TESTS FAILED — ACTION REQUIRED`}
              </span>
            </CardContent>
          </Card>
        )}

        {failed > 0 && (
          <div className="bg-destructive/10 border border-destructive rounded-lg p-3 text-sm text-destructive font-medium">
            Action required — see failed tests below
          </div>
        )}

        {/* Test Groups */}
        {Object.entries(TEST_GROUPS).map(([groupKey, group]) => (
          <Collapsible key={groupKey} defaultOpen>
            <Card>
              <CardHeader className="py-3 px-4">
                <CollapsibleTrigger className="flex items-center justify-between w-full group">
                  <CardTitle className="text-base">{group.label}</CardTitle>
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-1">
                  {group.tests.map((test) => {
                    const r = results[test.key];
                    const isFail = r?.status === "fail" && !firstFailAssigned;
                    if (isFail) firstFailAssigned = true;

                    return (
                      <div
                        key={test.key}
                        ref={isFail ? firstFailRef : undefined}
                        className={`flex items-start gap-3 p-2 rounded-md ${r?.status === "fail" ? "bg-destructive/5" : ""}`}
                      >
                        <Checkbox
                          checked={selected.has(test.key)}
                          onCheckedChange={() => toggle(test.key)}
                          className="mt-0.5"
                        />
                        <span className="text-lg leading-none">{statusIcon(r?.status || "not_run")}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{test.label}</span>
                            {r && r.status !== "running" && r.status !== "not_run" && (
                              <span className="text-xs text-muted-foreground">{r.duration_ms}ms</span>
                            )}
                          </div>
                          {r?.message && (
                            <p className={`text-xs mt-0.5 ${r.status === "fail" ? "text-destructive" : "text-muted-foreground"}`}>
                              {r.message}
                            </p>
                          )}
                          {r?.detail && (
                            <pre className="text-xs mt-1 bg-muted/50 p-2 rounded overflow-x-auto max-w-full whitespace-pre-wrap">
                              {r.detail}
                            </pre>
                          )}
                        </div>
                        {r?.status === "fail" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => runTests([test.key])}
                            disabled={running}
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>
    </AppLayout>
  );
}
