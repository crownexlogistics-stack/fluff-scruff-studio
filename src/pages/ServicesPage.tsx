import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const ServicesPage = () => {
  const queryClient = useQueryClient();

  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: breeds } = useQuery({
    queryKey: ["breeds"],
    queryFn: async () => {
      const { data, error } = await supabase.from("breeds").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: prices } = useQuery({
    queryKey: ["service-prices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_prices").select("*");
      if (error) throw error;
      return data;
    },
  });

  const upsertPrice = useMutation({
    mutationFn: async ({ service_id, breed_id, price }: { service_id: string; breed_id: string; price: number }) => {
      const { error } = await supabase.from("service_prices").upsert(
        { service_id, breed_id, price },
        { onConflict: "service_id,breed_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-prices"] });
      toast.success("Price updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getPrice = (serviceId: string, breedId: string) => {
    return prices?.find((p) => p.service_id === serviceId && p.breed_id === breedId)?.price ?? "";
  };

  const handlePriceChange = (serviceId: string, breedId: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;
    upsertPrice.mutate({ service_id: serviceId, breed_id: breedId, price: num });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">Service Pricing</h1>
          <p className="text-muted-foreground mt-1">Set prices for each service by breed</p>
        </div>

        {!breeds?.length ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Add some breeds first to set pricing.</CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card z-10">Service</TableHead>
                    {breeds?.map((breed) => (
                      <TableHead key={breed.id} className="text-center min-w-[120px]">
                        <div>{breed.name}</div>
                        <div className="text-xs font-normal text-muted-foreground">{breed.size_category}</div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services?.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium sticky left-0 bg-card z-10">
                        <div>{service.name}</div>
                        <div className="text-xs text-muted-foreground">{service.description}</div>
                      </TableCell>
                      {breeds?.map((breed) => (
                        <TableCell key={breed.id} className="text-center">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
                            <Input
                              type="number"
                              min={0}
                              step={0.5}
                              className="w-24 mx-auto pl-6 text-center"
                              defaultValue={getPrice(service.id, breed.id)}
                              onBlur={(e) => handlePriceChange(service.id, breed.id, e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default ServicesPage;
