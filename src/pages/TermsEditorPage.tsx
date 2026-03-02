import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Eye, Plus, Trash2, GripVertical } from "lucide-react";

interface TcSection {
  title: string;
  paragraphs: string[];
}

function sectionsToHtml(sections: TcSection[]): string {
  return sections
    .map(
      (s) =>
        `<h2>${s.title}</h2>` +
        s.paragraphs.map((p) => `<p>${p}</p>`).join("")
    )
    .join("");
}

function htmlToSections(html: string): TcSection[] {
  if (!html || !html.trim()) return [{ title: "", paragraphs: [""] }];

  const sections: TcSection[] = [];
  // Split on <h2> tags
  const parts = html.split(/<h2>/i);

  for (const part of parts) {
    if (!part.trim()) continue;
    const h2End = part.indexOf("</h2>");
    if (h2End === -1) {
      // No h2 closing tag — treat as paragraphs under last section
      const paragraphs = extractParagraphs(part);
      if (sections.length > 0) {
        sections[sections.length - 1].paragraphs.push(...paragraphs);
      } else {
        sections.push({ title: "", paragraphs });
      }
      continue;
    }
    const title = part.substring(0, h2End).replace(/<[^>]*>/g, "").trim();
    const rest = part.substring(h2End + 5);
    const paragraphs = extractParagraphs(rest);
    sections.push({ title, paragraphs: paragraphs.length > 0 ? paragraphs : [""] });
  }

  return sections.length > 0 ? sections : [{ title: "", paragraphs: [""] }];
}

function extractParagraphs(html: string): string[] {
  const result: string[] = [];
  const pParts = html.split(/<p>/i);
  for (const p of pParts) {
    const cleaned = p.replace(/<\/p>/gi, "").trim();
    if (cleaned) result.push(cleaned);
  }
  return result;
}

const TermsEditorPage = () => {
  const queryClient = useQueryClient();
  const [sections, setSections] = useState<TcSection[]>([]);
  const [preview, setPreview] = useState(false);
  const [loaded, setLoaded] = useState(false);

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
    if (saved !== undefined && !loaded) {
      setSections(htmlToSections(saved));
      setLoaded(true);
    }
  }, [saved, loaded]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const html = sectionsToHtml(sections);
      const { error } = await supabase.from("site_config").upsert({
        key: "terms_and_conditions",
        value: JSON.stringify(html),
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

  const updateSectionTitle = (idx: number, title: string) => {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, title } : s)));
  };

  const updateParagraph = (sIdx: number, pIdx: number, text: string) => {
    setSections((prev) =>
      prev.map((s, i) =>
        i === sIdx
          ? { ...s, paragraphs: s.paragraphs.map((p, j) => (j === pIdx ? text : p)) }
          : s
      )
    );
  };

  const addParagraph = (sIdx: number) => {
    setSections((prev) =>
      prev.map((s, i) =>
        i === sIdx ? { ...s, paragraphs: [...s.paragraphs, ""] } : s
      )
    );
  };

  const removeParagraph = (sIdx: number, pIdx: number) => {
    setSections((prev) =>
      prev.map((s, i) =>
        i === sIdx
          ? { ...s, paragraphs: s.paragraphs.filter((_, j) => j !== pIdx) }
          : s
      )
    );
  };

  const addSection = () => {
    setSections((prev) => [...prev, { title: "", paragraphs: [""] }]);
  };

  const removeSection = (idx: number) => {
    setSections((prev) => prev.filter((_, i) => i !== idx));
  };

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
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading text-foreground">Terms & Conditions</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Edit your customer-facing T&Cs section by section
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPreview(!preview)} className="gap-2">
              <Eye className="h-4 w-4" />
              {preview ? "Edit" : "Preview"}
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        {preview ? (
          <Card>
            <CardContent className="pt-6">
              <div
                className="prose prose-sm max-w-none text-foreground [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2 [&_p]:text-muted-foreground [&_p]:mb-3 [&_strong]:text-foreground"
                dangerouslySetInnerHTML={{ __html: sectionsToHtml(sections) }}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sections.map((section, sIdx) => (
              <Card key={sIdx} className="overflow-hidden">
                <CardContent className="pt-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    <Input
                      value={section.title}
                      onChange={(e) => updateSectionTitle(sIdx, e.target.value)}
                      placeholder={`Section ${sIdx + 1} heading (e.g. "1. Health and Vaccinations")`}
                      className="font-semibold text-base"
                    />
                    {sections.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSection(sIdx)}
                        className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {section.paragraphs.map((para, pIdx) => (
                    <div key={pIdx} className="flex gap-2 pl-7">
                      <Textarea
                        value={para}
                        onChange={(e) => updateParagraph(sIdx, pIdx, e.target.value)}
                        placeholder="Enter paragraph text..."
                        className="min-h-[80px] text-sm"
                      />
                      {section.paragraphs.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeParagraph(sIdx, pIdx)}
                          className="shrink-0 text-muted-foreground hover:text-destructive mt-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}

                  <button
                    onClick={() => addParagraph(sIdx)}
                    className="ml-7 text-xs text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add paragraph
                  </button>
                </CardContent>
              </Card>
            ))}

            <Button variant="outline" onClick={addSection} className="w-full gap-2">
              <Plus className="h-4 w-4" /> Add Section
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TermsEditorPage;
