import { supabase } from "@/integrations/supabase/client";

/**
 * Get current session access token for edge function calls.
 */
export async function getAuthToken(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

/**
 * Fetch proprietário IDs linked to an admin via admin_proprietarios.
 */
export async function fetchLinkedProprietarioIds(adminId: string): Promise<string[]> {
  const { data: vinculos } = await supabase
    .from("admin_proprietarios" as any)
    .select("proprietario_id")
    .eq("admin_id", adminId);

  return (vinculos as any[] || []).map((v) => v.proprietario_id);
}

/**
 * Fetch profiles by an array of IDs.
 */
export async function fetchProfilesByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .in("id", ids);
  return data || [];
}

/**
 * Currency formatter (BRL).
 */
export const formatBRL = (v: number | null) =>
  v != null
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
    : "—";

/**
 * Safe number parser — returns null for invalid/empty values.
 */
export const toNum = (v: string | number | null): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return n == null || isNaN(n) ? null : n;
};
