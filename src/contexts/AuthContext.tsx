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
  role: AppRole | null;       // role primário (para compatibilidade)
  roles: AppRole[];            // todos os roles do usuário
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

// Prioridade de role primário: master > admin > proprietario
const primaryRole = (roles: AppRole[]): AppRole | null => {
  if (roles.includes("master")) return "master";
  if (roles.includes("admin")) return "admin";
  if (roles.includes("proprietario")) return "proprietario";
  return null;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const fetch = async () => {
      const [{ data: profileData }, { data: rolesData }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);

      if (cancelled) return;
      if (profileData) setProfile(profileData);
      if (rolesData) setRoles(rolesData.map((r) => r.role as AppRole));
      setLoading(false);
    };

    fetch();

    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (!currentSession?.user) {
          setProfile(null);
          setRoles([]);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      if (!existing) {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const role = primaryRole(roles);
  const hasRole = (r: AppRole) => roles.includes(r);

  return (
    <AuthContext.Provider value={{ session, user, profile, role, roles, hasRole, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
