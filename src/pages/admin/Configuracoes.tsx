import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Upload, Palette, Save, Building2, Percent, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PageTransition from "@/components/layout/PageTransition";

interface AdminConfig {
  id: string;
  admin_id: string;
  slug: string;
  nome_empresa: string | null;
  cor_primaria: string;
  cor_secundaria: string;
  cor_texto: string;
  logo_url: string | null;
  ativo: boolean;
  comissao_cw: number;
}

// Paleta baseada na roda de cores - 24 cores organizadas por matiz
const COLOR_WHEEL_PRIMARY = [
  // Neutros escuros
  { label: "Preto", value: "#0D0D0D", group: "Neutros" },
  { label: "Grafite", value: "#2D2D2D", group: "Neutros" },
  { label: "Cinza Chumbo", value: "#3A3A3A", group: "Neutros" },
  { label: "Cinza Quente", value: "#3A3530", group: "Neutros" },
  // Azuis
  { label: "Marinho", value: "#0A192F", group: "Azuis" },
  { label: "Cinza Azul", value: "#1E2A38", group: "Azuis" },
  { label: "Royal", value: "#1A1F6E", group: "Azuis" },
  { label: "Índigo", value: "#1E1B4B", group: "Azuis" },
  // Verdes
  { label: "Petróleo", value: "#0D3B4A", group: "Verdes" },
  { label: "Teal", value: "#0F3D3D", group: "Verdes" },
  { label: "Verde Floresta", value: "#1A3D2B", group: "Verdes" },
  { label: "Musgo", value: "#2E3D2A", group: "Verdes" },
  // Vermelhos/Roxos
  { label: "Vinho", value: "#5C1A1A", group: "Quentes" },
  { label: "Borgonha", value: "#4A0020", group: "Quentes" },
  { label: "Púrpura", value: "#2D0A4E", group: "Quentes" },
  { label: "Ameixa", value: "#3D1A4A", group: "Quentes" },
  // Marrons
  { label: "Chocolate", value: "#3E1F00", group: "Terrosos" },
  { label: "Cobre Escuro", value: "#5C3010", group: "Terrosos" },
  { label: "Nude", value: "#4A3728", group: "Terrosos" },
  { label: "Mogno", value: "#4A1A00", group: "Terrosos" },
  // Médios
  { label: "Slate", value: "#334155", group: "Médios" },
  { label: "Azul Ardósia", value: "#1E3A5F", group: "Médios" },
  { label: "Verde Esmeralda", value: "#064E3B", group: "Médios" },
  { label: "Roxo Escuro", value: "#312E81", group: "Médios" },
];

const COLOR_WHEEL_ACCENT = [
  // Dourados / Metálicos
  { label: "Dourado", value: "#A38B5E", group: "Metálicos" },
  { label: "Champagne", value: "#C4A265", group: "Metálicos" },
  { label: "Âmbar", value: "#D4A017", group: "Metálicos" },
  { label: "Bronze", value: "#CD7F32", group: "Metálicos" },
  { label: "Prata", value: "#9E9E9E", group: "Metálicos" },
  { label: "Platina", value: "#C0C0C0", group: "Metálicos" },
  // Rosas / Vermelhos
  { label: "Rosé Gold", value: "#C7748A", group: "Quentes" },
  { label: "Salmão", value: "#D4826A", group: "Quentes" },
  { label: "Coral", value: "#C4614A", group: "Quentes" },
  { label: "Terracota", value: "#B55A3A", group: "Quentes" },
  { label: "Vermelho Vivo", value: "#DC2626", group: "Quentes" },
  { label: "Rosa Chá", value: "#E8A8B8", group: "Quentes" },
  // Verdes / Azuis
  { label: "Jade", value: "#3A7D6A", group: "Frios" },
  { label: "Esmeralda", value: "#4A8C64", group: "Frios" },
  { label: "Teal Claro", value: "#2A8C8C", group: "Frios" },
  { label: "Azul Aço", value: "#4A7FA5", group: "Frios" },
  { label: "Céu", value: "#38BDF8", group: "Frios" },
  { label: "Turquesa", value: "#0D9488", group: "Frios" },
  // Roxos
  { label: "Lavanda", value: "#8A6EC9", group: "Roxos" },
  { label: "Lilás", value: "#9F7FBA", group: "Roxos" },
  { label: "Violeta", value: "#7C3AED", group: "Roxos" },
  { label: "Malva", value: "#A855F7", group: "Roxos" },
  // Amarelos
  { label: "Mostarda", value: "#CA8A04", group: "Amarelos" },
  { label: "Ouro", value: "#EAB308", group: "Amarelos" },
];

