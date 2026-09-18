import { CalendarDays, MessageSquare, Dog, PoundSterling, FileText, LogOut, PawPrint, Package, ShoppingCart, Sparkles, Inbox, PhoneForwarded, GraduationCap, Ban, Menu, Home } from "lucide-react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import logo from "@/assets/logo-transparent.png";
import { useAuth } from "@/hooks/useAuth";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { useStaffIsCustomer } from "@/hooks/useStaffIsCustomer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUnassignedInboxCount } from "@/hooks/useUnassignedInboxCount";
import { InboxBellButton } from "@/components/ai-inbox/InboxBellButton";
import { SystemStatusBanner } from "@/components/SystemStatusBanner";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface GroomerLayoutProps {
  children: React.ReactNode;
}

const groomerNavGroups = [
  { label: "My work", items: [
    { title: "My Day", url: "/portal", icon: Home },
    { title: "Assistant", url: "/portal/assistant", icon: Sparkles },
    { title: "My Bookings", url: "/portal/bookings", icon: CalendarDays },
    { title: "Customer Messages", url: "/portal/messages", icon: MessageSquare, badge: "sms" as const },
    { title: "Email Inbox", url: "/portal/inbox", icon: Inbox },
    { title: "Needs Me", url: "/ai-inbox", icon: PhoneForwarded, badge: "ai" as const },
  ]},
  { label: "My results", items: [
    { title: "My Earnings", url: "/portal/finance", icon: PoundSterling },
    { title: "Blocked Customers", url: "/blacklist", icon: Ban },
  ]},
  { label: "Tools", items: [
    { title: "Packages", url: "/admin/packages", icon: Package },
    { title: "Requests", url: "/portal/purchases", icon: ShoppingCart },
    { title: "Breeds", url: "/portal/breeds", icon: Dog },
    { title: "Documents", url: "/portal/documents", icon: FileText },
    { title: "Placements", url: "/placements", icon: GraduationCap },
  ]},
];

export function GroomerLayout({ children }: GroomerLayoutProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { hasCustomerBookings } = useStaffIsCustomer(user?.email ?? undefined);
  const aiInboxUnread = useUnassignedInboxCount();

  // Auto sign-out after 5 hours of inactivity (mouse/keyboard/touch/scroll).
  useIdleLogout(5 * 60 * 60 * 1000, () => navigate("/"));

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const isActive = (url: string) => {
    if (url === "/portal") return location.pathname === "/portal";
    return location.pathname === url || location.pathname.startsWith(url + "/");
  };

  const navigation = (
    <>
      <div className="px-4 py-5 flex items-center gap-3 border-b border-sidebar-border">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15">
          <img src={logo} alt="" className="h-8 w-auto brightness-0 invert opacity-95" />
        </div>
        <div>
          <p className="font-heading text-base text-sidebar-primary-foreground leading-tight">Fluff & Scruff</p>
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-primary">Staff portal</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groomerNavGroups.map((group, groupIndex) => (
          <div key={group.label} className={groupIndex > 0 ? "mt-5 border-t border-sidebar-border pt-4" : ""}>
            <p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/40">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(item.url);
                return <Link key={item.url} to={item.url} className={`relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${active ? "bg-primary/15 text-sidebar-primary-foreground font-bold before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-full before:bg-primary" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-primary-foreground"}`}>
                  <item.icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                  <span className="flex-1">{item.title}</span>
                  {item.count && aiInboxUnread > 0 && <Badge variant="destructive" className="h-5 min-w-5 rounded-full px-1.5 text-[10px] font-bold">{aiInboxUnread > 99 ? "99+" : aiInboxUnread}</Badge>}
                </Link>;
              })}
            </div>
          </div>
        ))}
        {hasCustomerBookings && <div className="mt-5 border-t border-sidebar-border pt-4"><Link to="/my-pets" className={`flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm ${location.pathname === "/my-pets" ? "bg-primary/15 font-bold text-sidebar-primary-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent"}`}><PawPrint className="h-4 w-4"/> My dog's bookings</Link></div>}
      </nav>
      <div className="border-t border-sidebar-border p-3"><Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-primary-foreground" onClick={handleSignOut}><LogOut className="mr-2 h-4 w-4"/>Sign out</Button></div>
    </>
  );

  return (
    <div className="min-h-screen flex w-full">
      <aside className="hidden h-screen w-60 shrink-0 flex-col bg-sidebar md:sticky md:top-0 md:flex">{navigation}</aside>

      {/* Mobile header */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-sidebar-border bg-sidebar px-3 py-2 md:hidden">
        <div className="flex items-center gap-2">
          <Sheet><SheetTrigger asChild><Button variant="ghost" size="icon" className="text-sidebar-primary-foreground hover:bg-sidebar-accent" aria-label="Open navigation"><Menu /></Button></SheetTrigger><SheetContent side="left" className="flex w-[290px] flex-col border-sidebar-border bg-sidebar p-0"><SheetTitle className="sr-only">Staff navigation</SheetTitle>{navigation}</SheetContent></Sheet>
          <img src={logo} alt="Fluff & Scruff" className="h-7 w-auto brightness-0 invert opacity-90" />
          <span className="font-heading text-sm text-sidebar-primary-foreground">My Day</span>
        </div>
        <div className="flex items-center gap-1">
          <InboxBellButton />
          <Button variant="ghost" size="sm" className="text-sidebar-foreground/70 h-8" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 md:mt-0 mt-12">
        <SystemStatusBanner />
        <main className="p-4 md:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
