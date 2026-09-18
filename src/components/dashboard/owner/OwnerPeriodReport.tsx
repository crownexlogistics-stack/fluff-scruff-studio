import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ReportingPeriodKey, ReportingRange } from "@/hooks/useOwnerReportingPeriod";
import { useOwnerReportingPeriod } from "@/hooks/useOwnerReportingPeriod";
import { money, Panel, Row, Section } from "./primitives";

const options: { key: ReportingPeriodKey; label: string }[] = [
  { key: "today", label: "Today" }, { key: "week", label: "This week" },
  { key: "month", label: "This month" }, { key: "year", label: "This year" },
  { key: "beginning", label: "Since beginning" }, { key: "custom", label: "Custom" },
];

function DateButton({ date, onSelect, label }: { date: Date; onSelect: (date?: Date) => void; label: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-start gap-2 font-normal">
          <CalendarIcon className="h-4 w-4" /> {label}: {format(date, "d MMM yyyy")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={onSelect} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

export function OwnerPeriodReport({ range, onPeriod, onCustomStart, onCustomEnd }: {
  range: ReportingRange;
  onPeriod: (key: ReportingPeriodKey) => void;
  onCustomStart: (date: Date) => void;
  onCustomEnd: (date: Date) => void;
}) {
  const report = useOwnerReportingPeriod(range);
  const m = report.metrics;
  return (
    <Section title="Business performance" hint={range.label} action={{ label: "View finance", to: "/finance" }}>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Reporting period">
        {options.map((option) => (
          <Button key={option.key} size="sm" variant={range.key === option.key ? "default" : "outline"} onClick={() => onPeriod(option.key)}>
            {option.label}
          </Button>
        ))}
      </div>
      {range.key === "custom" && (
        <div className="flex flex-wrap gap-2">
          <DateButton date={range.start} onSelect={(date) => date && onCustomStart(date)} label="From" />
          <DateButton date={range.end} onSelect={(date) => date && onCustomEnd(date)} label="To" />
        </div>
      )}
      <Panel className="p-5">
        {report.isLoading ? <Skeleton className="h-52 w-full" /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
            <div>
              <Row label="Revenue earned" hint="Completed appointments only" value={money(m.revenueEarned)} />
              <Row label="Cash received" hint="Money actually received during this period" value={money(m.cashReceived)} />
              <Row label="Appointments" value={m.appointments.toLocaleString("en-GB")} />
              <Row label="Completed" value={m.completed.toLocaleString("en-GB")} />
              <Row label="Cancelled" value={m.cancellations.toLocaleString("en-GB")} />
              <Row label="No-shows" value={m.noShows.toLocaleString("en-GB")} />
            </div>
            <div>
              <Row label="Groomer pay" value={money(m.groomerPay)} />
              <Row label="Bills and expenses" value={money(m.expenses)} />
              <Row label="Profit / loss" value={m.profitLoss === null ? "Not available" : `${m.profitLoss >= 0 ? "+" : "−"}${money(Math.abs(m.profitLoss))}`} tone={m.profitLoss === null ? "neutral" : m.profitLoss >= 0 ? "good" : "bad"} strong />
              {(range.key === "month" || range.key === "custom") && (
                <>
                  <Row label="Confirmed future bookings in period" value={m.futureBookings.toLocaleString("en-GB")} />
                  <Row label="Scheduled revenue remaining" value={money(m.futureRevenue)} />
                  <Row label="Amount still expected" hint="Scheduled revenue less payments already received" value={money(m.futureExpected)} />
                </>
              )}
            </div>
          </div>
        )}
      </Panel>
    </Section>
  );
}
