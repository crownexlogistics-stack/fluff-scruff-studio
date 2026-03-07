export type PortalTab = "pets" | "bookings" | "pictures" | "advice";

interface BottomNavDockProps {
  activeTab: PortalTab;
  onTabChange: (tab: PortalTab) => void;
  unreadAdvice?: number;
}

const tabs: { id: PortalTab; label: string; emoji: string }[] = [
  { id: "pets", label: "My Pets", emoji: "🐾" },
  { id: "bookings", label: "Bookings", emoji: "📅" },
  { id: "pictures", label: "Photos", emoji: "📸" },
  { id: "advice", label: "Advice", emoji: "💡" },
];

export function BottomNavDock({ activeTab, onTabChange }: BottomNavDockProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border/30 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
      <div className="max-w-lg mx-auto flex">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
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
              <span className="text-lg leading-none">{tab.emoji}</span>
              <span className={`text-[10px] font-bold font-body ${isActive ? "text-accent" : "text-muted-foreground"}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
