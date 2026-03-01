import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Scissors, Droplets, UtensilsCrossed } from "lucide-react";
import CodeOfConduct from "@/components/staff/CodeOfConduct";

interface RuleFolder {
  title: string;
  icon: React.ElementType;
  color: string;
  count: number;
  rules: { number: number; title: string; description: string }[];
}

const ruleFolders: RuleFolder[] = [
  {
    title: "Grooming Room Rules",
    icon: Scissors,
    color: "text-primary",
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
    icon: Droplets,
    color: "text-blue-500",
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
    icon: UtensilsCrossed,
    color: "text-amber-600",
    count: 8,
    rules: [
      { number: 1, title: "Follow Manufacturer's Guidelines for Equipment Use", description: "Ensure all kitchen appliances, such as washing machine, fridge, and dryer, are used and maintained according to instructions to prevent breakdowns." },
      { number: 2, title: "Keep the Area Clean and Sanitised", description: "Wipe down surfaces, disinfect food preparation areas, and wash dishes promptly to prevent bacteria buildup." },
      { number: 3, title: "Dispose of Waste Correctly", description: "Regularly empty bins and dispose of expired food to prevent odours and pests." },
      { number: 4, title: "Avoid Cross-Contamination", description: "Use separate utensils and cutting boards to maintain hygiene for raw meat, dog food, and other items." },
      { number: 5, title: "Ensure Proper Ventilation", description: "Keep the area well-ventilated to prevent odours and maintain air quality." },
      { number: 6, title: "Keep Chemicals and Cleaning Supplies Out of Reach", description: "Store detergents, disinfectants, and other hazardous substances securely away from food and animals." },
      { number: 7, title: "Wipe Up Spills Immediately", description: "Prevent slips and falls by cleaning up any liquids or food spills straight away." },
      { number: 8, title: "Monitor Electrical Safety", description: "Switch off and unplug appliances when not in use to prevent fire hazards and energy waste." },
    ],
  },
];

const RulesPage = () => {
  const [openFolders, setOpenFolders] = useState<Record<number, boolean>>({});

  const toggle = (idx: number) =>
    setOpenFolders((prev) => ({ ...prev, [idx]: !prev[idx] }));

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-heading text-foreground">Room Rules</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Safety and hygiene rules for each area of the studio
          </p>
        </div>

        <div className="space-y-4">
          {ruleFolders.map((folder, idx) => (
            <Collapsible
              key={idx}
              open={openFolders[idx] ?? false}
              onOpenChange={() => toggle(idx)}
            >
              <Card className="overflow-hidden">
                <CollapsibleTrigger className="w-full text-left">
                  <CardHeader className="flex flex-row items-center justify-between py-4 cursor-pointer hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-muted ${folder.color}`}>
                        <folder.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{folder.title}</CardTitle>
                        <p className="text-sm text-muted-foreground font-normal mt-0.5">
                          {folder.count} rules
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-normal">
                        {folder.count} rules
                      </Badge>
                      <ChevronDown
                        className={`h-5 w-5 text-muted-foreground transition-transform ${
                          openFolders[idx] ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 pb-5">
                    <div className="space-y-3">
                      {folder.rules.map((rule) => (
                        <div
                          key={rule.number}
                          className="flex gap-3 p-3 rounded-xl bg-muted/40 border border-border/40"
                        >
                          <span className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                            {rule.number}
                          </span>
                          <div>
                            <p className="font-medium text-foreground text-sm">
                              {rule.title}
                            </p>
                            <p className="text-muted-foreground text-sm mt-0.5">
                              {rule.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>

        <CodeOfConduct />
      </div>
    </AppLayout>
  );
};

export default RulesPage;
