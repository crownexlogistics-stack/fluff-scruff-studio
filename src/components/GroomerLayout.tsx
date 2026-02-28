import { CalendarDays, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo-transparent.png";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

interface GroomerLayoutProps {
  children: React.ReactNode;
}

export function GroomerLayout({ children }: GroomerLayoutProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex w-full">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-border flex flex-col">
        <div className="p-4 flex items-center gap-3">
          <img src={logo} alt="Fluff & Scruff" className="h-10 w-auto brightness-0 invert opacity-90" />
          <div>
            <h1 className="font-heading text-lg font-bold text-sidebar-primary-foreground leading-tight">Staff Portal</h1>
            <p className="text-xs text-sidebar-foreground/60">Groomer View</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4">
          <a
            href="/portal"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sidebar-accent text-sidebar-primary font-medium text-sm"
          >
            <CalendarDays className="h-4 w-4" />
            My Schedule
          </a>
        </nav>

        <div className="p-3 border-t border-border">
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/70" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
