import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Copy, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AIIssue {
  name: string;
  plain_english: string;
  business_impact: string;
  lovable_prompt: string;
  priority: number;
}

interface AIAnalysis {
  summary: string;
  issues: AIIssue[];
}

interface HealthAIAnalysisProps {
  healthResults: Record<string, any>;
  checksFinished: boolean;
}

export function HealthAIAnalysis({ healthResults, checksFinished }: HealthAIAnalysisProps) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("health-ai-analyst", {
        body: { healthResults },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      setAnalysis(data);
    } catch (e: any) {
      console.error("AI analysis error:", e);
      setError(e.message || "Failed to run AI analysis");
      toast.error("AI analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Fix prompt copied to clipboard ✅");
  };

  if (!checksFinished) return null;

  const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
    1: { label: "CRITICAL", color: "bg-red-100 text-red-800 border-red-300" },
    2: { label: "HIGH", color: "bg-orange-100 text-orange-800 border-orange-300" },
    3: { label: "MEDIUM", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
    4: { label: "LOW", color: "bg-blue-100 text-blue-800 border-blue-300" },
  };

  return (
    <div className="space-y-4">
      {!analysis && !loading && (
        <Button onClick={runAnalysis} variant="outline" className="gap-2">
          <Bot className="h-4 w-4" />
          🤖 AI Analysis
        </Button>
      )}

      {loading && (
        <Card>
          <CardContent className="p-6 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Analysing system health with AI…</span>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-sm text-red-700">{error}</p>
            <Button onClick={runAnalysis} variant="outline" size="sm" className="mt-2">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <div className="space-y-4">
          {/* Summary */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-5 w-5" />
                AI System Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm leading-relaxed">{analysis.summary}</p>
            </CardContent>
          </Card>

          {/* Issues */}
          {analysis.issues.length === 0 ? (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-sm text-green-800 font-medium">No issues detected — all systems healthy</span>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Issues by Priority ({analysis.issues.length})
              </h3>
              {analysis.issues.map((issue, idx) => {
                const priorityCfg = PRIORITY_LABELS[issue.priority] || PRIORITY_LABELS[4];
                return (
                  <Card key={idx} className="border">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm font-medium flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                          {issue.name}
                        </span>
                        <Badge variant="outline" className={`text-[10px] ${priorityCfg.color}`}>
                          P{issue.priority} — {priorityCfg.label}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">What's broken</p>
                        <p className="text-sm">{issue.plain_english}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Business impact</p>
                        <p className="text-sm">{issue.business_impact}</p>
                      </div>
                      <div className="bg-muted/50 rounded-md p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold text-muted-foreground">Lovable Fix Prompt</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => copyToClipboard(issue.lovable_prompt)}
                          >
                            <Copy className="h-3 w-3" />
                            Copy Fix Prompt
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed">
                          {issue.lovable_prompt}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Re-run button */}
          <Button onClick={runAnalysis} variant="outline" size="sm" className="gap-2" disabled={loading}>
            <Bot className="h-4 w-4" />
            Re-analyse
          </Button>
        </div>
      )}
    </div>
  );
}
