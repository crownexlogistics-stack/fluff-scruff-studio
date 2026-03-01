import {
  Dog, Users, Calendar, LayoutDashboard, Crown,
  UserPlus, CalendarClock, ChevronDown, Megaphone,
  UsersRound, BarChart3, Tags, Search, Facebook, Mail,
  LogOut, Sparkles, AlertTriangle, ShieldCheck,
} from "lucide-react";
import logo from "@/assets/logo-transparent.png";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
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
  { title: "Add-Ons", url: "/add-ons", icon: Sparkles },
];

const directorNavItems = [
  { title: "Breeds", url: "/breeds", icon: Dog },
];

const hrSubItems = [
  { title: "Manage Staff", url: "/staff", icon: UserPlus },
  { title: "Work Schedule", url: "/staff/schedule", icon: CalendarClock },
  { title: "Incident Reports", url: "/staff/incidents", icon: AlertTriangle },
  { title: "Risk Assessments", url: "/staff/risk-assessments", icon: ShieldCheck },
];

const marketingSubItems = [
  { title: "Customers", url: "/marketing/customers", icon: UsersRound },
  { title: "Booking Analytics", url: "/marketing/analytics", icon: BarChart3 },
  { title: "Discounts", url: "/marketing/discounts", icon: Tags },
  { title: "SEO", url: "/marketing/seo", icon: Search },
  { title: "Social Campaigns", url: "/marketing/social", icon: Facebook },
  { title: "Email Marketing", url: "/marketing/email", icon: Mail },
];

const directorOnlyItems = [
  { title: "Users", url: "/admin/users", icon: Crown },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const { role } = useUserRole(user?.id);

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
                      {!collapsed && <span>{item.title}</span>}
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
                        {!collapsed && <span>{item.title}</span>}
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
