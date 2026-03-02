import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Eye } from "lucide-react";

const TermsEditorPage = () => {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState(false);

  const { data: saved, isLoading } = useQuery({
    queryKey: ["site_config", "terms_and_conditions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_config")
        .select("value")
        .eq("key", "terms_and_conditions")
        .maybeSingle();
      if (error) throw error;
      return (data?.value as string) ?? "";
    },
  });

  useEffect(() => {
    if (saved !== undefined && content === "") {
      setContent(saved);
    }
  }, [saved]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("site_config").upsert({
        key: "terms_and_conditions",
        value: JSON.stringify(content),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site_config", "terms_and_conditions"] });
      toast.success("Terms & Conditions saved!");
    },
    onError: () => toast.error("Failed to save — please try again"),
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading text-foreground">Terms & Conditions</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Edit your customer-facing T&Cs. Use HTML for formatting (h2, p, strong, ul, li).
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPreview(!preview)}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              {preview ? "Edit" : "Preview"}
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            {preview ? (
              <div
                className="prose prose-sm max-w-none text-foreground [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2 [&_p]:text-muted-foreground [&_p]:mb-3 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_li]:text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            ) : (
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[500px] font-mono text-sm"
                placeholder="Enter your Terms & Conditions HTML here..."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default TermsEditorPage;
