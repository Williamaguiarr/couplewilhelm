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
import logoPreta from "@/assets/logo.png";
import logoBranca from "@/assets/logo_branca.png";
import logoVerdeClara from "@/assets/logo_verde_clara.png";

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

  const customLogo = theme.logoUrl;
  const companyName = theme.nomeEmpresa || "Couple Wilhelm";

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
        <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.15em] text-sidebar-foreground/40 px-3 mb-1 font-medium">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = isActive(item.url);
            const Icon = item.icon;
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={collapsed ? item.title : undefined}
                >
                  <button
                    onClick={() => navigate(item.url)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                      active
                        ? "bg-sidebar-primary/12 text-sidebar-primary font-medium shadow-[inset_2px_0_0_hsl(var(--sidebar-primary))]"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 flex-shrink-0 transition-colors duration-200 ${active ? "text-sidebar-primary" : ""}`}
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
      <SidebarHeader className="p-0">
        {collapsed ? (
          <div className="flex justify-center py-4 px-2">
            {customLogo ? (
              <img
                src={customLogo}
                alt={companyName}
                className="h-9 w-9 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).src = logoVerdeClara; }}
              />
            ) : (
              <img
                src={logoVerdeClara}
                alt="Couple Wilhelm"
                className="h-9 w-9 object-contain"
              />
            )}
          </div>
        ) : (
          <div className="w-full">
            {customLogo ? (
              <div className="w-full px-3 py-4">
                <img
                  src={customLogo}
                  alt={companyName}
                  className="w-full h-auto max-h-20 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).src = logoVerdeClara; }}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center py-5 px-4">
                <img
                  src={logoVerdeClara}
                  alt="Couple Wilhelm"
                  className="h-14 w-auto max-w-full object-contain"
                />
              </div>
            )}
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        {isMasterAdmin ? (
          <>
            {renderItems(masterItems, "Plataforma")}
            <div className="mx-3 border-t border-sidebar-border/60 my-2" />
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

      <SidebarFooter className="px-4 py-4 border-t border-sidebar-border/60">
        {!collapsed && (
          <div className="mb-3 px-1">
            <p className="text-xs text-sidebar-foreground/70 truncate font-medium">
              {profile?.nome || profile?.email}
            </p>
            <p className="text-[10px] text-sidebar-primary/80 capitalize tracking-wide mt-0.5">{roleLabel}</p>
          </div>
        )}
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
