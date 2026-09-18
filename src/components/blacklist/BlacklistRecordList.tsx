import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck, Mail, Phone, Clock } from "lucide-react";
import { useCurrentStaff } from "@/hooks/useCurrentStaff";
import { BlacklistReasonDialog } from "./BlacklistReasonDialog";
import { friendlyError } from "@/lib/friendlyError";

export interface BlacklistRecord {
  id: string;
  customer_name: string | null;
  email: string | null;
  phone_raw: string | null;
  phone_normalised: string | null;
  reason: string;
  blacklisted_by_name: string;
  created_at: string;
  status: string;
  removed_reason: string | null;
  removed_by_name: string | null;
  removed_at: string | null;
}

interface Props {
  records: BlacklistRecord[];
  mode: "active" | "removed";
  attempts?: Record<string, number>;
  onChanged: () => void;
}

export function BlacklistRecordList({ records, mode, attempts, onChanged }: Props) {
  const { staff } = useCurrentStaff();
  const [target, setTarget] = useState<BlacklistRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const handleRemove = async (reason: string) => {
    if (!target) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("customer_blacklist")
        .update({
          status: "removed",
          removed_reason: reason,
          removed_by_staff_id: staff?.id || null,
          removed_by_name: staff?.name || "Unknown staff",
          removed_at: new Date().toISOString(),
        })
        .eq("id", target.id);
      if (error) throw error;
      toast.success(`${target.customer_name || "Customer"} can book again.`);
      setTarget(null);
      onChanged();
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  if (records.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {mode === "active" ? "No blacklisted accounts yet." : "No accounts have been removed from the blacklist yet."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {records.map((r) => (
        <Card key={r.id} className="p-4 space-y-2">
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium">{r.customer_name || "Unknown"}</p>
                {mode === "active" ? (
                  <Badge variant="destructive" className="gap-1 text-[10px]">
                    <ShieldAlert className="h-3 w-3" /> Blacklisted
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <ShieldCheck className="h-3 w-3" /> Unblocked
                  </Badge>
                )}
                {mode === "active" && !!attempts?.[r.id] && (
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <Clock className="h-3 w-3" /> {attempts[r.id]} blocked attempt{attempts[r.id] === 1 ? "" : "s"}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground flex gap-3 flex-wrap mt-1">
                {r.email && (
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{r.email}</span>
                )}
                {(r.phone_raw || r.phone_normalised) && (
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone_raw || r.phone_normalised}</span>
                )}
              </div>
            </div>
            {mode === "active" && (
              <Button size="sm" variant="outline" onClick={() => setTarget(r)}>
                Remove from blacklist
              </Button>
            )}
          </div>

          <div className="rounded-md bg-muted/40 p-3 text-sm space-y-1">
            <p className="whitespace-pre-wrap">{r.reason}</p>
            <p className="text-xs text-muted-foreground">
              Blacklisted by {r.blacklisted_by_name} · {format(new Date(r.created_at), "dd MMM yyyy, HH:mm")}
            </p>
          </div>

          {mode === "removed" && r.removed_reason && (
            <div className="rounded-md border border-border p-3 text-sm space-y-1">
              <p className="whitespace-pre-wrap">{r.removed_reason}</p>
              <p className="text-xs text-muted-foreground">
                Removed by {r.removed_by_name || "Unknown"}
                {r.removed_at ? ` · ${format(new Date(r.removed_at), "dd MMM yyyy, HH:mm")}` : ""}
              </p>
            </div>
          )}
        </Card>
      ))}

      <BlacklistReasonDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={`Remove ${target?.customer_name || "customer"} from the blacklist`}
        description="They will be able to book again. The record stays in the Unblocked list for audit."
        confirmLabel="Remove from blacklist"
        saving={saving}
        onConfirm={handleRemove}
      />
    </div>
  );
}
