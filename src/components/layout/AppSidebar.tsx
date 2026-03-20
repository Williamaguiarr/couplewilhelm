import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarDays,
  Home,
  LogOut,
  Settings,
  ShieldCheck,
  ChevronRight,
  CalendarRange,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import logo from "@/assets/logo.png";

const masterItems = [
  { title: "Visão Geral", url: "/master", icon: LayoutDashboard },
  { title: "Administradores", url: "/master/admins", icon: ShieldCheck },
];

const adminItems = [
  { title: "Visão Geral", url: "/admin", icon: LayoutDashboard },
  { title: "Proprietários", url: "/admin/proprietarios", icon: Users },
  { title: "Imóveis", url: "/admin/imoveis", icon: Building2 },
  { title: "Reservas", url: "/admin/reservas", icon: CalendarDays },
  { title: "Calendário", url: "/admin/calendario", icon: CalendarRange },
  { title: "Configurações", url: "/admin/configuracoes", icon: Settings },
];

const proprietarioItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Meus Imóveis", url: "/dashboard/imoveis", icon: Home },
];

const AppSidebar: React.FC = () => {
  const { role, hasRole, profile, signOut } = useAuth();
  const { theme } = useTheme();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (url: string) => {
    const rootUrls = ["/admin", "/dashboard", "/master"];
    if (rootUrls.includes(url)) return location.pathname === url;
    return location.pathname.startsWith(url);
  };

  const logoSrc = theme.logoUrl || logo;
  const companyName = theme.nomeEmpresa || "Couple Wilhelm";
  const nameParts = companyName.split(" ");
  const nameLine1 = nameParts.slice(0, Math.ceil(nameParts.length / 2)).join(" ");
  const nameLine2 = nameParts.slice(Math.ceil(nameParts.length / 2)).join(" ");

  // Usuário com master + admin: exibe ambas as seções
  const isMasterAdmin = hasRole("master") && hasRole("admin");

  const roleLabel = isMasterAdmin
    ? "Master / Admin"
    : role === "master"
    ? "Master"
    : role === "admin"
    ? "Administrador"
    : "Proprietário";

  const renderItems = (items: typeof adminItems, label?: string) => (
    <SidebarGroup>
      {label && !collapsed && (
        <SidebarGroupLabel className="text-xs uppercase tracking-widest text-muted-foreground/60 px-3 mb-1">
          {label}
        </SidebarGroupLabel>
      )}
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
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-3 overflow-hidden">
          <img
            src={logoSrc}
            alt={companyName}
            className="h-10 w-10 object-contain flex-shrink-0 rounded-md"
            onError={(e) => {
              (e.target as HTMLImageElement).src = logo;
            }}
          />
          {!collapsed && (
            <div className="flex flex-col leading-tight overflow-hidden">
              <span className="font-display text-sm tracking-widest text-primary uppercase truncate">
                {nameLine1}
              </span>
              {nameLine2 && (
                <span className="font-display text-sm tracking-widest text-primary uppercase truncate">
                  {nameLine2}
                </span>
              )}
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {isMasterAdmin ? (
          <>
            {renderItems(masterItems, "Plataforma")}
            <div className="mx-4 border-t border-sidebar-border my-1" />
            {renderItems(adminItems, "Minha Gestão")}
          </>
        ) : role === "master" ? (
          renderItems(masterItems)
        ) : role === "admin" ? (
          renderItems(adminItems)
        ) : (
          renderItems(proprietarioItems)
        )}
      </SidebarContent>

      <SidebarFooter className="px-4 py-4 border-t border-sidebar-border">
        {!collapsed && (
          <div className="mb-3">
            <p className="text-xs text-muted-foreground truncate">
              {profile?.nome || profile?.email}
            </p>
            <p className="text-xs text-primary capitalize">{roleLabel}</p>
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