const TEXT_COLORS = [
  { label: "Branco Puro", value: "#FFFFFF" },
  { label: "Creme", value: "#F5F0E8" },
  { label: "Cinza Claro", value: "#E5E7EB" },
  { label: "Cinza Médio", value: "#9CA3AF" },
  { label: "Preto Suave", value: "#1F2937" },
  { label: "Preto Puro", value: "#000000" },
  { label: "Dourado", value: "#A38B5E" },
  { label: "Champagne", value: "#C4A265" },
];

const COMISSAO_PRESETS = [10, 15, 20, 25, 30];

// ─── ColorSwatch ───────────────────────────────────────────────────────────
const ColorSwatch: React.FC<{
  color: { label: string; value: string };
  selected: boolean;
  onClick: () => void;
  size?: "sm" | "md";
}> = ({ color, selected, onClick, size = "md" }) => (
  <button
    onClick={onClick}
    title={`${color.label} (${color.value})`}
    className={`relative rounded-lg border-2 transition-all duration-150 flex-shrink-0 ${
      size === "sm" ? "h-8 w-8" : "h-10 w-10"
    } ${
      selected
        ? "border-foreground scale-110 shadow-lg ring-2 ring-offset-1 ring-foreground/30"
        : "border-transparent hover:scale-105 hover:border-foreground/30"
    }`}
    style={{ background: color.value }}
  >
    {selected && (
      <span className="absolute inset-0 flex items-center justify-center">
        <Check
          className="h-3 w-3 drop-shadow"
          style={{ color: parseInt(color.value.slice(1), 16) > 0x888888 ? "#000" : "#fff" }}
        />
      </span>
    )}
  </button>
);

// ─── HexInput ──────────────────────────────────────────────────────────────
const HexInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  defaultFallback: string;
}> = ({ value, onChange, defaultFallback }) => (
  <div className="flex items-center gap-2 mt-3">
    <div
      className="h-7 w-7 rounded-md border border-border flex-shrink-0 shadow-inner"
      style={{ background: value }}
    />
    <Input
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v);
      }}
      onBlur={(e) => {
        if (!/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) onChange(defaultFallback);
      }}
      placeholder="#000000"
      className="h-8 w-28 font-mono text-sm bg-background border-border"
      maxLength={7}
    />
    <input
      type="color"
      value={/^#[0-9A-Fa-f]{6}$/.test(value) ? value : defaultFallback}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-8 rounded cursor-pointer border border-border p-0.5 bg-background"
      title="Abrir seletor de cor"
    />
    <span className="text-xs text-muted-foreground">hex / picker</span>
  </div>
);

