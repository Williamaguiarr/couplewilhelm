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
          <header className="h-11 flex items-center justify-between px-3 sm:px-5 glass sticky top-0 z-10">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors duration-200" />
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-medium text-foreground leading-tight truncate max-w-[200px]">
                  {profile?.nome || profile?.email}
                </p>
                <p className="text-[10px] text-primary/70 leading-tight font-medium tracking-wide">
                  {roleLabel}
                </p>
              </div>
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 flex items-center justify-center transition-all duration-300 hover:border-primary/40 hover:shadow-glow">
                <span className="text-primary text-xs font-semibold">
                  {(profile?.nome || profile?.email || "U")[0].toUpperCase()}
                </span>
              </div>
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-5 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
