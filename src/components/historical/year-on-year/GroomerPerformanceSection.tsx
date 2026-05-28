import { useState, useEffect } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { GroomerPerformanceData } from "./useTimelineAnalytics";

interface Props {
  data: GroomerPerformanceData[];
  isLoading: boolean;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #f0e6da",
        borderRadius: 12,
        padding: 12,
        fontFamily: "Nunito, sans-serif",
        fontSize: 13,
      }}
    >
      <p style={{ fontWeight: 700, marginBottom: 4, color: "#2D1B0E" }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.stroke, margin: 0 }}>
          {p.name}: {p.dataKey === "netProfit" ? `£${p.value.toLocaleString()}` : p.value}
        </p>
      ))}
    </div>
  );
}

export default function GroomerPerformanceSection({ data, isLoading }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeGroomers, setActiveGroomers] = useState<Set<string>>(() => new Set(data.map(g => g.name)));
  const [confirmHide, setConfirmHide] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Fetch visibility settings
  const { data: visibilityData } = useQuery({
    queryKey: ["groomer-visibility-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("groomer_visibility_settings")
        .select("groomer_name, hidden, hidden_at");
      if (error) throw error;
      return data || [];
    },
  });

  const hiddenGroomers = new Set(
    (visibilityData || [])
      .filter(s => s.hidden)
      .map(s => s.groomer_name)
  );

  const hiddenDetails = (visibilityData || []).filter(s => s.hidden);

  // Filter data to exclude hidden groomers
  const visibleData = data.filter(g => !hiddenGroomers.has(g.name));

  // Sync defaults when data changes
  useEffect(() => {
    if (visibleData.length > 0 && activeGroomers.size === 0) {
      setActiveGroomers(new Set(visibleData.map(g => g.name)));
    }
  }, [visibleData.length]);

  const toggle = (name: string) => {
    setActiveGroomers(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleHideGroomer = async (groomerName: string) => {
    await supabase
      .from("groomer_visibility_settings")
      .upsert(
        { groomer_name: groomerName, hidden: true, hidden_at: new Date().toISOString() },
        { onConflict: "groomer_name" }
      );
    queryClient.invalidateQueries({ queryKey: ["groomer-visibility-settings"] });
    setActiveGroomers(prev => {
      const next = new Set(prev);
      next.delete(groomerName);
      return next;
    });
    toast({ title: `✅ ${groomerName} hidden from Performance section` });
    setConfirmHide(null);
  };

  const handleRestoreGroomer = async (groomerName: string) => {
    await supabase
      .from("groomer_visibility_settings")
      .upsert(
        { groomer_name: groomerName, hidden: false },
        { onConflict: "groomer_name" }
      );
    queryClient.invalidateQueries({ queryKey: ["groomer-visibility-settings"] });
    setActiveGroomers(prev => new Set([...prev, groomerName]));
    toast({ title: `✅ ${groomerName} restored to Performance section` });
  };

  if (isLoading) {
    return <Skeleton className="h-[300px] w-full rounded-[20px]" />;
  }

  if (!data.length) {
    return (
      <div className="w-full rounded-[20px] bg-white p-6" style={{ borderRadius: 20 }}>
        <h2 style={{ fontFamily: "Fredoka One, cursive", color: "#2D1B0E", fontSize: 24, margin: 0 }}>
          ✂️ Groomer Performance Over Time
        </h2>
        <p className="text-sm mt-3" style={{ color: "#8B6F5C" }}>No groomer data available</p>
      </div>
    );
  }

  const effectiveActive = activeGroomers.size > 0 ? activeGroomers : new Set(visibleData.map(g => g.name));

  return (
    <div className="w-full rounded-[20px] bg-white shadow-sm" style={{ borderRadius: 20, padding: 24 }}>
      <h2 style={{ fontFamily: "Fredoka One, cursive", color: "#2D1B0E", fontSize: 24, margin: 0, marginBottom: 16 }}>
        ✂️ Groomer Performance Over Time
      </h2>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3 mb-2">
        {visibleData.map(g => (
          <div
            key={g.name}
            className="flex flex-col relative"
            style={{
              background: "#FFFAF4",
              border: "1px solid #f0e6da",
              borderRadius: 16,
              padding: "8px 16px",
              paddingRight: 28,
            }}
          >
            <button
              onClick={() => setConfirmHide(g.name)}
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#e0e0e0",
                color: "#666",
                border: "none",
                cursor: "pointer",
                fontSize: 10,
                lineHeight: "16px",
                textAlign: "center",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title={`Hide ${g.name}`}
            >
              ×
            </button>
            <span style={{ fontWeight: 700, color: "#2D1B0E", fontSize: 13 }}>{g.name}</span>
            <span style={{ color: "#8B6F5C", fontSize: 11 }}>
              £{g.allTimeNetProfit.toLocaleString()} salon profit · {g.allTimeAppointments.toLocaleString()} appts
            </span>
          </div>
        ))}
      </div>

      {/* Manage hidden groomers link */}
      {hiddenDetails.length > 0 && (
        <button
          onClick={() => setSheetOpen(true)}
          style={{
            fontFamily: "Nunito, sans-serif",
            fontSize: 13,
            color: "#FF6B35",
            textDecoration: "underline",
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: 0,
            marginBottom: 12,
            display: "block",
          }}
        >
          Manage hidden groomers ({hiddenDetails.length} hidden)
        </button>
      )}

      {/* Selector buttons */}
      <div className="flex flex-wrap gap-2 mb-5">
        {visibleData.map(g => {
          const isActive = effectiveActive.has(g.name);
          return (
            <button
              key={g.name}
              onClick={() => toggle(g.name)}
              style={{
                fontFamily: "Nunito, sans-serif",
                fontSize: 13,
                fontWeight: 600,
                padding: "6px 16px",
                borderRadius: 9999,
                border: isActive ? "none" : "1px solid #2D1B0E",
                background: isActive ? "#FF6B35" : "white",
                color: isActive ? "white" : "#2D1B0E",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {g.name}
            </button>
          );
        })}
      </div>

      {/* Charts */}
      <div className="space-y-6">
        {visibleData
          .filter(g => effectiveActive.has(g.name))
          .map(g => (
            <div key={g.name}>
              <p style={{ fontFamily: "Fredoka One, cursive", color: "#2D1B0E", fontSize: 15, marginBottom: 8 }}>
                {g.name}
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={g.weeks}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0e6da" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "#8B6F5C" }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={(v: number) => `£${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                    tick={{ fontSize: 11, fill: "#FF6B35" }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: "#FFB800" }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="netProfit" stroke="#FF6B35" strokeWidth={2} dot={false} name="Net Profit (£)" />
                  <Line yAxisId="right" type="monotone" dataKey="appointments" stroke="#FFB800" strokeWidth={2} dot={{ r: 3, fill: "#FFB800" }} strokeDasharray="4 4" name="Appointments" />
                  <Line yAxisId="right" type="monotone" dataKey="returningCustomers" stroke="#2D1B0E" strokeWidth={1.5} dot={false} strokeDasharray="2 4" name="Returning Customers" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ))}
      </div>

      {/* Hide confirmation dialog */}
      <AlertDialog open={!!confirmHide} onOpenChange={(open) => { if (!open) setConfirmHide(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hide {confirmHide}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes them from the Performance section. Their historical data is kept and you can bring them back at any time from Settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmHide && handleHideGroomer(confirmHide)}
              style={{ background: "#FF6B35" }}
            >
              Hide Groomer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hidden groomers sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Hidden Groomers</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {hiddenDetails.length === 0 ? (
              <p className="text-sm" style={{ color: "#8B6F5C" }}>No groomers are currently hidden.</p>
            ) : (
              hiddenDetails.map(h => (
                <div key={h.groomer_name} className="flex items-center justify-between p-3 rounded-xl" style={{ border: "1px solid #f0e6da" }}>
                  <div>
                    <p style={{ fontWeight: 600, color: "#2D1B0E", fontSize: 14 }}>{h.groomer_name}</p>
                    <p style={{ color: "#8B6F5C", fontSize: 11 }}>
                      Hidden since {h.hidden_at ? new Date(h.hidden_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "unknown"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestoreGroomer(h.groomer_name)}
                    style={{ borderColor: "#FF6B35", color: "#FF6B35" }}
                  >
                    Restore
                  </Button>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
