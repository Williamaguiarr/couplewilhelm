import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AdminTheme {
  corPrimaria: string;
  corSecundaria: string;
  corTexto: string;
  logoUrl: string | null;
  nomeEmpresa: string | null;
  slug: string | null;
}

const DEFAULT_THEME: AdminTheme = {
  corPrimaria: "#0A192F",
  corSecundaria: "#A38B5E",
  corTexto: "#FFFFFF",
  logoUrl: null,
  nomeEmpresa: "Couple Wilhelm",
  slug: null,
};

interface ThemeContextType {
  theme: AdminTheme;
  reloadTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: DEFAULT_THEME,
  reloadTheme: async () => {},
});

export const useTheme = () => useContext(ThemeContext);

// Converte hex para hsl string "H S% L%"
function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Darkens HSL lightness by a given amount (clamped to 0)
function darkenHsl(hsl: string, amount: number): string {
  const parts = hsl.split(" ");
  const h = parts[0];
  const s = parts[1];
  const l = parseFloat(parts[2]) - amount;
  return `${h} ${s} ${Math.max(0, l)}%`;
}

function applyTheme(theme: AdminTheme) {
  const root = document.documentElement;
  try {
    const primaryHsl = hexToHsl(theme.corPrimaria);
    const secondaryHsl = hexToHsl(theme.corSecundaria);
    const textHsl = hexToHsl(theme.corTexto);
    // Core theme tokens
    root.style.setProperty("--primary", primaryHsl);
    root.style.setProperty("--primary-foreground", textHsl);
    root.style.setProperty("--ring", primaryHsl);
    root.style.setProperty("--secondary-accent", secondaryHsl);
    // Sidebar uses a darkened version of the primary color
    const sidebarBg = darkenHsl(primaryHsl, 4);
    root.style.setProperty("--sidebar-background", sidebarBg);
    root.style.setProperty("--sidebar-primary", secondaryHsl);
    root.style.setProperty("--sidebar-accent", darkenHsl(primaryHsl, 0) + " / 0.5");
    root.style.setProperty("--sidebar-ring", secondaryHsl);
    root.style.setProperty("--sidebar-foreground", textHsl);
  } catch {
    // fallback silencioso
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role } = useAuth();
  const [theme, setTheme] = useState<AdminTheme>(DEFAULT_THEME);

  const loadTheme = async () => {
    if (!user) {
      applyTheme(DEFAULT_THEME);
      setTheme(DEFAULT_THEME);
      return;
    }

    // Admin (ou master+admin): carrega sua própria config
    if (role === "admin" || role === "master") {
      const { data } = await supabase
        .from("admin_configs" as any)
        .select("cor_primaria, cor_secundaria, cor_texto, logo_url, nome_empresa, slug")
        .eq("admin_id", user.id)
        .maybeSingle();

      if (data) {
        const t: AdminTheme = {
          corPrimaria: (data as any).cor_primaria || DEFAULT_THEME.corPrimaria,
          corSecundaria: (data as any).cor_secundaria || DEFAULT_THEME.corSecundaria,
          corTexto: (data as any).cor_texto || DEFAULT_THEME.corTexto,
          logoUrl: (data as any).logo_url,
          nomeEmpresa: (data as any).nome_empresa,
          slug: (data as any).slug,
        };
        setTheme(t);
        applyTheme(t);
        return;
      }
    }

    // Proprietário: carrega a config do admin dos seus imóveis
    if (role === "proprietario") {
      const { data: imoveis } = await supabase
        .from("imoveis")
        .select("admin_id")
        .or(`proprietario_id.eq.${user.id},proprietario_id_2.eq.${user.id}`)
        .limit(1);

      const adminId = (imoveis?.[0] as any)?.admin_id;
      if (adminId) {
        const { data } = await supabase
          .from("admin_configs" as any)
          .select("cor_primaria, cor_secundaria, cor_texto, logo_url, nome_empresa, slug")
          .eq("admin_id", adminId)
          .maybeSingle();

        if (data) {
          const t: AdminTheme = {
            corPrimaria: (data as any).cor_primaria || DEFAULT_THEME.corPrimaria,
            corSecundaria: (data as any).cor_secundaria || DEFAULT_THEME.corSecundaria,
            corTexto: (data as any).cor_texto || DEFAULT_THEME.corTexto,
            logoUrl: (data as any).logo_url,
            nomeEmpresa: (data as any).nome_empresa,
            slug: (data as any).slug,
          };
          setTheme(t);
          applyTheme(t);
          return;
        }
      }
    }

    // Master ou sem config: tema padrão
    applyTheme(DEFAULT_THEME);
    setTheme(DEFAULT_THEME);
  };

  useEffect(() => {
    loadTheme();
  }, [user, role]);

  return (
    <ThemeContext.Provider value={{ theme, reloadTheme: loadTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
