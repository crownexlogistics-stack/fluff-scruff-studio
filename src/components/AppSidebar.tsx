import {
  Brain, GraduationCap,
  Dog, Users, Calendar, LayoutDashboard, Crown,
  UserPlus, CalendarClock, ChevronDown, Megaphone,
  UsersRound, BarChart3, Mail,
  LogOut, Sparkles, AlertTriangle, ShieldCheck, BookOpen,
  Inbox, FileText, Ticket, PoundSterling, Bug, Activity, ArrowRightLeft,
  PawPrint, Bot, MessageSquare, PhoneForwarded, Settings, Search, Phone,
  BookOpen as HistoryBook, ShoppingCart, Package, HeartPulse,
} from "lucide-react";
import logo from "@/assets/logo-transparent.png";
import { useNewErrorReportsCount } from "@/hooks/useNewErrorReportsCount";
import { useNewAcademyEnquiriesCount } from "@/hooks/useNewAcademyEnquiriesCount";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadSmsCount } from "@/hooks/useUnreadSmsCount";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/hooks/useUserRole";
import { useStaffIsCustomer } from "@/hooks/useStaffIsCustomer";
import { useUrgentPurchaseRequests } from "@/hooks/useUrgentPurchaseRequests";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const mainNavItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Bookings", url: "/bookings", icon: Calendar },
  { title: "Package Deals", url: "/admin/packages", icon: Package },
  { title: "Package Health", url: "/admin/packages/health", icon: HeartPulse },
  { title: "Finance", url: "/finance", icon: PoundSterling },
  { title: "Messages", url: "/messages", icon: Inbox },
  { title: "Shared Inbox", url: "/admin/inbox", icon: Mail },
  { title: "Add-Ons", url: "/add-ons", icon: Sparkles },
];

const directorNavItems = [
  { title: "Breeds", url: "/breeds", icon: Dog },
];

const hrSubItems = [
  { title: "Manage Staff", url: "/staff", icon: UserPlus },
  { title: "Purchase Orders", url: "/purchase-orders", icon: ShoppingCart },
  { title: "Booking Priority", url: "/staff/priority", icon: Crown },
  { title: "Work Schedule", url: "/staff/schedule", icon: CalendarClock },
  { title: "Incident Reports", url: "/staff/incidents", icon: AlertTriangle },
  { title: "Risk Assessments", url: "/staff/risk-assessments", icon: ShieldCheck },
  { title: "Room Rules", url: "/staff/rules", icon: BookOpen },
];

const marketingSubItems = [
  { title: "Customers", url: "/marketing/customers", icon: UsersRound },
  { title: "Booking Analytics", url: "/marketing/analytics", icon: BarChart3 },
  { title: "Coupons", url: "/admin/coupons", icon: Ticket },
  { title: "Email Marketing", url: "/marketing/email", icon: Mail },
  { title: "SMS Marketing", url: "/marketing/sms", icon: MessageSquare },
];

const scruffSubItems = [
  { title: "Conversations", url: "/admin/scruff/conversations", icon: MessageSquare },
  { title: "Handoffs", url: "/admin/scruff/handoffs", icon: PhoneForwarded },
  { title: "Settings", url: "/admin/scruff/settings", icon: Settings },
];

const aiReceptionistSubItems = [
  { title: "Control Panel", url: "/admin/ai-receptionist", icon: Phone },
];

