import { useState } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
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
  const [activeGroomers, setActiveGroomers] = useState<Set<string>>(() => new Set(data.map(g => g.name)));

  // Sync defaults when data changes
  if (data.length > 0 && activeGroomers.size === 0) {
    // handled via initial state; if data arrives later we re-check
  }

  const toggle = (name: string) => {
    setActiveGroomers(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  if (isLoading) {
    return <Skeleton className="h-[300px] w-full rounded-[20px]" />;
  }

  if (!data.length) {
    return (
      <div
        className="w-full rounded-[20px] bg-white p-6"
        style={{ borderRadius: 20 }}
      >
        <h2 style={{ fontFamily: "Fredoka One, cursive", color: "#2D1B0E", fontSize: 24, margin: 0 }}>
          ✂️ Groomer Performance Over Time
        </h2>
        <p className="text-sm mt-3" style={{ color: "#8B6F5C" }}>No groomer data available</p>
      </div>
    );
  }

  // Ensure all groomers are active on first render with data
  const effectiveActive = activeGroomers.size > 0 ? activeGroomers : new Set(data.map(g => g.name));

  return (
    <div className="w-full rounded-[20px] bg-white shadow-sm" style={{ borderRadius: 20, padding: 24 }}>
      <h2 style={{ fontFamily: "Fredoka One, cursive", color: "#2D1B0E", fontSize: 24, margin: 0, marginBottom: 16 }}>
        ✂️ Groomer Performance Over Time
      </h2>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3 mb-4">
        {data.map(g => (
          <div
            key={g.name}
            className="flex flex-col"
            style={{
              background: "#FFFAF4",
              border: "1px solid #f0e6da",
              borderRadius: 16,
              padding: "8px 16px",
            }}
          >
            <span style={{ fontWeight: 700, color: "#2D1B0E", fontSize: 13 }}>{g.name}</span>
            <span style={{ color: "#8B6F5C", fontSize: 11 }}>
              £{g.allTimeNetProfit.toLocaleString()} salon profit · {g.allTimeAppointments.toLocaleString()} appts
            </span>
          </div>
        ))}
      </div>

      {/* Selector buttons */}
      <div className="flex flex-wrap gap-2 mb-5">
        {data.map(g => {
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
        {data
          .filter(g => effectiveActive.has(g.name))
          .map(g => (
            <div key={g.name}>
              <p style={{ fontFamily: "Fredoka One, cursive", color: "#2D1B0E", fontSize: 15, marginBottom: 8 }}>
                {g.name}
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={g.months}>
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
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="netProfit"
                    stroke="#FF6B35"
                    strokeWidth={2}
                    dot={false}
                    name="Net Profit (£)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="appointments"
                    stroke="#FFB800"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#FFB800" }}
                    strokeDasharray="4 4"
                    name="Appointments"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="returningCustomers"
                    stroke="#2D1B0E"
                    strokeWidth={1.5}
                    dot={false}
                    strokeDasharray="2 4"
                    name="Returning Customers"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ))}
      </div>
    </div>
  );
}
