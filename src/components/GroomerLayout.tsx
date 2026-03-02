import { CalendarDays, MessageSquare, Dog, PoundSterling, FileText, LogOut } from "lucide-react";
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
      <aside className="w-56 bg-sidebar border-r border-border flex flex-col shrink-0 hidden md:flex">
        <div className="p-4 flex items-center gap-3">
          <img src={logo} alt="Fluff & Scruff" className="h-10 w-auto brightness-0 invert opacity-90" />
          <div>
            <h1 className="font-heading text-base font-bold text-sidebar-primary-foreground leading-tight">Staff Portal</h1>
            <p className="text-[10px] text-sidebar-foreground/60">Groomer View</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <a
            href="/portal"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sidebar-accent text-sidebar-primary-foreground font-medium text-sm"
          >
            <CalendarDays className="h-4 w-4" />
            My Portal
          </a>
        </nav>

        <div className="p-3 border-t border-border">
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/70" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-border flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Fluff & Scruff" className="h-7 w-auto brightness-0 invert opacity-90" />
          <span className="font-heading text-sm font-bold text-sidebar-primary-foreground">Staff Portal</span>
        </div>
        <Button variant="ghost" size="sm" className="text-sidebar-foreground/70 h-8" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-6 overflow-auto md:mt-0 mt-12">
        {children}
      </main>
    </div>
  );
}
