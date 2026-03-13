import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileText, ShieldCheck, ScrollText, Scissors, Download, ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import { ContractContent } from "@/components/staff/ContractPreviewDialog";
import { HealthAndSafetyContent } from "@/components/staff/HealthAndSafetyContent";
import CodeOfConduct from "@/components/staff/CodeOfConduct";
import { downloadDocumentPdf } from "@/lib/downloadDocumentPdf";
import { toast } from "sonner";

// Room rules data (same as RulesPage)
const ruleFolders = [
  {
    title: "Grooming Room Rules",
    icon: Scissors,
    count: 10,
    rules: [
      { number: 1, title: "Never Leave a Dog Unattended on the Table", description: "Always watch the dog during grooming to prevent accidents or injuries." },
      { number: 2, title: "Switch Off All Electrical Appliances After Use", description: "When not in use, ensure that clippers, dryers, and other tools are turned off and unplugged." },
      { number: 3, title: "Clean and Sanitize Grooming Tools", description: "To maintain hygiene, wash and disinfect all brushes, clippers, scissors, and other equipment after every grooming session." },
      { number: 4, title: "Keep the Grooming Area Tidy", description: "Organize tools, sweep up hair, and remove any clutter to ensure a safe and clean environment." },
      { number: 5, title: "Ensure the Area Is Hazard-Free", description: "Check for loose cords, spills, or sharp objects that could harm the dog or you." },
      { number: 6, title: "Use Proper Restraints Safely", description: "Secure the dog gently but firmly with grooming loops or harnesses to prevent sudden movements without causing discomfort." },
      { number: 7, title: "Monitor the Dog's Stress Levels", description: "Take breaks as needed and watch for signs of distress, such as excessive panting or whining." },
      { number: 8, title: "Avoid Overheating Tools", description: "Regularly check the temperature of clippers, dryers, and other tools to prevent burns or discomfort to the dog." },
      { number: 9, title: "Brush Out Mats and Tangles Gently", description: "Use appropriate tools and techniques to avoid causing pain while detangling the coat." },
      { number: 10, title: "Follow Breed-Specific Grooming Guidelines", description: "Understand the grooming requirements for the dog's breed to achieve the best results and maintain their health." },
    ],
  },
  {
    title: "Bathing Area Rules",
    icon: Scissors,
    count: 9,
    rules: [
      { number: 1, title: "Never Leave a Dog Unattended in the Bathing Area", description: "Always supervise the dog to prevent slipping, drowning, or injury." },
      { number: 2, title: "Use Equipment According to Manufacturer's Guidelines", description: "Follow the correct usage instructions for bathing tools to prevent damage and ensure efficiency." },
      { number: 3, title: "Check Water Temperature Before Bathing", description: "Ensure the water is lukewarm to avoid scalding or chilling the dog." },
      { number: 4, title: "Prevent Water from Entering Ears and Eyes", description: "Use cotton balls in the ears if necessary and avoid direct contact with soap and water in sensitive areas." },
      { number: 5, title: "Keep the Bathing Area Clean and Dry", description: "Wipe up spills immediately to prevent slips and maintain hygiene." },
      { number: 6, title: "Secure the Dog Properly", description: "Use gentle restraints to prevent sudden movements without causing discomfort." },
      { number: 7, title: "Rinse Thoroughly to Avoid Residue", description: "Ensure all shampoo and conditioner are completely washed out to prevent skin irritation." },
      { number: 8, title: "Dry the Dog Properly", description: "Use towels or a pet dryer at a safe temperature to prevent chills, and never leave a wet dog unattended." },
      { number: 9, title: "Monitor the Dog's Comfort", description: "Watch for signs of stress or discomfort and take breaks if necessary to ensure a positive bathing experience." },
    ],
  },
  {
    title: "Kitchen Area Rules",
    icon: Scissors,
    count: 8,
    rules: [
      { number: 1, title: "Follow Manufacturer's Guidelines for Equipment Use", description: "Ensure all kitchen appliances are used and maintained according to instructions." },
      { number: 2, title: "Keep the Area Clean and Sanitised", description: "Wipe down surfaces, disinfect preparation areas, and wash dishes promptly." },
      { number: 3, title: "Dispose of Waste Correctly", description: "Regularly empty bins and dispose of expired food." },
      { number: 4, title: "Avoid Cross-Contamination", description: "Use separate utensils and cutting boards for different items." },
      { number: 5, title: "Ensure Proper Ventilation", description: "Keep the area well-ventilated to maintain air quality." },
      { number: 6, title: "Keep Chemicals Out of Reach", description: "Store detergents and hazardous substances securely away from food and animals." },
      { number: 7, title: "Wipe Up Spills Immediately", description: "Prevent slips and falls by cleaning up any liquids straight away." },
      { number: 8, title: "Monitor Electrical Safety", description: "Switch off and unplug appliances when not in use." },
    ],
  },
];

