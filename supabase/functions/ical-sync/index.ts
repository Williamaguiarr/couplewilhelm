import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Parse iCal text and return array of events with dtstart, dtend, summary, uid
function parseICal(text: string): Array<{ uid: string; dtstart: string; dtend: string; summary: string }> {
  const events: Array<{ uid: string; dtstart: string; dtend: string; summary: string }> = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  const unfolded: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }

  let inEvent = false;
  let current: Partial<{ uid: string; dtstart: string; dtend: string; summary: string }> = {};

  for (const line of unfolded) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
    } else if (line === "END:VEVENT") {
      if (current.uid && current.dtstart && current.dtend) {
        events.push({
          uid: current.uid,
          dtstart: current.dtstart,
          dtend: current.dtend,
          summary: current.summary || "",
        });
      }
      inEvent = false;
    } else if (inEvent) {
      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const propFull = line.slice(0, colonIdx).toUpperCase();
      const value = line.slice(colonIdx + 1).trim();
      const propName = propFull.split(";")[0];

      if (propName === "UID") current.uid = value;
      else if (propName === "DTSTART") current.dtstart = parseICalDate(value);
      else if (propName === "DTEND") current.dtend = parseICalDate(value);
      else if (propName === "SUMMARY") current.summary = value;
    }
  }

  return events;
}

function parseICalDate(val: string): string {
  const clean = val.replace(/[TZ]/g, "");
  if (clean.length >= 8) {
    const y = clean.slice(0, 4);
    const m = clean.slice(4, 6);
    const d = clean.slice(6, 8);
    return `${y}-${m}-${d}`;
  }
  return val;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // ── Auth check ────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

  if (!isServiceRole) {
    // Must be an authenticated admin user
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin or master
    const { data: roleCheck } = await callerClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "master"])
      .limit(1);

    if (!roleCheck || roleCheck.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden: admins only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ── Parse body ────────────────────────────────────────────────────────
  let imovelId: string | null = null;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      imovelId = body.imovel_id ?? null;
    } catch (_) { /* no body */ }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Fetch properties to sync
  let query = supabase
    .from("imoveis")
    .select("id, nome_imovel, ical_url_airbnb, ical_url_booking");

  if (imovelId) {
    query = query.eq("id", imovelId);
  } else {
    query = query.or("ical_url_airbnb.neq.null,ical_url_booking.neq.null");
  }

  const { data: imoveis, error: fetchError } = await query;

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<{ imovel_id: string; source: string; synced: number; errors: string[] }> = [];

  for (const imovel of imoveis ?? []) {
    const sources: Array<{ url: string | null; source: string }> = [
      { url: imovel.ical_url_airbnb, source: "airbnb" },
      { url: imovel.ical_url_booking, source: "booking" },
    ];

    for (const { url, source } of sources) {
      if (!url) continue;

      const result = { imovel_id: imovel.id, source, synced: 0, errors: [] as string[] };

      try {
        const response = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; CoupleWilhelm/1.0)" },
        });

        if (!response.ok) {
          result.errors.push(`HTTP ${response.status} fetching iCal`);
          results.push(result);
          continue;
        }

        const icalText = await response.text();
        const events = parseICal(icalText);

        for (const event of events) {
          const payload = {
            imovel_id: imovel.id,
            data_inicio: event.dtstart,
            data_fim: event.dtend,
            observacoes: `[${source.toUpperCase()}] ${event.summary}`.trim(),
            valor_bruto: null,
            taxa_limpeza: null,
            valor_liquido_proprietario: null,
          };

          const { data: existing } = await supabase
            .from("reservas")
            .select("id")
            .eq("imovel_id", imovel.id)
            .eq("data_inicio", event.dtstart)
            .eq("data_fim", event.dtend)
            .maybeSingle();

          if (!existing) {
            const { error: insertError } = await supabase.from("reservas").insert(payload);
            if (insertError) {
              result.errors.push(insertError.message);
            } else {
              result.synced++;
            }
          }
        }
      } catch (err) {
        result.errors.push(String(err));
      }

      results.push(result);
    }

    await supabase
      .from("imoveis")
      .update({ ical_last_sync: new Date().toISOString() })
      .eq("id", imovel.id);
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
