import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller identity
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check caller role (admin or master)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const roles = (callerRoles ?? []).map((r: any) => r.role);
    const isMaster = roles.includes("master");
    const isAdmin = roles.includes("admin");

    if (!isMaster && !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admins only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, userId, nome, email, password } = body;

    // ── Scope check: admin can only manage their own proprietários ──────
    if (isAdmin && !isMaster) {
      const { data: link } = await adminClient
        .from("admin_proprietarios")
        .select("id")
        .eq("admin_id", caller.id)
        .eq("proprietario_id", userId)
        .maybeSingle();

      if (!link) {
        return new Response(JSON.stringify({ error: "Acesso negado: usuário fora do seu escopo." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "update") {
      const authPayload: Record<string, unknown> = {};
      if (email) authPayload.email = email;
      if (password) authPayload.password = password;

      if (Object.keys(authPayload).length > 0) {
        const updatePayload: Record<string, unknown> = { ...authPayload };
        if (email) updatePayload.email_confirm = true;

        const { error: authError } = await adminClient.auth.admin.updateUserById(userId, updatePayload);

        if (authError) {
          const msg = authError.message || "Erro ao atualizar credenciais";
          return new Response(JSON.stringify({ error: msg }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const profileUpdate: Record<string, unknown> = {};
      if (nome !== undefined) profileUpdate.nome = nome;
      if (email !== undefined) profileUpdate.email = email;

      if (Object.keys(profileUpdate).length > 0) {
        const { error: profileError } = await adminClient
          .from("profiles")
          .update(profileUpdate)
          .eq("id", userId);
        if (profileError) {
          return new Response(JSON.stringify({ error: profileError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
