import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const STATUS_OPTIONS = ["new", "contacted", "enrolled", "not_suitable"] as const;
const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  enrolled: "Enrolled",
  not_suitable: "Not Suitable",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new: "destructive",
  contacted: "default",
  enrolled: "secondary",
  not_suitable: "outline",
};

export default function AcademyEnquiriesPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<any>(null);

  const { data: enquiries = [], isLoading } = useQuery({
    queryKey: ["academy-enquiries"],
    queryFn: async () => {
      const { data } = await supabase
        .from("academy_enquiries")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("academy_enquiries")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academy-enquiries"] });
      toast.success("Status updated");
    },
  });

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold">Academy Enquiries</h1>
          <p className="text-sm text-muted-foreground">
            {enquiries.filter((e: any) => e.status === "new").length} new enquiries
          </p>
        </div>

        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Programme</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell>
                </TableRow>
              ) : enquiries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No enquiries yet</TableCell>
                </TableRow>
              ) : enquiries.map((e: any) => (
                <TableRow
                  key={e.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelected(e)}
                >
                  <TableCell className="font-medium">{e.first_name} {e.last_name}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <a href={`mailto:${e.email}`} className="text-primary hover:underline" onClick={ev => ev.stopPropagation()}>{e.email}</a>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <a href={`tel:${e.phone}`} className="hover:underline" onClick={ev => ev.stopPropagation()}>{e.phone}</a>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{e.programme_interest || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(e.created_at), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[e.status] || "outline"}>
                      {STATUS_LABELS[e.status] || e.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {e.message || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.first_name} {selected.last_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Email</p>
                    <a href={`mailto:${selected.email}`} className="text-primary hover:underline">{selected.email}</a>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Phone</p>
                    <a href={`tel:${selected.phone}`} className="hover:underline">{selected.phone}</a>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Programme</p>
                    <p>{selected.programme_interest || "Not specified"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Referral Source</p>
                    <p>{selected.referral_source || "Not specified"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs">Submitted</p>
                    <p>{format(new Date(selected.created_at), "dd MMM yyyy 'at' HH:mm")}</p>
                  </div>
                </div>
                {selected.message && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Message</p>
                    <p className="text-sm bg-muted/50 rounded-lg p-3 whitespace-pre-wrap">{selected.message}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Update Status</p>
                  <Select
                    value={selected.status}
                    onValueChange={(v) => {
                      updateStatus.mutate({ id: selected.id, status: v });
                      setSelected({ ...selected, status: v });
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