const directorOnlyItems = [
  { title: "Users", url: "/admin/users", icon: Crown },
  { title: "Terms & Conditions", url: "/admin/terms", icon: FileText },
  { title: "Activity Log", url: "/admin/activity-log", icon: Activity },
  { title: "Duplicate Report", url: "/admin/duplicate-report", icon: Search },
  { title: "Error Reports", url: "/admin/error-reports", icon: Bug },
  { title: "System Health", url: "/admin/health", icon: Activity },
  { title: "Tests", url: "/admin/tests", icon: Activity },
  { title: "Wix Migration", url: "/admin/migration", icon: ArrowRightLeft },
  { title: "Historical Data", url: "/admin/historical", icon: HistoryBook },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const { role } = useUserRole(user?.id);
  const { totalUnread } = useUnreadSmsCount();
  const newErrorCount = useNewErrorReportsCount();
  const newAcademyCount = useNewAcademyEnquiriesCount();
  const { hasCustomerBookings } = useStaffIsCustomer(user?.email ?? undefined);
  const urgentPurchaseCount = useUrgentPurchaseRequests();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Fluff & Scruff" className="h-10 w-auto brightness-0 invert opacity-90" />
          {!collapsed && (
            <div>
              <h1 className="font-heading text-lg font-bold text-sidebar-primary-foreground leading-tight">
                Fluff & Scruff
              </h1>
              <p className="text-xs text-sidebar-foreground/60">Studio</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Main navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/admin"}
                      className="hover:bg-sidebar-accent/50 transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span className="flex-1">{item.title}</span>}
                      {item.url === "/messages" && totalUnread > 0 && (
                        <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full">
                          {totalUnread > 99 ? "99+" : totalUnread}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {role === "director" && directorNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="hover:bg-sidebar-accent/50 transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* HR Section */}
        <SidebarGroup>
          <Collapsible defaultOpen className="group/hr">
            <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider p-0">
              <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1.5 hover:bg-sidebar-accent/30 rounded-md transition-colors">
                <span className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" />
                  {!collapsed && "HR"}
                </span>
                {!collapsed && (
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]/hr:rotate-180" />
                )}
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {hrSubItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          className="hover:bg-sidebar-accent/50 transition-colors pl-6"
                          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          {!collapsed && <span className="flex-1">{item.title}</span>}
                          {item.url === "/purchase-orders" && urgentPurchaseCount > 0 && (
                            <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full">
                              {urgentPurchaseCount}
                            </Badge>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* Marketing Section */}
        <SidebarGroup>
          <Collapsible defaultOpen className="group/mkt">
            <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider p-0">
              <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1.5 hover:bg-sidebar-accent/30 rounded-md transition-colors">
                <span className="flex items-center gap-2">
                  <Megaphone className="h-3.5 w-3.5" />
                  {!collapsed && "Marketing"}
                </span>
                {!collapsed && (
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]/mkt:rotate-180" />
                )}
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {marketingSubItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          className="hover:bg-sidebar-accent/50 transition-colors pl-6"
                          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* Scruff AI Section */}
        <SidebarGroup>
          <Collapsible defaultOpen className="group/scruff">
            <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider p-0">
              <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1.5 hover:bg-sidebar-accent/30 rounded-md transition-colors">
                <span className="flex items-center gap-2">
                  <Bot className="h-3.5 w-3.5" />
                  {!collapsed && "🤖 Scruff AI"}
                </span>
                {!collapsed && (
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]/scruff:rotate-180" />
                )}
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {scruffSubItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          className="hover:bg-sidebar-accent/50 transition-colors pl-6"
                          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                        >
                          <item.icon className="mr-2 h-4 w-4" />
                          {!collapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* AI Receptionist — director only */}
        {role === "director" && (
          <SidebarGroup>
            <Collapsible defaultOpen className="group/airx">
              <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider p-0">
                <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1.5 hover:bg-sidebar-accent/30 rounded-md transition-colors">
                  <span className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" />
                    {!collapsed && "AI Receptionist"}
                  </span>
                  {!collapsed && (
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]/airx:rotate-180" />
                  )}
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {aiReceptionistSubItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            className="hover:bg-sidebar-accent/50 transition-colors pl-6"
                            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                          >
                            <item.icon className="mr-2 h-4 w-4" />
                            {!collapsed && <span>{item.title}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Academy Section — director/manager only */}
        {(role === "director" || role === "manager") && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
              Academy
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin/academy"
                      className="hover:bg-sidebar-accent/50 transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <GraduationCap className="mr-2 h-4 w-4" />
                      {!collapsed && <span className="flex-1">Enquiries</span>}
                      {newAcademyCount > 0 && (
                        <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full">
                          {newAcademyCount > 99 ? "99+" : newAcademyCount}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {/* Director Section */}
        {role === "director" && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
              Director
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin/director-assistant"
                      className="hover:bg-sidebar-accent/50 transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <Brain className="mr-2 h-4 w-4" />
                      {!collapsed && <span>Director Assistant</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {role === "director" && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {directorOnlyItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                    <NavLink
                        to={item.url}
                        className="hover:bg-sidebar-accent/50 transition-colors"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span className="flex-1">{item.title}</span>}
                        {item.url === "/admin/error-reports" && newErrorCount > 0 && (
                          <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-[10px] font-bold rounded-full">
                            {newErrorCount > 99 ? "99+" : newErrorCount}
                          </Badge>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <SidebarMenu>
          {hasCustomerBookings && role !== "director" && role !== "manager" && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink
                  to="/my-pets"
                  className="hover:bg-sidebar-accent/50 transition-colors text-sidebar-foreground/70 hover:text-sidebar-foreground"
                  activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                >
                  <PawPrint className="mr-2 h-4 w-4" />
                  {!collapsed && <span>My Dog's Bookings 🐾</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={async () => { await signOut(); window.location.href = "/"; }}
              className="hover:bg-sidebar-accent/50 transition-colors text-sidebar-foreground/70 hover:text-sidebar-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {!collapsed && <span>Sign Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
