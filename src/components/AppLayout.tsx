import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { InboxBellButton } from "@/components/ai-inbox/InboxBellButton";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="glass sticky top-0 z-40 h-14 flex items-center border-b border-border/50 px-4">
            <SidebarTrigger className="mr-4 h-12 w-12 rounded-2xl" />
            <div className="ml-auto">
              <InboxBellButton />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