type DocView = null | "contract" | "health-safety" | "room-rules" | "code-of-conduct";

export function GroomerDocumentsTab({ staffId }: { staffId: string }) {
  const [activeDoc, setActiveDoc] = useState<DocView>(null);
  const [downloading, setDownloading] = useState(false);

  const { data: staff } = useQuery({
    queryKey: ["staff-doc", staffId],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("*").eq("id", staffId).single();
      if (error) throw error;
      return data;
    },
  });

  const docCards: { id: DocView; icon: React.ElementType; title: string; subtitle: string; badge?: string; download?: boolean }[] = [
    { id: "contract", icon: FileText, title: "My Contract", subtitle: "Self-employed groomer agreement", badge: staff?.contract_status === "signed" ? "Signed" : undefined, download: true },
    { id: "health-safety", icon: ShieldCheck, title: "Health & Safety Policy", subtitle: "12-section workplace safety policy", badge: (staff as any)?.hs_status === "signed" ? "Signed" : undefined },
    { id: "room-rules", icon: Scissors, title: "Room Rules", subtitle: "Grooming, bathing & kitchen area rules" },
    { id: "code-of-conduct", icon: ScrollText, title: "Code of Conduct", subtitle: "Professional standards & expectations" },
    
  ];

  if (activeDoc) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setActiveDoc(null)} className="gap-1.5 -ml-2">
          <ArrowLeft className="h-4 w-4" /> Back to Documents
        </Button>

        {activeDoc === "contract" && staff && (
          <Card>
            <CardContent className="p-4 md:p-6">
              <ScrollArea className="h-[70vh]">
                <div className="pr-4">
                  <ContractContent staff={staff} />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {activeDoc === "health-safety" && staff && (
          <Card>
            <CardContent className="p-4 md:p-6">
              <ScrollArea className="h-[70vh]">
                <div className="pr-4">
                  <HealthAndSafetyContent staff={staff as any} />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {activeDoc === "room-rules" && (
          <ScrollArea className="h-[70vh]">
            <div className="space-y-4 pr-4">
              {ruleFolders.map((folder, idx) => (
                <Card key={idx}>
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-heading font-semibold text-base">{folder.title}</h3>
                    {folder.rules.map((rule) => (
                      <div key={rule.number} className="flex gap-3 p-3 rounded-xl bg-muted/40 border border-border/40">
                        <span className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary font-semibold text-sm">{rule.number}</span>
                        <div>
                          <p className="font-medium text-foreground text-sm">{rule.title}</p>
                          <p className="text-muted-foreground text-sm mt-0.5">{rule.description}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}

        {activeDoc === "code-of-conduct" && <CodeOfConduct />}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {docCards.map((doc) => (
        <button
          key={doc.id}
          onClick={() => setActiveDoc(doc.id)}
          className="w-full text-left rounded-2xl border border-border bg-card p-4 hover:shadow-md transition-all active:scale-[0.98] flex items-center gap-3"
        >
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
            <doc.icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground text-sm">{doc.title}</p>
              {doc.badge && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{doc.badge}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{doc.subtitle}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      ))}
    </div>
  );
}
