import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { email, password, nome, role, bootstrap_secret } = body;

    // ── MODO BOOTSTRAP (criar primeiro admin sem auth) ──────────────────
    if (bootstrap_secret) {
      const BOOTSTRAP_SECRET = Deno.env.get("BOOTSTRAP_SECRET");
      if (!BOOTSTRAP_SECRET) {
        return new Response(JSON.stringify({ error: "Bootstrap não configurado no servidor." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (bootstrap_secret !== BOOTSTRAP_SECRET) {
        return new Response(JSON.stringify({ error: "Bootstrap secret inválido" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verificar se já existe algum master ou admin
      const { data: existingAdmins } = await adminClient
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "master"]);

      if (existingAdmins && existingAdmins.length > 0) {
        return new Response(
          JSON.stringify({ error: "Sistema já configurado. Use o painel para criar mais usuários." }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Criar o primeiro admin
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome: nome || "Administrador" },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from("user_roles").insert({
        user_id: newUser.user.id,
        role: "master",
      });

      await adminClient.from("profiles").update({ nome: nome || "Master" }).eq("id", newUser.user.id);

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── MODO NORMAL (admin cria outros usuários) ─────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser } } = await callerClient.auth.getUser();
    if (!callerUser) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Apenas admins podem criar usuários" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!email || !password || !nome || !role) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: email, password, nome, role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let targetUserId: string;

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome },
    });

    if (createError) {
      const isEmailExists =
        createError.message?.toLowerCase().includes("already been registered") ||
        createError.message?.toLowerCase().includes("email_exists") ||
        (createError as any)?.code === "email_exists";

      if (!isEmailExists) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: listData, error: listError } = await adminClient.auth.admin.listUsers();
      if (listError) {
        return new Response(JSON.stringify({ error: "Erro ao buscar usuário existente." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const existingUser = (listData?.users ?? []).find(
        (u: any) => u.email?.toLowerCase() === email.toLowerCase()
      );

      if (!existingUser) {
        return new Response(
          JSON.stringify({ error: "E-mail já cadastrado mas não foi possível localizar o usuário." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      targetUserId = existingUser.id;

      const { data: existingRoles } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", targetUserId);

      const roles = (existingRoles ?? []).map((r: any) => r.role);
      if (roles.includes("admin") || roles.includes("master")) {
        return new Response(
          JSON.stringify({ error: "Este e-mail pertence a um administrador e não pode ser vinculado como proprietário." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!roles.includes(role)) {
        await adminClient.from("user_roles").insert({ user_id: targetUserId, role });
      }

      await adminClient.from("profiles").update({ nome }).eq("id", targetUserId);

      if (role === "proprietario") {
        const { data: existingLink } = await adminClient
          .from("admin_proprietarios")
          .select("id")
          .eq("admin_id", callerUser.id)
          .eq("proprietario_id", targetUserId)
          .maybeSingle();

        if (!existingLink) {
          await adminClient.from("admin_proprietarios").insert({
            admin_id: callerUser.id,
            proprietario_id: targetUserId,
          });
        }
      }

      return new Response(
        JSON.stringify({ success: true, user_id: targetUserId, reused: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    targetUserId = newUser.user.id;

    await adminClient.from("user_roles").insert({ user_id: targetUserId, role });
    await adminClient.from("profiles").update({ nome }).eq("id", targetUserId);

    if (role === "proprietario") {
      await adminClient.from("admin_proprietarios").insert({
        admin_id: callerUser.id,
        proprietario_id: targetUserId,
      });
    }

    return new Response(JSON.stringify({ success: true, user_id: targetUserId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
