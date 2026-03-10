import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Copy } from "lucide-react";

export function FinanceExplainerButton({ variant = "outline", size = "sm" }: { variant?: any; size?: any }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ text: string; generatedAt: string } | null>(null);
  const [error, setError] = useState(false);

  const monthName = format(new Date(), "MMMM");

  const handleOpen = async () => {
    setOpen(true);
    setLoading(true);
    setError(false);
    setResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("finance-explainer", {
        body: {},
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      console.error("Finance explainer error:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result?.text) {
      navigator.clipboard.writeText(result.text);
      toast.success("Copied to clipboard");
    }
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={handleOpen}>
        🤖 Explain this month to me
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>📊 Your {monthName} Finances — Plain English</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {loading && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground animate-pulse">Analysing your numbers... 📊</p>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            )}

            {error && (
              <p className="text-sm text-muted-foreground">
                AI briefing unavailable right now — please try again in a moment.
              </p>
            )}

            {result && (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{result.text}</p>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopy}>
                  <Copy className="h-3 w-3" /> Copy this
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
