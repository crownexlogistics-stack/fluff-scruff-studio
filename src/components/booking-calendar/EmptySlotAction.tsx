import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarPlus, Ban, Clock } from "lucide-react";
import { useState } from "react";

interface EmptySlotActionProps {
  date: Date;
  hour: number;
  staffId: string;
  staffName: string;
  onBook: (date: Date, hour: number, staffId: string) => void;
  onBlock: (date: Date, hour: number, staffId: string) => void;
  onOvertime?: (date: Date, hour: number, staffId: string) => void;
  children: React.ReactNode;
}

export function EmptySlotAction({ date, hour, staffId, staffName, onBook, onBlock, onOvertime, children }: EmptySlotActionProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-48 sm:w-56 p-2" side="bottom" align="center" sideOffset={4}>
        <div className="space-y-1">
          <button
            className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-accent text-left"
            onClick={() => { setOpen(false); setTimeout(() => onBook(date, hour, staffId), 150); }}
          >
            <CalendarPlus className="h-4 w-4" /> Appointment
          </button>
          <button
            className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-accent text-left"
            onClick={() => { setOpen(false); setTimeout(() => onBlock(date, hour, staffId), 150); }}
          >
            <Ban className="h-4 w-4" /> Blocked time
          </button>
          {onOvertime && (
            <button
              className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-accent text-left"
              onClick={() => { setOpen(false); setTimeout(() => onOvertime(date, hour, staffId), 150); }}
            >
              <Clock className="h-4 w-4" /> Overtime
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
