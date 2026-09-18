import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { GroomerLayout } from "@/components/GroomerLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ban, History, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { BlacklistSearchTab } from "@/components/blacklist/BlacklistSearchTab";
import { BlacklistRecordList, type BlacklistRecord } from "@/components/blacklist/BlacklistRecordList";

export default function BlacklistPage() {
  const { user } = useAuth();
  const { role } = useUserRole(user?.id);
  const [tab, setTab] = useState("new");

  const { data: records = [], refetch } = useQuery({
    queryKey: ["customer_blacklist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_blacklist")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as BlacklistRecord[];
    },
  });

  const { data: attempts = {} } = useQuery({
    queryKey: ["blacklist_block_events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("blacklist_block_events").select("blacklist_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const e of data || []) {
        if (e.blacklist_id) counts[e.blacklist_id] = (counts[e.blacklist_id] || 0) + 1;
      }
      return counts;
    },
  });

  const active = records.filter((r) => r.status === "active");
  const removed = records.filter((r) => r.status === "removed");

  const activeKeys = new Set<string>();
  for (const r of active) {
    if (r.email) activeKeys.add(`email:${r.email.toLowerCase()}`);
    if (r.phone_normalised) activeKeys.add(`phone:${r.phone_normalised}`);
  }

  const content = (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <Ban className="h-6 w-6 text-destructive" />
          Blacklist
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Blocked customers can't book online, by phone or through the AI receptionist. They are never told why.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="new" className="gap-1.5">
            <Ban className="h-4 w-4" /> Make a new record
          </TabsTrigger>
          <TabsTrigger value="historic" className="gap-1.5">
            <History className="h-4 w-4" /> Historic record ({active.length})
          </TabsTrigger>
          <TabsTrigger value="unblocked" className="gap-1.5">
            <ShieldCheck className="h-4 w-4" /> Unblocked ({removed.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="mt-4">
          <BlacklistSearchTab
            activeKeys={activeKeys}
            onBlacklisted={() => {
              refetch();
              setTab("historic");
            }}
          />
        </TabsContent>

        <TabsContent value="historic" className="mt-4">
          <BlacklistRecordList records={active} mode="active" attempts={attempts} onChanged={() => refetch()} />
        </TabsContent>

        <TabsContent value="unblocked" className="mt-4">
          <BlacklistRecordList records={removed} mode="removed" onChanged={() => refetch()} />
        </TabsContent>
      </Tabs>
    </div>
  );

  return role === "groomer" ? <GroomerLayout>{content}</GroomerLayout> : <AppLayout>{content}</AppLayout>;
}
