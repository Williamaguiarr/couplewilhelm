import React from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "./AppSidebar";
import { useAuth } from "@/contexts/AuthContext";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { profile, role, hasRole } = useAuth();

  const roleLabel = hasRole("master") && hasRole("admin")
    ? "Master / Admin"
    : role === "master"
    ? "Master"
    : role === "admin"
    ? "Administrador"
    : "Proprietário";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Premium glass header */}
          <header className="h-14 flex items-center justify-between px-4 sm:px-6 glass sticky top-0 z-10">
            <SidebarTrigger className="text-muted-foreground hover:text-primary transition-colors duration-200" />
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-foreground leading-tight truncate max-w-[180px]">
                  {profile?.nome || profile?.email}
                </p>
                <p className="text-[11px] text-primary/80 leading-tight font-medium">
                  {roleLabel}
                </p>
              </div>
              <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center transition-all duration-200 hover:bg-primary/15 hover:border-primary/30">
                <span className="text-primary text-xs font-semibold">
                  {(profile?.nome || profile?.email || "U")[0].toUpperCase()}
                </span>
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
