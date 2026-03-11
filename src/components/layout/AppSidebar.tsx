import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarDays,
  Home,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.png";

const adminItems = [
  { title: "Visão Geral", url: "/admin", icon: LayoutDashboard },
  { title: "Proprietários", url: "/admin/proprietarios", icon: Users },
  { title: "Imóveis", url: "/admin/imoveis", icon: Building2 },
  { title: "Reservas", url: "/admin/reservas", icon: CalendarDays },
];

const proprietarioItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Meus Imóveis", url: "/dashboard/imoveis", icon: Home },
];

const AppSidebar: React.FC = () => {
  const { role, profile, signOut } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();

  const items = role === "admin" ? adminItems : proprietarioItems;

  const isActive = (url: string) => {
    if (url === "/admin" || url === "/dashboard") {
      return location.pathname === url;
    }
    return location.pathname.startsWith(url);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-3 overflow-hidden">
          <img
            src={logo}
            alt="Couple Wilhelm"
            className="h-8 w-8 object-contain flex-shrink-0"
          />
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-display text-sm tracking-widest text-primary uppercase">
                Couple
              </span>
              <span className="font-display text-sm tracking-widest text-primary uppercase">
                Wilhelm
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={collapsed ? item.title : undefined}
                    >
                      <button
                        onClick={() => navigate(item.url)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200 ${
                          active
                            ? "bg-primary/15 text-primary font-medium"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`}
                      >
                        <item.icon
                          className={`h-4 w-4 flex-shrink-0 ${active ? "text-primary" : ""}`}
                        />
                        {!collapsed && <span>{item.title}</span>}
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-4 border-t border-sidebar-border">
        {!collapsed && (
          <div className="mb-3">
            <p className="text-xs text-muted-foreground truncate">
              {profile?.nome || profile?.email}
            </p>
            <p className="text-xs text-primary capitalize">
              {role === "admin" ? "Administrador" : "Proprietário"}
            </p>
          </div>
        )}
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
