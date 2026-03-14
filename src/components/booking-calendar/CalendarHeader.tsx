import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, startOfWeek, addDays } from "date-fns";

interface CalendarHeaderProps {
  weekStart: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onJumpToDate?: (date: Date) => void;
}

export function CalendarHeader({ weekStart, onPrevWeek, onNextWeek, onToday, onJumpToDate }: CalendarHeaderProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const weekEnd = addDays(weekStart, 6);
  const label =
    weekStart.getMonth() === weekEnd.getMonth()
      ? format(weekStart, "MMMM yyyy")
      : `${format(weekStart, "MMMM")} - ${format(weekEnd, "MMMM yyyy")}`;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4">
      <h1 className="text-xl sm:text-2xl font-heading font-bold">Booking Calendar</h1>
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={onToday}>Today</Button>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={weekStart}
              onSelect={(date) => {
                if (date && onJumpToDate) {
                  onJumpToDate(date);
                }
                setPickerOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onPrevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={onNextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm sm:text-lg font-medium text-center">{label}</span>
      </div>
    </div>
  );
}
