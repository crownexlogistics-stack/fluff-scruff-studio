import { useState, useMemo, useCallback } from "react";
import { calcDateAwareExpenses, toMonthly } from "@/lib/expenseCalc";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, ArrowLeftRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, parseISO, isSameMonth } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "rent", label: "Rent & Property", icon: "🏠" },
  { value: "utilities", label: "Utilities", icon: "⚡" },
  { value: "phone_internet", label: "Phone & Internet", icon: "📱" },
  { value: "products", label: "Products & Supplies", icon: "🧴" },
  { value: "equipment", label: "Equipment", icon: "🛠️" },
  { value: "transport", label: "Transport", icon: "🚗" },
  { value: "insurance", label: "Insurance", icon: "💼" },
  { value: "marketing", label: "Marketing & Advertising", icon: "📣" },
  { value: "cleaning", label: "Cleaning & Maintenance", icon: "🧹" },
  { value: "staff_training", label: "Staff & Training", icon: "👔" },
  { value: "software", label: "Software & Subscriptions", icon: "💻" },
  { value: "other", label: "Other", icon: "🎁" },
];

const getCategoryDisplay = (val: string) => CATEGORIES.find(c => c.value === val) || { value: val, label: val, icon: "🎁" };

// toMonthly is now imported from @/lib/expenseCalc

type ExpenseRow = {
  id: string;
  name: string;
  category: string;
  amount: number;
  expense_type: string;
  frequency: string | null;
  expense_date: string | null;
  recurring_start_date: string | null;
  recurring_end_date: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
};

type FormState = {
  name: string;
  category: string;
  amount: number;
  frequency: string;
  expense_date: Date | undefined;
  recurring_start_date: Date | undefined;
  recurring_end_date: Date | undefined;
  notes: string;
};

const emptyForm: FormState = {
  name: "",
  category: "other",
  amount: 0,
  frequency: "monthly",
  expense_date: new Date(),
  recurring_start_date: new Date(),
  recurring_end_date: undefined,
  notes: "",
};

// ─── Top-level components (stable identity, no remount on parent re-render) ───

type PLData = {
  revenue: number;
  groomerPay: number;
  recurringCostsPaid: number;
  recurringCostsUpcoming: number;
  oneOffCosts: number;
  netProfit: number;
  isCurrentMonth: boolean;
};

