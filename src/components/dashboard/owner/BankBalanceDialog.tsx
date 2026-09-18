import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { money } from "./primitives";

export function BankBalanceDialog({ open, onOpenChange, ownerName }: { open: boolean; onOpenChange: (open: boolean) => void; ownerName: string }) {
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const client = useQueryClient();
  useEffect(() => { if (open) { setAmount(0); setNote(""); } }, [open]);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("bank_balance_snapshots").insert({ balance: amount, noted_by: ownerName, note: note.trim() || null });
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([client.invalidateQueries({ queryKey: ["owner-bank"] }), client.invalidateQueries({ queryKey: ["owner-bank-history"] })]);
      toast.success("Bank balance updated");
      onOpenChange(false);
    },
    onError: () => toast.error("The bank balance could not be saved"),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Update bank balance</DialogTitle><DialogDescription>Enter the actual balance currently shown by your bank.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label htmlFor="bank-balance">Current balance</Label><div className="flex items-center gap-2"><span className="font-semibold">£</span><NumericInput id="bank-balance" value={amount} onValueChange={setAmount} min={0} autoFocus /></div></div>
          <div className="space-y-2"><Label>Date / time</Label><p className="text-sm text-muted-foreground">{format(new Date(), "d MMMM yyyy 'at' HH:mm")}</p></div>
          <div className="space-y-2"><Label htmlFor="bank-note">Optional note</Label><Textarea id="bank-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>Cancel</Button><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save balance"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BankBalanceHistory({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const history = useQuery({
    queryKey: ["owner-bank-history"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_balance_snapshots").select("id, balance, noted_at, noted_by, note").order("noted_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    }, enabled: open,
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Bank balance history</DialogTitle><DialogDescription>Previous balances entered by the team.</DialogDescription></DialogHeader>
        <div className="divide-y divide-border/60">
          {(history.data ?? []).map((entry) => (
            <div key={entry.id} className="py-3 flex items-start justify-between gap-4">
              <div><p className="text-sm font-semibold">{format(new Date(entry.noted_at), "d MMM yyyy · HH:mm")}</p><p className="text-xs text-muted-foreground">{entry.noted_by}{entry.note ? ` · ${entry.note}` : ""}</p></div>
              <p className="font-heading text-lg">{money(Number(entry.balance))}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
