import { CalendarDays, MessageSquare, Dog, PoundSterling, FileText, LogOut, PawPrint, Package, ShoppingCart, Sparkles, Inbox } from "lucide-react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import logo from "@/assets/logo-transparent.png";
import { useAuth } from "@/hooks/useAuth";
import { useStaffIsCustomer } from "@/hooks/useStaffIsCustomer";
import { Button } from "@/components/ui/button";

interface GroomerLayoutProps {
  children: React.ReactNode;
}

const groomerNavItems = [
  { title: "My Portal", url: "/portal", icon: CalendarDays },
  { title: "Groomer Assistant", url: "/portal/assistant", icon: Sparkles },
  { title: "Bookings", url: "/portal/bookings", icon: CalendarDays },
  { title: "Messages", url: "/portal/messages", icon: MessageSquare },
  { title: "Package Deals", url: "/admin/packages", icon: Package },
  { title: "Purchase Requests", url: "/portal/purchases", icon: ShoppingCart },
  { title: "Breeds", url: "/portal/breeds", icon: Dog },
  { title: "Finance", url: "/portal/finance", icon: PoundSterling },
  { title: "Documents", url: "/portal/documents", icon: FileText },
  { title: "My Messages", url: "/portal/inbox", icon: Inbox },
];

export function GroomerLayout({ children }: GroomerLayoutProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasCustomerBookings } = useStaffIsCustomer(user?.email ?? undefined);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const isActive = (url: string) => {
    if (url === "/portal") return location.pathname === "/portal";
    return location.pathname === url || location.pathname.startsWith(url + "/");
  };

  return (
    <div className="min-h-screen flex w-full">
      {/* Sidebar */}
      <aside className="w-56 bg-sidebar border-r border-border flex flex-col shrink-0 hidden md:flex sticky top-0 h-screen overflow-y-auto">
        <div className="p-4 flex items-center gap-3">
          <img src={logo} alt="Fluff & Scruff" className="h-10 w-auto brightness-0 invert opacity-90" />
          <div>
            <h1 className="font-heading text-base font-bold text-sidebar-primary-foreground leading-tight">Staff Portal</h1>
            <p className="text-[10px] text-sidebar-foreground/60">Groomer View</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {groomerNavItems.map((item) => (
            <Link
              key={item.url}
              to={item.url}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${isActive(item.url) ? "bg-sidebar-accent text-sidebar-primary-foreground font-medium" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"}`}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          ))}
          {hasCustomerBookings && (
            <Link
              to="/my-pets"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${location.pathname === "/my-pets" ? "bg-sidebar-accent text-sidebar-primary-foreground font-medium" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"}`}
            >
              <PawPrint className="h-4 w-4" />
              My Dog's Bookings 🐾
            </Link>
          )}
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