function PLCard({ title, data }: { title: string; data: PLData }) {
  const totalRecurring = data.recurringCostsPaid + data.recurringCostsUpcoming;
  const projectedProfit = data.revenue - data.groomerPay - totalRecurring - data.oneOffCosts;
  return (
    <Card className={cn("rounded-xl border-2", data.netProfit >= 0 ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50")}>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-1.5">
        <div className="flex justify-between text-sm"><span>Revenue</span><span className="font-medium">£{data.revenue.toFixed(2)}</span></div>
        <div className="flex justify-between text-sm text-muted-foreground"><span>Groomer Pay</span><span>- £{data.groomerPay.toFixed(2)}</span></div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{data.isCurrentMonth ? "Recurring (paid)" : "Recurring Costs"}</span>
          <span>- £{data.recurringCostsPaid.toFixed(2)}</span>
        </div>
        {data.isCurrentMonth && data.recurringCostsUpcoming > 0 && (
          <div className="flex justify-between text-sm text-muted-foreground/60">
            <span>Recurring (upcoming)</span>
            <span>- £{data.recurringCostsUpcoming.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm text-muted-foreground"><span>One-off Costs</span><span>- £{data.oneOffCosts.toFixed(2)}</span></div>
        <hr className="my-1" />
        <div className="flex justify-between font-bold text-lg">
          <span>{data.isCurrentMonth ? "ACTUAL PROFIT" : "NET PROFIT"}</span>
          <span className={data.netProfit >= 0 ? "text-green-700" : "text-destructive"}>
            £{data.netProfit.toFixed(2)}
          </span>
        </div>
        {data.isCurrentMonth && data.recurringCostsUpcoming > 0 && (
          <div className="flex justify-between text-xs text-amber-600 pt-1">
            <span>📊 Projected (after all expenses)</span>
            <span>£{projectedProfit.toFixed(2)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ExpenseFormProps {
  type: "recurring" | "one_off";
  form: FormState;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNotesChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onAmountChange: (value: number) => void;
  onCategoryChange: (value: string) => void;
  onFrequencyChange: (value: string) => void;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
  onExpenseDateChange: (date: Date | undefined) => void;
}

function ExpenseForm({
  type,
  form,
  onNameChange,
  onNotesChange,
  onAmountChange,
  onCategoryChange,
  onFrequencyChange,
  onStartDateChange,
  onEndDateChange,
  onExpenseDateChange,
}: ExpenseFormProps) {

  return (
    <div className="space-y-4">
      <div>
        <Label>Name</Label>
        <Input value={form.name} onChange={onNameChange} placeholder="e.g. Rent" />
      </div>
      <div>
        <Label>Category</Label>
        <Select value={form.category} onValueChange={onCategoryChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Amount (£)</Label>
        <NumericInput value={form.amount} onValueChange={onAmountChange} />
      </div>
      {type === "recurring" && (
        <div>
          <Label>Frequency</Label>
          <Select value={form.frequency} onValueChange={onFrequencyChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      {type === "recurring" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.recurring_start_date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.recurring_start_date ? format(form.recurring_start_date, "PPP") : "Pick date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={form.recurring_start_date} onSelect={onStartDateChange} className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>End Date (optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.recurring_end_date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.recurring_end_date ? format(form.recurring_end_date, "PPP") : "Ongoing"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={form.recurring_end_date} onSelect={onEndDateChange} className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
          </div>
        </div>
      )}
      {type === "one_off" && (
        <div>
          <Label>Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.expense_date && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.expense_date ? format(form.expense_date, "PPP") : "Pick date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={form.expense_date} onSelect={onExpenseDateChange} className="p-3 pointer-events-auto" /></PopoverContent>
          </Popover>
        </div>
      )}
      <div>
        <Label>Notes (optional)</Label>
        <Textarea value={form.notes} onChange={onNotesChange} placeholder="Additional details..." />
      </div>
    </div>
  );
}

// ─── Main component ───

interface ExpensesTabProps {
  periodStart: Date;
  periodEnd: Date;
  totalRevenue: number;
  totalGroomerPay: number;
}

export default function ExpensesTab({ periodStart, periodEnd, totalRevenue, totalGroomerPay }: ExpensesTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [plMonth, setPlMonth] = useState(new Date());
  const [compareMonth, setCompareMonth] = useState<Date | null>(null);

  // Dialog state
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [oneOffOpen, setOneOffOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm });

  // One-off filter
  const [oneOffFilter, setOneOffFilter] = useState<"month" | "3months" | "year">("month");

  // Queries
  const { data: recurring = [] } = useQuery({
    queryKey: ["expenses-recurring"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("expense_type", "recurring")
        .order("created_at");
      if (error) throw error;
      return data as ExpenseRow[];
    },
  });

  const oneOffStart = useMemo(() => {
    const now = new Date();
    if (oneOffFilter === "3months") return format(subMonths(startOfMonth(now), 2), "yyyy-MM-dd");
    if (oneOffFilter === "year") return format(startOfMonth(new Date(now.getFullYear(), 0, 1)), "yyyy-MM-dd");
    return format(startOfMonth(now), "yyyy-MM-dd");
  }, [oneOffFilter]);

  const { data: oneOffs = [] } = useQuery({
    queryKey: ["expenses-oneoff", oneOffStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("expense_type", "one_off")
        .gte("expense_date", oneOffStart)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data as ExpenseRow[];
    },
  });

  // Fetch non-returned purchases from Purchase Orders to show as one-off expenses
  const { data: purchaseExpenses = [] } = useQuery({
    queryKey: ["purchase-expenses", oneOffStart],
    queryFn: async () => {
      const { data, error } = await (supabase.from("purchases" as any) as any)
        .select("id, title, total_price, purchased_at, supplier, notes, is_returned, assigned_to, assignment_type")
        .eq("is_returned", false)
        .gte("purchased_at", `${oneOffStart}T00:00:00`)
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Merge purchases into one-off display list
  const allOneOffs = useMemo(() => {
    const purchaseRows: (ExpenseRow & { _fromPurchaseOrders?: boolean })[] = purchaseExpenses
      .filter((p: any) => p.total_price && Number(p.total_price) > 0)
      .map((p: any) => ({
        id: p.id,
        name: p.title,
        category: "equipment",
        amount: Number(p.total_price),
        expense_type: "one_off" as const,
        frequency: null,
        expense_date: p.purchased_at ? p.purchased_at.split("T")[0] : null,
        recurring_start_date: null,
        recurring_end_date: null,
        notes: [p.supplier, p.notes].filter(Boolean).join(" · ") || null,
        created_by: "",
        created_at: p.purchased_at || "",
        _fromPurchaseOrders: true,
      }));
    const expenseRows = oneOffs.map(e => ({ ...e, _fromPurchaseOrders: false }));
    return [...expenseRows, ...purchaseRows].sort((a, b) => {
      const da = a.expense_date || a.created_at;
      const db = b.expense_date || b.created_at;
      return db.localeCompare(da);
    });
  }, [oneOffs, purchaseExpenses]);

  // P&L data for selected month
  const plStart = format(startOfMonth(plMonth), "yyyy-MM-dd");
  const plEnd = format(endOfMonth(plMonth), "yyyy-MM-dd");

  const { data: plBookings = [] } = useQuery({
    queryKey: ["pl-bookings", plStart, plEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("total_price, status")
        .gte("booking_date", plStart)
        .lte("booking_date", plEnd)
        .in("status", ["Completed", "No Show"]);
      return (data ?? []) as any[];
    },
  });

  const { data: plCommissions = [] } = useQuery({
    queryKey: ["pl-commissions", plStart, plEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_records")
        .select("groomer_pay")
        .gte("created_at", `${plStart}T00:00:00`)
        .lte("created_at", `${plEnd}T23:59:59`);
      return (data ?? []) as any[];
    },
  });

  const { data: plOneOffs = [] } = useQuery({
    queryKey: ["pl-oneoffs", plStart, plEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("amount")
        .eq("expense_type", "one_off")
        .gte("expense_date", plStart)
        .lte("expense_date", plEnd);
      return (data ?? []) as any[];
    },
  });

  // Purchases for P&L month
  const { data: plPurchases = [] } = useQuery({
    queryKey: ["pl-purchases", plStart, plEnd],
    queryFn: async () => {
      const { data } = await (supabase.from("purchases" as any) as any)
        .select("total_price")
        .eq("is_returned", false)
        .gte("purchased_at", `${plStart}T00:00:00`)
        .lte("purchased_at", `${plEnd}T23:59:59`);
      return (data ?? []) as any[];
    },
  });

  // Compare month data
  const cmpStart = compareMonth ? format(startOfMonth(compareMonth), "yyyy-MM-dd") : null;
  const cmpEnd = compareMonth ? format(endOfMonth(compareMonth), "yyyy-MM-dd") : null;

  const { data: cmpBookings = [] } = useQuery({
    queryKey: ["cmp-bookings", cmpStart, cmpEnd],
    queryFn: async () => {
      if (!cmpStart || !cmpEnd) return [];
      const { data } = await supabase
        .from("bookings")
        .select("total_price, status")
        .gte("booking_date", cmpStart)
        .lte("booking_date", cmpEnd)
        .in("status", ["Completed", "No Show"]);
      return (data ?? []) as any[];
    },
    enabled: !!compareMonth,
  });

  const { data: cmpCommissions = [] } = useQuery({
    queryKey: ["cmp-commissions", cmpStart, cmpEnd],
    queryFn: async () => {
      if (!cmpStart || !cmpEnd) return [];
      const { data } = await supabase
        .from("commission_records")
        .select("groomer_pay")
        .gte("created_at", `${cmpStart}T00:00:00`)
        .lte("created_at", `${cmpEnd}T23:59:59`);
      return (data ?? []) as any[];
    },
    enabled: !!compareMonth,
  });

  const { data: cmpOneOffs = [] } = useQuery({
    queryKey: ["cmp-oneoffs", cmpStart, cmpEnd],
    queryFn: async () => {
      if (!cmpStart || !cmpEnd) return [];
      const { data } = await supabase
        .from("expenses")
        .select("amount")
        .eq("expense_type", "one_off")
        .gte("expense_date", cmpStart)
        .lte("expense_date", cmpEnd);
      return (data ?? []) as any[];
    },
    enabled: !!compareMonth,
  });

  const { data: cmpPurchases = [] } = useQuery({
    queryKey: ["cmp-purchases", cmpStart, cmpEnd],
    queryFn: async () => {
      if (!cmpStart || !cmpEnd) return [];
      const { data } = await (supabase.from("purchases" as any) as any)
        .select("total_price")
        .eq("is_returned", false)
        .gte("purchased_at", `${cmpStart}T00:00:00`)
        .lte("purchased_at", `${cmpEnd}T23:59:59`);
      return (data ?? []) as any[];
    },
    enabled: !!compareMonth,
  });

  // Calculations
  const totalMonthlyRecurring = recurring.reduce((s, e) => s + toMonthly(Number(e.amount), e.frequency || "monthly"), 0);
  const totalOneOffs = allOneOffs.reduce((s, e) => s + Number(e.amount), 0);

  const calcPL = useCallback((bookings: any[], commissions: any[], oneOffs: any[], purchases: any[], monthRef: Date) => {
    const revenue = bookings.reduce((s: number, b: any) => s + Number(b.total_price), 0);
    const groomerPay = commissions.reduce((s: number, c: any) => s + Number(c.groomer_pay), 0);
    const oneOffCosts = oneOffs.reduce((s: number, e: any) => s + Number(e.amount), 0);
    const purchaseCosts = purchases.reduce((s: number, p: any) => s + Number(p.total_price || 0), 0);
    const isCurrentMonth = isSameMonth(monthRef, new Date());
    const dateAware = calcDateAwareExpenses(recurring, monthRef);
    const recurringCostsPaid = isCurrentMonth ? dateAware.paidTotal : dateAware.fullMonthTotal;
    const recurringCostsUpcoming = isCurrentMonth ? dateAware.upcomingTotal : 0;
    const totalOneOffCosts = oneOffCosts + purchaseCosts;
    const netProfit = revenue - groomerPay - recurringCostsPaid - totalOneOffCosts;
    return { revenue, groomerPay, recurringCostsPaid, recurringCostsUpcoming, oneOffCosts: totalOneOffCosts, netProfit, isCurrentMonth };
  }, [recurring]);

  const pl = calcPL(plBookings, plCommissions, plOneOffs, plPurchases, plMonth);
  const cmpPl = compareMonth ? calcPL(cmpBookings, cmpCommissions, cmpOneOffs, cmpPurchases, compareMonth) : null;

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, name: e.target.value }));
  }, []);

  const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, notes: e.target.value }));
  }, []);

  const handleAmountChange = useCallback((amount: number) => {
    setForm((prev) => ({ ...prev, amount }));
  }, []);

  const handleCategoryChange = useCallback((category: string) => {
    setForm((prev) => ({ ...prev, category }));
  }, []);

  const handleFrequencyChange = useCallback((frequency: string) => {
    setForm((prev) => ({ ...prev, frequency }));
  }, []);

  const handleStartDateChange = useCallback((recurring_start_date: Date | undefined) => {
    setForm((prev) => ({ ...prev, recurring_start_date }));
  }, []);

  const handleEndDateChange = useCallback((recurring_end_date: Date | undefined) => {
    setForm((prev) => ({ ...prev, recurring_end_date }));
  }, []);

  const handleExpenseDateChange = useCallback((expense_date: Date | undefined) => {
    setForm((prev) => ({ ...prev, expense_date }));
  }, []);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (type: "recurring" | "one_off") => {
      if (!user) throw new Error("Not logged in");
      if (!form.name.trim()) throw new Error("Name is required");
      if (form.amount <= 0) throw new Error("Amount must be greater than 0");

      const row: any = {
        name: form.name.trim(),
        category: form.category,
        amount: form.amount,
        expense_type: type,
        notes: form.notes.trim() || null,
        created_by: user.id,
      };

      if (type === "recurring") {
        row.frequency = form.frequency;
        row.recurring_start_date = form.recurring_start_date ? format(form.recurring_start_date, "yyyy-MM-dd") : null;
        row.recurring_end_date = form.recurring_end_date ? format(form.recurring_end_date, "yyyy-MM-dd") : null;
      } else {
        row.expense_date = form.expense_date ? format(form.expense_date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
      }

      if (editingId) {
        const { error } = await supabase.from("expenses").update(row).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expenses").insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Expense updated ✅" : "Expense added ✅");
      setRecurringOpen(false);
      setOneOffOpen(false);
      setEditingId(null);
      setForm({ ...emptyForm });
      queryClient.invalidateQueries({ queryKey: ["expenses-recurring"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-oneoff"] });
      queryClient.invalidateQueries({ queryKey: ["pl-oneoffs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense deleted");
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["expenses-recurring"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-oneoff"] });
      queryClient.invalidateQueries({ queryKey: ["pl-oneoffs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = useCallback((expense: ExpenseRow) => {
    setEditingId(expense.id);
    setForm({
      name: expense.name,
      category: expense.category,
      amount: Number(expense.amount),
      frequency: expense.frequency || "monthly",
      expense_date: expense.expense_date ? parseISO(expense.expense_date) : new Date(),
      recurring_start_date: expense.recurring_start_date ? parseISO(expense.recurring_start_date) : new Date(),
      recurring_end_date: expense.recurring_end_date ? parseISO(expense.recurring_end_date) : undefined,
      notes: expense.notes || "",
    });
    if (expense.expense_type === "recurring") setRecurringOpen(true);
    else setOneOffOpen(true);
  }, []);

  return (
    <div className="space-y-6">
      {/* P&L Summary */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setPlMonth(m => subMonths(m, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <h2 className="text-lg font-heading font-bold">{format(plMonth, "MMMM yyyy")} Summary</h2>
            <Button variant="ghost" size="icon" onClick={() => setPlMonth(m => addMonths(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => setCompareMonth(prev => prev ? null : subMonths(plMonth, 1))}
          >
            <ArrowLeftRight className="h-3 w-3 mr-1" />
            {compareMonth ? "Hide comparison" : "Compare months"}
          </Button>
        </div>
        <div className={cn("grid gap-4", compareMonth ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 max-w-md")}>
          <PLCard title={format(plMonth, "MMMM yyyy")} data={pl} />
          {compareMonth && cmpPl && (
            <PLCard title={format(compareMonth, "MMMM yyyy")} data={cmpPl} />
          )}
        </div>
      </div>

      {/* Recurring Expenses */}
      <Card className="rounded-xl">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Monthly Outgoings</CardTitle>
            <Button size="sm" onClick={() => { setEditingId(null); setForm({ ...emptyForm }); setRecurringOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Recurring Expense
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {recurring.length > 0 ? (
            <div className="space-y-2">
              {recurring.map(e => {
                const cat = getCategoryDisplay(e.category);
                const monthly = toMonthly(Number(e.amount), e.frequency || "monthly");
                return (
                  <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <span className="text-lg">{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{e.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {cat.label} · {e.frequency || "monthly"}
                        {e.recurring_end_date && ` · ends ${format(parseISO(e.recurring_end_date), "MMM yyyy")}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">£{Number(e.amount).toFixed(2)}</p>
                      {e.frequency !== "monthly" && (
                        <p className="text-xs text-muted-foreground">≈ £{monthly.toFixed(2)}/mo</p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                );
              })}
              <div className="flex justify-between items-center pt-3 border-t">
                <span className="text-sm font-medium">Total monthly outgoings</span>
                <span className="text-lg font-bold">£{totalMonthlyRecurring.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No recurring expenses added yet</p>
          )}
        </CardContent>
      </Card>

      {/* One-off Purchases */}
      <Card className="rounded-xl">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold">Additional Purchases</CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {([["month", "This month"], ["3months", "Last 3 months"], ["year", "This year"]] as const).map(([k, l]) => (
                  <Button key={k} variant={oneOffFilter === k ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setOneOffFilter(k)}>
                    {l}
                  </Button>
                ))}
              </div>
              <Button size="sm" onClick={() => { setEditingId(null); setForm({ ...emptyForm }); setOneOffOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Add Purchase
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {allOneOffs.length > 0 ? (
            <div className="space-y-2">
              {allOneOffs.map(e => {
                const cat = getCategoryDisplay(e.category);
                const isPO = !!(e as any)._fromPurchaseOrders;
                return (
                  <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <span className="text-lg">{isPO ? "🛒" : cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {e.name}
                        {isPO && <Badge variant="outline" className="ml-2 text-[10px] py-0">Purchase Order</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {e.expense_date ? format(parseISO(e.expense_date), "dd MMM yyyy") : "—"} · {cat.label}
                        {e.notes && ` · ${e.notes}`}
                      </p>
                    </div>
                    <span className="text-sm font-semibold shrink-0">£{Number(e.amount).toFixed(2)}</span>
                    {!isPO && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </>
                    )}
                  </div>
                );
              })}
              <div className="flex justify-between items-center pt-3 border-t">
                <span className="text-sm font-medium">Total purchases</span>
                <span className="text-lg font-bold">£{totalOneOffs.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No purchases in this period</p>
          )}
        </CardContent>
      </Card>

      {/* Recurring Dialog */}
      <Dialog open={recurringOpen} onOpenChange={v => { setRecurringOpen(v); if (!v) setEditingId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Recurring Expense" : "Add Recurring Expense"}</DialogTitle>
          </DialogHeader>
          <ExpenseForm
            type="recurring"
            form={form}
            onNameChange={handleNameChange}
            onNotesChange={handleNotesChange}
            onAmountChange={handleAmountChange}
            onCategoryChange={handleCategoryChange}
            onFrequencyChange={handleFrequencyChange}
            onStartDateChange={handleStartDateChange}
            onEndDateChange={handleEndDateChange}
            onExpenseDateChange={handleExpenseDateChange}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecurringOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate("recurring")} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : editingId ? "Update Expense" : "Add Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One-off Dialog */}
      <Dialog open={oneOffOpen} onOpenChange={v => { setOneOffOpen(v); if (!v) setEditingId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Purchase" : "Add Purchase"}</DialogTitle>
          </DialogHeader>
          <ExpenseForm
            type="one_off"
            form={form}
            onNameChange={handleNameChange}
            onNotesChange={handleNotesChange}
            onAmountChange={handleAmountChange}
            onCategoryChange={handleCategoryChange}
            onFrequencyChange={handleFrequencyChange}
            onStartDateChange={handleStartDateChange}
            onEndDateChange={handleEndDateChange}
            onExpenseDateChange={handleExpenseDateChange}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOneOffOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate("one_off")} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : editingId ? "Update Purchase" : "Add Purchase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
