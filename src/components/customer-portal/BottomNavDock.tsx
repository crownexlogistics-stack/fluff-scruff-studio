import { Dog, CalendarCheck, Camera, Lightbulb } from "lucide-react";

export type PortalTab = "pets" | "bookings" | "pictures" | "advice";

interface BottomNavDockProps {
  activeTab: PortalTab;
  onTabChange: (tab: PortalTab) => void;
  unreadAdvice?: number;
}

const tabs: { id: PortalTab; label: string; icon: typeof Dog }[] = [
  { id: "pets", label: "My Pets", icon: Dog },
  { id: "bookings", label: "My Bookings", icon: CalendarCheck },
  { id: "pictures", label: "My Pictures", icon: Camera },
  { id: "advice", label: "My Advice", icon: Lightbulb },
];

export function BottomNavDock({ activeTab, onTabChange }: BottomNavDockProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-2xl border-t border-border/30 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
      <div className="max-w-lg mx-auto flex">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 pt-2.5 transition-all duration-200 ${
                isActive
                  ? "text-accent"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className={`p-1 rounded-xl transition-colors ${isActive ? "bg-accent/10" : ""}`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className={`text-[10px] font-medium font-body ${isActive ? "text-accent" : ""}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
