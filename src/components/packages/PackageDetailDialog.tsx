import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Package, Loader2, FileCheck, Clock, Send, PenLine } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PasswordVerifyDialog } from "@/components/booking-calendar/PasswordVerifyDialog";

interface Props {
  packageBookingId: string;
  open: boolean;
  onClose: () => void;
}

export function PackageDetailDialog({ packageBookingId, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [resending, setResending] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);
  const [manualNote, setManualNote] = useState("");
  const [manualName, setManualName] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  const { data: pb, isLoading } = useQuery({
    queryKey: ["package-booking-detail", packageBookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("package_bookings" as any)
        .select("*, packages(*)")
        .eq("id", packageBookingId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: open,
  });

  const { data: sessions } = useQuery({
    queryKey: ["package-sessions-detail", packageBookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("package_sessions" as any)
        .select("*, bookings(id, booking_date, booking_time, status, staff_id)")
        .eq("package_booking_id", packageBookingId)
        .order("session_number", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: open,
  });

  const { data: tcSignature, refetch: refetchTc } = useQuery({
    queryKey: ["package-tc-signature", packageBookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("package_tc_signatures" as any)
        .select("*")
        .eq("package_booking_id", packageBookingId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data as any[])?.[0] || null;
    },
    enabled: open,
  });

  const handleResendTCEmail = async () => {
    setResending(true);
    try {
      await supabase.functions.invoke("send-package-tc-email", {
        body: { type: "resend_invite", package_booking_id: packageBookingId },
      });
      toast.success("T&C signing email resent!");
      refetchTc();
    } catch {
      toast.error("Failed to resend email");
    } finally {
      setResending(false);
    }
  };

  const handleManualSign = async () => {
    if (!manualNote.trim() || !manualName.trim()) {
      toast.error("Please enter name and note");
      return;
    }
    setSavingManual(true);
    try {
      const now = new Date().toISOString();
      await supabase.from("package_tc_signatures" as any).insert({
        package_booking_id: packageBookingId,
        customer_email: pb.customer_email,
        customer_name: pb.customer_name,
        signature_text: manualName.trim(),
        signed_at: now,
        status: "signed",
        performed_by: "Admin",
        manual_note: manualNote.trim(),
        tc_version: "1.0",
      });

      await supabase
        .from("package_bookings" as any)
        .update({ tc_signed: true, tc_signed_at: now })
        .eq("id", packageBookingId);

      toast.success("T&C marked as manually signed");
      setManualOverride(false);
      setManualNote("");
      setManualName("");
      refetchTc();
      queryClient.invalidateQueries({ queryKey: ["package-booking-detail"] });
    } catch {
      toast.error("Failed to save");
    } finally {
      setSavingManual(false);
    }
  };

  const handleCancelPackage = async () => {
    if (!pb) return;
    setCancelling(true);

    try {
      const remaining = pb.sessions_total - pb.sessions_used;
      const pricePerSession = pb.total_paid / pb.sessions_total;
      const refundAmount = remaining * pricePerSession;

      if (sessions) {
        const futureSessionBookingIds = sessions
          .filter((s: any) => s.status === "scheduled" && s.booking_id)
          .map((s: any) => s.booking_id);

        if (futureSessionBookingIds.length > 0) {
          await supabase
            .from("bookings")
            .update({ status: "Cancelled" })
            .in("id", futureSessionBookingIds);

          await supabase
            .from("package_sessions" as any)
            .update({ status: "cancelled" })
            .eq("package_booking_id", packageBookingId)
            .eq("status", "scheduled");
        }
      }

      await supabase
        .from("package_bookings" as any)
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          refund_amount: refundAmount,
          sessions_remaining: 0,
        })
        .eq("id", packageBookingId);

      if (pb.stripe_payment_intent_id && refundAmount > 0) {
        const { error: refundError } = await supabase.functions.invoke("process-refund", {
          body: {
            payment_intent_id: pb.stripe_payment_intent_id,
            amount: Math.round(refundAmount * 100),
          },
        });
        if (refundError) {
          toast.error("Package cancelled but Stripe refund failed — process manually");
        } else {
          toast.success(`Package cancelled. £${refundAmount.toFixed(2)} refund processed.`);
        }
      } else {
        toast.success(
          pb.stripe_payment_intent_id
            ? "Package cancelled — no refund due (all sessions used)"
            : `Package cancelled. Refund £${refundAmount.toFixed(2)} manually.`
        );
      }

      await supabase.from("booking_audit_log" as any).insert({
        booking_id: sessions?.[0]?.booking_id || packageBookingId,
        event_type: "package_cancelled",
        note: `Package "${pb.packages?.name}" cancelled. ${remaining} sessions remaining. Refund: £${refundAmount.toFixed(2)}.`,
        performed_by: "Admin",
      });

      queryClient.invalidateQueries({ queryKey: ["package-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["package-booking-detail"] });
      setCancelConfirm(false);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel package");
    } finally {
      setCancelling(false);
    }
  };

  if (isLoading || !pb) {
    return (
      <Dialog open={open} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-lg">
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const used = pb.sessions_used || 0;
  const total = pb.sessions_total || 1;
  const remaining = total - used;
  const pct = Math.round((used / total) * 100);
  const pricePerSession = pb.total_paid / total;
  const potentialRefund = remaining * pricePerSession;

  const tcSigned = pb.tc_signed || tcSignature?.status === "signed";
  const tcPending = !tcSigned;

  const sessionStatusBadge = (status: string) => {
    if (status === "completed") return <Badge className="bg-emerald-100 text-emerald-800">Completed</Badge>;
    if (status === "scheduled") return <Badge className="bg-blue-100 text-blue-800">Scheduled</Badge>;
    if (status === "cancelled") return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Package Details
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* T&C Status */}
            <div className="flex items-center gap-2 flex-wrap">
              {tcSigned ? (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                  <FileCheck className="h-3 w-3 mr-1" />
                  T&C Signed — {pb.tc_signed_at ? format(new Date(pb.tc_signed_at), "dd MMM yyyy") : tcSignature?.signed_at ? format(new Date(tcSignature.signed_at), "dd MMM yyyy") : ""}
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                  <Clock className="h-3 w-3 mr-1" />
                  Awaiting Signature
                </Badge>
              )}
            </div>

            {tcSigned && tcSignature && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm space-y-1">
                <p>Signed by <strong>{tcSignature.signature_text}</strong> on {tcSignature.signed_at ? format(new Date(tcSignature.signed_at), "dd MMM yyyy 'at' HH:mm") : "—"}</p>
                {tcSignature.performed_by && <p className="text-muted-foreground">Manually recorded by {tcSignature.performed_by}</p>}
                {tcSignature.manual_note && <p className="text-muted-foreground italic">"{tcSignature.manual_note}"</p>}
              </div>
            )}

            {tcPending && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleResendTCEmail} disabled={resending}>
                  {resending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                  {tcSignature ? "Resend Signing Link" : "Send Signing Link"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setManualOverride(true)}>
                  <PenLine className="h-3 w-3 mr-1" />
                  Mark as Signed Manually
                </Button>
              </div>
            )}

            {manualOverride && (
              <div className="bg-muted rounded-lg p-3 space-y-3">
                <p className="text-sm font-medium">Manual Override — Legacy Package</p>
                <Input
                  placeholder="Customer name as signed"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                />
                <Textarea
                  placeholder='e.g. "Paper agreement signed in salon on 15/01/2026"'
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleManualSign} disabled={savingManual}>
                    {savingManual ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setManualOverride(false)}>Cancel</Button>
                </div>
              </div>
            )}

            <Separator />

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Customer</span>
                <p className="font-medium">{pb.customer_name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Dog</span>
                <p className="font-medium">{pb.dog_name || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Package</span>
                <p className="font-medium">{pb.packages?.name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status</span>
                <p>
                  <Badge className={pb.status === "active" ? "bg-emerald-100 text-emerald-800" : pb.status === "completed" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"}>
                    {pb.status}
                  </Badge>
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Total Paid</span>
                <p className="font-medium">£{Number(pb.total_paid).toFixed(2)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Per Session</span>
                <p className="font-medium">£{pricePerSession.toFixed(2)}</p>
              </div>
            </div>

            {/* Progress */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{used} of {total} sessions used</span>
                <span>{remaining} remaining</span>
              </div>
              <Progress value={pct} className="h-3" />
            </div>

            <Separator />

            {/* Sessions table */}
            <div>
              <h3 className="font-semibold mb-2">Sessions</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions?.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.session_number}</TableCell>
                      <TableCell>
                        {s.scheduled_date ? format(new Date(s.scheduled_date), "dd MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell>{s.scheduled_time || "—"}</TableCell>
                      <TableCell className="capitalize">{s.service_type?.replace("_", " ") || "—"}</TableCell>
                      <TableCell>{sessionStatusBadge(s.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {pb.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-1">Notes</h3>
                  <p className="text-sm text-muted-foreground">{pb.notes}</p>
                </div>
              </>
            )}

            {/* Cancel section */}
            {pb.status === "active" && (
              <>
                <Separator />
                {!cancelConfirm ? (
                  <Button variant="destructive" onClick={() => setCancelConfirm(true)}>
                    Cancel Package
                  </Button>
                ) : (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                      <div className="text-sm">
                        <p className="font-semibold text-destructive">Cancel Package & Refund</p>
                        <p className="text-muted-foreground mt-1">
                          {remaining} sessions remaining at £{pricePerSession.toFixed(2)} each = <strong>£{potentialRefund.toFixed(2)} refund</strong>
                        </p>
                        {pb.stripe_payment_intent_id ? (
                          <p className="text-muted-foreground">Stripe refund will be processed automatically.</p>
                        ) : (
                          <p className="text-muted-foreground">This was paid in salon — refund manually.</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setCancelConfirm(false)}>
                        Go Back
                      </Button>
                      {pb.stripe_payment_intent_id ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setPasswordOpen(true)}
                        >
                          Verify & Cancel
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={cancelling}
                          onClick={handleCancelPackage}
                        >
                          {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                          Confirm Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {pb.status === "cancelled" && pb.refund_amount && (
              <div className="bg-muted rounded-lg p-3 text-sm">
                <p>Refund processed: <strong>£{Number(pb.refund_amount).toFixed(2)}</strong></p>
                {pb.cancelled_at && <p className="text-muted-foreground">Cancelled on {format(new Date(pb.cancelled_at), "dd MMM yyyy HH:mm")}</p>}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <PasswordVerifyDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        onConfirmed={() => {
          setPasswordOpen(false);
          handleCancelPackage();
        }}
        title="Verify to Cancel Package"
        description={`This will refund £${potentialRefund.toFixed(2)} for ${remaining} unused sessions.`}
        confirmLabel="Cancel Package"
        destructive
      />
    </>
  );
}
