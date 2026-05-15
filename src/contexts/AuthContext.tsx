import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "proprietario" | "master";

interface Profile {
  id: string;
  email: string | null;
  nome: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  roles: AppRole[];
  hasRole: (r: AppRole) => boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  role: null,
  roles: [],
  hasRole: () => false,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
};

const primaryRole = (roles: AppRole[]): AppRole | null => {
  if (roles.includes("master")) return "master";
  if (roles.includes("admin")) return "admin";
  if (roles.includes("proprietario")) return "proprietario";
  return null;
};

const log = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log("[Auth]", ...args);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = user?.id ?? null;

  // Carrega perfil + roles quando o id do usuário muda.
  // Evita cache manual aqui: em StrictMode o primeiro efeito pode ser cancelado,
  // e pular a segunda execução deixava rotas privadas presas em "Carregando...".
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setRoles([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        log("Buscando profile + roles para", userId);
        const [profileRes, rolesRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", userId),
        ]);

        if (cancelled) return;

        if (profileRes.error) console.error("[Auth] Erro ao carregar profile:", profileRes.error);
        if (rolesRes.error) console.error("[Auth] Erro ao carregar roles:", rolesRes.error);

        setProfile(profileRes.data ?? null);
        setRoles((rolesRes.data ?? []).map((r) => r.role as AppRole));
        log("Profile/roles carregados");
      } catch (err) {
        if (!cancelled) console.error("[Auth] Falha inesperada ao carregar dados do usuário:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    // 1) Subscribe ANTES de getSession para não perder eventos.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      log("onAuthStateChange:", event, currentSession?.user?.email ?? "(no user)");
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (!currentSession?.user) {
        setProfile(null);
        setRoles([]);
        setLoading(false);
      }
    });

    // 2) Hidrata sessão existente.
    supabase.auth.getSession().then(({ data: { session: existing }, error }) => {
      if (error) console.error("[Auth] getSession error:", error);
      log("getSession:", existing?.user?.email ?? "(no session)");
      setSession(existing);
      setUser(existing?.user ?? null);
      if (!existing) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    log("signOut");
    const { error } = await supabase.auth.signOut();
    if (error) console.error("[Auth] signOut error:", error);
  };

  const role = primaryRole(roles);
  const hasRole = (r: AppRole) => roles.includes(r);

  return (
    <AuthContext.Provider value={{ session, user, profile, role, roles, hasRole, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
