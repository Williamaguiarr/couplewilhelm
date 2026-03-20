import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Upload, Palette, Save, Building2, Percent } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PageTransition from "@/components/layout/PageTransition";

interface AdminConfig {
  id: string;
  admin_id: string;
  slug: string;
  nome_empresa: string | null;
  cor_primaria: string;
  cor_secundaria: string;
  logo_url: string | null;
  ativo: boolean;
  comissao_cw: number;
}

const PRESET_COLORS = [
  { label: "Marinho", value: "#0A192F" },
  { label: "Preto", value: "#111111" },
  { label: "Vinho", value: "#6B1A1A" },
  { label: "Verde", value: "#1A4A2E" },
  { label: "Royal", value: "#1A237E" },
  { label: "Cobre", value: "#7C4A1A" },
  { label: "Cinza", value: "#2D2D2D" },
  { label: "Teal", value: "#1A3A3A" },
];

const PRESET_SECONDARY = [
  { label: "Dourado", value: "#A38B5E" },
  { label: "Prata", value: "#8E8E8E" },
  { label: "Rosa", value: "#C4896A" },
  { label: "Champagne", value: "#C4A265" },
  { label: "Esmeralda", value: "#4A7C59" },
  { label: "Lavanda", value: "#7B5EA7" },
  { label: "Coral", value: "#C4614A" },
  { label: "Azul", value: "#4A6FA5" },
];

const COMISSAO_PRESETS = [10, 15, 20, 25, 30];

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

            {/* Cores */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base font-medium text-foreground">
                  <Palette className="h-4 w-4 text-primary" />
                  Cores da Identidade Visual
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Cor primária */}
                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground uppercase tracking-widest">
                    Cor Primária (fundo, sidebar, botões)
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setForm({ ...form, cor_primaria: c.value })}
                        className={`h-9 w-9 rounded-lg border-2 transition-all ${
                          form.cor_primaria === c.value
                            ? "border-foreground scale-110 shadow-md"
                            : "border-transparent hover:scale-105"
                        }`}
                        style={{ background: c.value }}
                        title={c.label}
                      />
                    ))}
                    <div className="relative">
                      <input
                        type="color"
                        value={form.cor_primaria}
                        onChange={(e) => setForm({ ...form, cor_primaria: e.target.value })}
                        className="h-9 w-9 rounded-lg border-2 border-border cursor-pointer"
                        title="Cor personalizada"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-6 w-6 rounded-md border border-border"
                      style={{ background: form.cor_primaria }}
                    />
                    <span className="text-sm text-muted-foreground font-mono">
                      {form.cor_primaria}
                    </span>
                  </div>
                </div>

                {/* Cor secundária */}
                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground uppercase tracking-widest">
                    Cor de Destaque (acentos, badges)
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_SECONDARY.map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setForm({ ...form, cor_secundaria: c.value })}
                        className={`h-9 w-9 rounded-lg border-2 transition-all ${
                          form.cor_secundaria === c.value
                            ? "border-foreground scale-110 shadow-md"
                            : "border-transparent hover:scale-105"
                        }`}
                        style={{ background: c.value }}
                        title={c.label}
                      />
                    ))}
                    <div className="relative">
                      <input
                        type="color"
                        value={form.cor_secundaria}
                        onChange={(e) => setForm({ ...form, cor_secundaria: e.target.value })}
                        className="h-9 w-9 rounded-lg border-2 border-border cursor-pointer"
                        title="Cor personalizada"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-6 w-6 rounded-md border border-border"
                      style={{ background: form.cor_secundaria }}
                    />
                    <span className="text-sm text-muted-foreground font-mono">
                      {form.cor_secundaria}
                    </span>
                  </div>
                </div>

                {/* Preview */}
                <div className="rounded-lg border border-border p-4 space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">
                    Preview
                  </p>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center"
                      style={{ background: form.cor_primaria }}
                    >
                      <Settings className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div
                        className="h-2.5 w-24 rounded-full"
                        style={{ background: form.cor_primaria }}
                      />
                      <div
                        className="h-2 w-16 rounded-full mt-1.5"
                        style={{ background: form.cor_secundaria, opacity: 0.7 }}
                      />
                    </div>
                    <div
                      className="ml-auto px-3 py-1.5 rounded-md text-xs text-white font-medium"
                      style={{ background: form.cor_primaria }}
                    >
                      Botão
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
