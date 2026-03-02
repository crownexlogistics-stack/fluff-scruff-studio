import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";

function formatDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function GroomerBreedsTab() {
  const [search, setSearch] = useState("");

  const { data: breeds, isLoading } = useQuery({
    queryKey: ["breeds"],
    queryFn: async () => {
      const { data, error } = await supabase.from("breeds").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = breeds?.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Breed info, pricing & duration (read-only)</p>
      <Input placeholder="Search breeds…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Breed</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Bath & Brush</TableHead>
                <TableHead className="text-right">Full Groom</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">Loading...</TableCell></TableRow>
              ) : filtered?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">No breeds found.</TableCell></TableRow>
              ) : (
                filtered?.map((breed) => (
                  <TableRow key={breed.id}>
                    <TableCell className="font-medium text-sm">{breed.name}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                        {breed.size_category}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm">£{breed.price_bath_brush}</TableCell>
                    <TableCell className="text-right text-sm">£{breed.price_full_groom}</TableCell>
                    <TableCell className="text-right text-sm">{formatDuration(breed.duration_minutes)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
