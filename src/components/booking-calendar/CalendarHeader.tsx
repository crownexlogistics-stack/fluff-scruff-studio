import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, startOfWeek, addDays } from "date-fns";

interface CalendarHeaderProps {
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
}

export function CalendarHeader({ weekStart, onPrevWeek, onNextWeek, onToday }: CalendarHeaderProps) {
  const weekEnd = addDays(weekStart, 6);
  const label =
    weekStart.getMonth() === weekEnd.getMonth()
      ? format(weekStart, "MMMM yyyy")
      : `${format(weekStart, "MMMM")} - ${format(weekEnd, "MMMM yyyy")}`;

  return (
    <div className="flex items-center justify-between pb-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-heading font-bold">Booking Calendar</h1>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onToday}>Today</Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onPrevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onNextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-lg font-medium min-w-[200px] text-center">{label}</span>
        <span className="text-sm text-muted-foreground ml-2">Weekly</span>
      </div>
    </div>
  );
}
