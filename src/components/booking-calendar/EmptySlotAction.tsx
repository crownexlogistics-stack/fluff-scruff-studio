import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarPlus, Ban } from "lucide-react";
import { useState } from "react";

interface EmptySlotActionProps {
  date: Date;
  hour: number;
  staffId: string;
  staffName: string;
  onBook: (date: Date, hour: number, staffId: string) => void;
  onBlock: (date: Date, hour: number, staffId: string) => void;
  children: React.ReactNode;
}

export function EmptySlotAction({ date, hour, staffId, staffName, onBook, onBlock, children }: EmptySlotActionProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-48 sm:w-56 p-2" side="bottom" align="center" sideOffset={4}>
        <div className="space-y-1">
          <button
            className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-accent text-left"
            onClick={() => { onBook(date, hour, staffId); setOpen(false); }}
          >
            <CalendarPlus className="h-4 w-4" /> Appointment
          </button>
          <button
            className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-accent text-left"
            onClick={() => { onBlock(date, hour, staffId); setOpen(false); }}
          >
            <Ban className="h-4 w-4" /> Blocked time
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