// ─── ColorSection ──────────────────────────────────────────────────────────
const ColorSection: React.FC<{
  title: string;
  subtitle: string;
  colors: { label: string; value: string; group: string }[];
  selected: string;
  onSelect: (v: string) => void;
  defaultFallback: string;
}> = ({ title, subtitle, colors, selected, onSelect, defaultFallback }) => {
  const groups = Array.from(new Set(colors.map((c) => c.group)));

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground uppercase tracking-widest">{title}</Label>
        <p className="text-xs text-muted-foreground/60 mt-0.5">{subtitle}</p>
      </div>
      <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-4">
        {groups.map((group) => (
          <div key={group}>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">{group}</p>
            <div className="flex flex-wrap gap-2">
              {colors
                .filter((c) => c.group === group)
                .map((c) => (
                  <ColorSwatch
                    key={c.value}
                    color={c}
                    selected={selected === c.value}
                    onClick={() => onSelect(c.value)}
                  />
                ))}
            </div>
          </div>
        ))}
        <HexInput value={selected} onChange={onSelect} defaultFallback={defaultFallback} />
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────
const Configuracoes: React.FC = () => {
  const { user } = useAuth();
  const { reloadTheme } = useTheme();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingComissao, setSavingComissao] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [form, setForm] = useState({
    slug: "",
    nome_empresa: "",
    cor_primaria: "#0A192F",
    cor_secundaria: "#A38B5E",
    cor_texto: "#FFFFFF",
    logo_url: "",
  });

  const [comissaoInput, setComissaoInput] = useState("25");

  useEffect(() => {
    if (!user) return;
    fetchConfig();
  }, [user]);

  const fetchConfig = async () => {
    const { data } = await supabase
      .from("admin_configs" as any)
      .select("*")
      .eq("admin_id", user!.id)
      .maybeSingle();

    if (data) {
      const c = data as unknown as AdminConfig;
      setConfig(c);
      setForm({
        slug: c.slug || "",
        nome_empresa: c.nome_empresa || "",
        cor_primaria: c.cor_primaria || "#0A192F",
        cor_secundaria: c.cor_secundaria || "#A38B5E",
        cor_texto: (c as any).cor_texto || "#FFFFFF",
        logo_url: c.logo_url || "",
      });
      const pct = Math.round((c.comissao_cw ?? 0.25) * 100);
      setComissaoInput(String(pct));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const payload = {
      slug: form.slug,
      nome_empresa: form.nome_empresa || null,
      cor_primaria: form.cor_primaria,
      cor_secundaria: form.cor_secundaria,
      cor_texto: form.cor_texto,
      logo_url: form.logo_url || null,
    };

    if (config) {
      await supabase
        .from("admin_configs" as any)
        .update(payload)
        .eq("admin_id", user.id);
    } else {
      await supabase.from("admin_configs" as any).insert({
        ...payload,
        admin_id: user.id,
        ativo: true,
      });
    }

    await reloadTheme();
    toast({ title: "Configurações salvas!", description: "Tema aplicado com sucesso." });
    fetchConfig();
    setSaving(false);
  };

  const handleSaveComissao = async () => {
    if (!user) return;
    const pct = parseFloat(comissaoInput);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast({ title: "Percentual inválido", description: "Digite um valor entre 0 e 100.", variant: "destructive" });
      return;
    }
    setSavingComissao(true);
    const rate = pct / 100;

    if (config) {
      await supabase
        .from("admin_configs" as any)
        .update({ comissao_cw: rate })
        .eq("admin_id", user.id);
    } else {
      await supabase.from("admin_configs" as any).insert({
        admin_id: user.id,
        slug: form.slug || user.id,
        comissao_cw: rate,
        ativo: true,
      });
    }

    toast({ title: "Comissão atualizada!", description: `Sua comissão foi definida em ${pct}%.` });
    fetchConfig();
    setSavingComissao(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingLogo(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/logo.${ext}`;

    const { error } = await supabase.storage
      .from("admin-logos")
      .upload(path, file, { upsert: true });

    if (error) {
      toast({ title: "Erro ao enviar logo", description: error.message, variant: "destructive" });
      setUploadingLogo(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("admin-logos")
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl + `?t=${Date.now()}`;
    setForm((f) => ({ ...f, logo_url: publicUrl }));
    setUploadingLogo(false);
    toast({ title: "Logo enviada!", description: "Clique em 'Salvar' para aplicar." });
  };

  const comissaoValue = parseFloat(comissaoInput) || 0;
  const exemploBase = 1000;
  const exemploComissao = exemploBase * (comissaoValue / 100);
  const exemploProprietario = exemploBase - exemploComissao;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="space-y-8 max-w-2xl">
        <div>
          <h1 className="font-display text-3xl text-foreground tracking-wide">Configurações</h1>
          <p className="text-muted-foreground mt-1">
            Personalize sua plataforma e regras financeiras
          </p>
        </div>

        <Tabs defaultValue="identidade" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted/40">
            <TabsTrigger value="identidade" className="gap-2">
              <Palette className="h-3.5 w-3.5" />
              Identidade Visual
            </TabsTrigger>
            <TabsTrigger value="comissao" className="gap-2">
              <Percent className="h-3.5 w-3.5" />
              Comissão
            </TabsTrigger>
          </TabsList>

          {/* ── ABA: IDENTIDADE VISUAL ── */}
          <TabsContent value="identidade" className="space-y-6 mt-6">

            {/* Identidade */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base font-medium text-foreground">
                  <Building2 className="h-4 w-4 text-primary" />
                  Identidade da Empresa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-widest">
                      Nome da empresa
                    </Label>
                    <Input
                      value={form.nome_empresa}
                      onChange={(e) => setForm({ ...form, nome_empresa: e.target.value })}
                      placeholder="Minha Imobiliária"
                      className="bg-background border-border"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-widest">
                      Slug da URL
                    </Label>
                    <Input
                      value={form.slug}
                      onChange={(e) =>
                        setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })
                      }
                      placeholder="minha-imobiliaria"
                      className="bg-background border-border font-mono text-sm"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Logo */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base font-medium text-foreground">
                  <Upload className="h-4 w-4 text-primary" />
                  Logo da Empresa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="h-28 w-28 rounded-xl border border-border bg-background flex items-center justify-center overflow-hidden flex-shrink-0">
                    {form.logo_url ? (
                      <img
                        src={form.logo_url}
                        alt="Logo"
                        className="h-full w-full object-contain p-2"
                      />
                    ) : (
                      <Building2 className="h-10 w-10 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      PNG, JPG, WebP ou SVG. Máx. 5MB.
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="gap-2"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingLogo ? "Enviando..." : "Enviar logo"}
                    </Button>
                    {form.logo_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setForm({ ...form, logo_url: "" })}
                        className="text-muted-foreground hover:text-destructive text-xs"
                      >
                        Remover logo
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Paleta de Cores */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base font-medium text-foreground">
                  <Palette className="h-4 w-4 text-primary" />
                  Paleta de Cores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">

                {/* Cor Primária */}
                <ColorSection
                  title="Cor Primária"
                  subtitle="Usada no fundo da sidebar, cabeçalhos e botões principais."
                  colors={COLOR_WHEEL_PRIMARY}
                  selected={form.cor_primaria}
                  onSelect={(v) => setForm({ ...form, cor_primaria: v })}
                  defaultFallback="#0A192F"
                />

                {/* Cor de Destaque */}
                <ColorSection
                  title="Cor de Destaque"
                  subtitle="Usada em acentos, badges, ícones e elementos secundários."
                  colors={COLOR_WHEEL_ACCENT}
                  selected={form.cor_secundaria}
                  onSelect={(v) => setForm({ ...form, cor_secundaria: v })}
                  defaultFallback="#A38B5E"
                />

                {/* Cor do Texto */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-widest">Cor do Texto</Label>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      Cor do texto exibido sobre a cor primária (sidebar, botões).
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {TEXT_COLORS.map((c) => (
                        <ColorSwatch
                          key={c.value}
                          color={{ ...c, group: "" }}
                          selected={form.cor_texto === c.value}
                          onClick={() => setForm({ ...form, cor_texto: c.value })}
                        />
                      ))}
                    </div>
                    <HexInput
                      value={form.cor_texto}
                      onChange={(v) => setForm({ ...form, cor_texto: v })}
                      defaultFallback="#FFFFFF"
                    />
                  </div>
                </div>

                {/* Preview ao vivo */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <div
                    className="px-4 py-3"
                    style={{ background: form.cor_primaria }}
                  >
                    <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: form.cor_secundaria, opacity: 0.8 }}>
                      Preview — Sidebar
                    </p>
                    <div className="flex items-center gap-3">
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center"
                        style={{ background: form.cor_secundaria + "33" }}
                      >
                        <Settings className="h-4 w-4" style={{ color: form.cor_secundaria }} />
                      </div>
                      <span className="text-sm font-medium" style={{ color: form.cor_texto }}>
                        {form.nome_empresa || "Nome da Empresa"}
                      </span>
                    </div>
                    <div className="mt-3 space-y-1">
                      {["Visão Geral", "Imóveis", "Reservas"].map((item, i) => (
                        <div
                          key={item}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs"
                          style={{
                            background: i === 0 ? form.cor_secundaria + "22" : "transparent",
                            color: i === 0 ? form.cor_secundaria : form.cor_texto,
                            opacity: i === 0 ? 1 : 0.7,
                          }}
                        >
                          <div className="h-1.5 w-1.5 rounded-full" style={{ background: i === 0 ? form.cor_secundaria : form.cor_texto }} />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="px-4 py-3 bg-background border-t border-border">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2">Preview — Botão</p>
                    <div className="flex items-center gap-3">
                      <div
                        className="px-4 py-2 rounded-md text-xs font-medium"
                        style={{ background: form.cor_primaria, color: form.cor_texto }}
                      >
                        Botão Primário
                      </div>
                      <div
                        className="px-4 py-2 rounded-md text-xs font-medium border"
                        style={{ borderColor: form.cor_secundaria, color: form.cor_secundaria }}
                      >
                        Destaque
                      </div>
                      <div
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{ background: form.cor_secundaria + "33", color: form.cor_secundaria }}
                      >
                        Badge
                      </div>
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-2 w-full sm:w-auto"
            >
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar configurações"}
            </Button>
          </TabsContent>

          {/* ── ABA: COMISSÃO ── */}
          <TabsContent value="comissao" className="space-y-6 mt-6">
            <Card className="bg-card border-border">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base font-medium text-foreground">
                  <Percent className="h-4 w-4 text-primary" />
                  Comissão da Plataforma
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Defina o percentual que sua empresa cobra sobre o{" "}
                  <span className="text-foreground font-medium">Valor Base Líquido</span>{" "}
                  de cada reserva (Valor Bruto − Taxa de Limpeza − Comissão OTA).
                </p>

                {/* Presets rápidos */}
                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground uppercase tracking-widest">
                    Percentuais comuns
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {COMISSAO_PRESETS.map((pct) => (
                      <button
                        key={pct}
                        onClick={() => setComissaoInput(String(pct))}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                          parseFloat(comissaoInput) === pct
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground hover:border-primary/50"
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input personalizado */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-widest">
                    Percentual personalizado
                  </Label>
                  <div className="flex items-center gap-3">
                    <div className="relative w-32">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={comissaoInput}
                        onChange={(e) => setComissaoInput(e.target.value)}
                        className="bg-background border-border pr-8 text-lg font-medium"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        %
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      sobre o valor base líquido
                    </span>
                  </div>
                </div>

                {/* Simulador */}
                <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">
                    Simulação (base de R$ 1.000,00)
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Valor Base Líquido</span>
                      <span className="text-foreground font-medium">R$ 1.000,00</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Sua comissão ({comissaoValue}%)
                      </span>
                      <span className="text-muted-foreground">
                        − {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(exemploComissao)}
                      </span>
                    </div>
                    <div className="border-t border-border pt-2 flex justify-between text-sm">
                      <span className="text-foreground font-medium">Repasse ao proprietário</span>
                      <span className="text-primary font-semibold text-base">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(exemploProprietario)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Comissão atual */}
                {config && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
                      Comissão atual configurada
                    </p>
                    <p className="text-2xl font-display text-primary font-semibold">
                      {Math.round((config.comissao_cw ?? 0.25) * 100)}%
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              onClick={handleSaveComissao}
              disabled={savingComissao}
              className="gap-2 w-full sm:w-auto"
            >
              <Save className="h-4 w-4" />
              {savingComissao ? "Salvando..." : "Salvar comissão"}
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
};

export default Configuracoes;
