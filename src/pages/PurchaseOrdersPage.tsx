import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PendingRequestsTab } from "@/components/purchase-orders/PendingRequestsTab";
import { AddPurchaseTab } from "@/components/purchase-orders/AddPurchaseTab";
import { PurchaseHistoryTab } from "@/components/purchase-orders/PurchaseHistoryTab";

const PurchaseOrdersPage = () => {
  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Purchase Orders</h1>
          <p className="text-muted-foreground text-sm mt-1">Equipment requests, purchases & stock tracking</p>
        </div>
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pending Requests</TabsTrigger>
            <TabsTrigger value="add">Add Purchase</TabsTrigger>
            <TabsTrigger value="history">Purchase History</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-4"><PendingRequestsTab /></TabsContent>
          <TabsContent value="add" className="mt-4"><AddPurchaseTab /></TabsContent>
          <TabsContent value="history" className="mt-4"><PurchaseHistoryTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default PurchaseOrdersPage;
