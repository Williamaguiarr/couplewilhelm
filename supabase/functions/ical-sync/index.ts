import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ICalEvent {
  uid: string;
  dtstart: string;
  dtend: string;
  summary: string;
  description: string;
  raw_dtstart?: string;
  raw_dtend?: string;
}

// Parse iCal text and return array of events
function parseICal(text: string): ICalEvent[] {
  const events: ICalEvent[] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  // Unfold continuation lines (RFC 5545 §3.1)
  const unfolded: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }

  let inEvent = false;
  let current: Partial<ICalEvent> = {};

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
          description: current.description || "",
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
      else if (propName === "DTSTART") {
        current.raw_dtstart = value;
        current.dtstart = parseICalDate(value);
      }
      else if (propName === "DTEND") {
        current.raw_dtend = value;
        current.dtend = parseICalDate(value);
      }
      else if (propName === "SUMMARY") current.summary = value;
      else if (propName === "DESCRIPTION") current.description = value;
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

/**
 * Extract guest name from SUMMARY.
 * Airbnb format: "Reserved - João Silva" or "Reservado - João Silva"
 * Booking format: "CLOSED - João Silva" or just "João Silva"
 * Default: If it's a valid reservation structure but no name is provided, return a placeholder.
 */
/**
 * Extract guest name from SUMMARY or DESCRIPTION.
 */
function extractGuestName(summary: string, description: string, source: string): string | null {
  const upperSummary = summary ? summary.toUpperCase() : "";
  const upperDesc = description ? description.toUpperCase() : "";
  
  // Handle specific "Not available" or generic "Reserved" cases
  const isGeneric = 
    upperSummary === "RESERVED" || 
    upperSummary.includes("AIRBNB (NOT AVAILABLE)") || 
    upperSummary.includes("CLOSED - NOT AVAILABLE") ||
    upperSummary === "CLOSED";

  // If generic summary, try to find guest name in description
  if (isGeneric && description) {
    const namePatterns = [
      /(?:guest name|nome do hóspede|hóspede|guest)\s*[:=]\s*([^\\n|\n]+)/i,
      /Hóspede:\s*([^\\n|\n]+)/i
    ];
    for (const p of namePatterns) {
      const match = description.match(p);
      if (match && match[1].trim() && !/^(airbnb|booking|not available|blocked)$/i.test(match[1].trim())) {
        return match[1].trim();
      }
    }
  }

  if (isGeneric) {
    return source === "airbnb" ? "Hóspede Airbnb" : "Hóspede Booking";
  }

  // Remove common prefixes from summary
  const cleaned = summary
    .replace(/^(Reserved|Reservado|CLOSED|Blocked|Bloqueado|Not available)\s*[-–—:]\s*/i, "")
    .trim();
    
  if (cleaned && !/^(airbnb|booking|not available|blocked|bloqueado|reserved)$/i.test(cleaned)) {
    return cleaned;
  }
  
  return source === "airbnb" ? "Hóspede Airbnb" : "Hóspede Booking";
}

/**
 * Extract number of guests from DESCRIPTION.
 * Airbnb: "Number of guests: 3" or "Número de hóspedes: 3"
 * Booking: "Guest count: 3" or similar patterns
 */
function extractNumGuests(description: string): number | null {
  if (!description) return null;
  // Decode escaped newlines
  const text = description.replace(/\\n/g, "\n").replace(/\\,/g, ",");
  
  const patterns = [
    /(?:number of guests|número de hóspedes|guest count|guests?|hóspedes?)\s*[:=]\s*(\d+)/i,
    /(\d+)\s*(?:guests?|hóspedes?)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > 0 && num < 100) return num;
    }
  }
  return null;
}

/**
 * Extract phone number from DESCRIPTION.
 */
function extractPhone(description: string): string | null {
  if (!description) return null;
  const text = description.replace(/\\n/g, "\n");
  const match = text.match(/(?:phone|telefone|tel|contato)\s*[:=]\s*([+\d\s()-]{8,20})/i);
  return match ? match[1].trim() : null;
}

/**
 * Extract Reservation Code from SUMMARY or DESCRIPTION.
 */
function extractReservationCode(summary: string, description: string): string | null {
  // Airbnb pattern: URL ending with the code
  const airbnbMatch = description.match(/reservations\/details\/([A-Z0-9]+)/);
  if (airbnbMatch) return airbnbMatch[1];

  // Generic patterns (e.g., Booking often has it in summary or a specific line)
  const codePatterns = [
    /(?:conf|code|código|reserva|id)\s*[:#]\s*([A-Z0-9]{8,})/i,
    /([A-Z0-9]{10,})/ // Long alphanumeric string
  ];

  for (const p of codePatterns) {
    const match = description.match(p) || summary.match(p);
    if (match) return match[1];
  }

  return null;
}

/**
 * Extract Reservation URL.
 */
function extractReservationUrl(description: string): string | null {
  const match = description.match(/(https?:\/\/[^\s]+)/);
  return match ? match[1].replace(/\\/g, '') : null;
}

/**
 * Extract specific time if available in raw date string.
 * Example: 20231025T150000Z -> 15:00
 */
function extractTime(rawVal?: string): string | null {
  if (!rawVal || !rawVal.includes("T")) return null;
  const timePart = rawVal.split("T")[1];
  if (timePart.length >= 4) {
    return `${timePart.slice(0, 2)}:${timePart.slice(2, 4)}`;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // ── Auth ──────────────────────────────────────────────────────────────
  // This function is invoked by:
  //  • the cron job (anon/publishable key)
  //  • admins from the UI (user JWT)
  //  • service-role internal callers
  // The work it performs is restricted to URLs already stored on `imoveis`
  // by an admin, so we only require that *some* bearer token is present
  // (verify_jwt=false at the gateway lets the function decide). This avoids
  // mismatches between legacy anon JWTs and the newer publishable keys.
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("apikey");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

  let query = supabase
    .from("imoveis")
    .select("id, nome_imovel, ical_url_airbnb, ical_url_booking");

  if (imovelId) {
    query = query.eq("id", imovelId);
  } else {
    // PostgREST: usar `not.is.null` (e não `neq.null`) para filtrar valores não nulos
    query = query.or("ical_url_airbnb.not.is.null,ical_url_booking.not.is.null");
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

      // ── SSRF protection: only allow HTTPS to known iCal providers ─────
      const ALLOWED_HOSTS = /^([a-z0-9-]+\.)*(airbnb\.com|airbnb\.com\.br|booking\.com|admin\.booking\.com)$/i;
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        result.errors.push("URL inválida");
        results.push(result);
        continue;
      }
      if (parsedUrl.protocol !== "https:" || !ALLOWED_HOSTS.test(parsedUrl.hostname)) {
        result.errors.push(`URL não permitida (host: ${parsedUrl.hostname})`);
        results.push(result);
        continue;
      }

      try {
        const response = await fetch(parsedUrl.toString(), {
          headers: { 
            "User-Agent": "Mozilla/5.0 (compatible; CoupleWilhelm/1.0)",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache"
          },
          redirect: "follow",
        });

        if (!response.ok) {
          result.errors.push(`HTTP ${response.status} fetching iCal`);
          results.push(result);
          continue;
        }

        const icalText = await response.text();
        const events = parseICal(icalText);

        // 1. Coletar todos os UIDs de eventos ativos no iCal para este imóvel/fonte
        const currentEventUids = new Set(events.map(e => e.uid));

        // Janela: somente eventos dos próximos 3 meses (a partir de hoje)
        const today = new Date();
        const todayStr = today.toISOString().split("T")[0];
        const limitDate = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
        const limitStr = limitDate.toISOString().split("T")[0];

        // 2. Detectar cancelamentos: reservas locais com ical_uid que não estão mais no iCal
        // Buscamos apenas reservas que estão dentro da nossa janela de interesse (hoje até 3 meses)
        const { data: localReservas } = await supabase
          .from("reservas")
          .select("id, ical_uid, data_inicio")
          .eq("imovel_id", imovel.id)
          .eq("plataforma_origem", source)
          .not("ical_uid", "is", null)
          .gte("data_fim", todayStr)
          .lte("data_inicio", limitStr);

        for (const res of localReservas ?? []) {
          if (!currentEventUids.has(res.ical_uid!)) {
            // Reserva sumiu do iCal -> Possível cancelamento
            // Criar alerta se não existir um pendente
            const { data: existingAlert } = await supabase
              .from("ical_sync_alerts")
              .select("id")
              .eq("reserva_id", res.id)
              .eq("status", "pending")
              .maybeSingle();

            if (!existingAlert) {
              await supabase.from("ical_sync_alerts").insert({
                reserva_id: res.id,
                imovel_id: imovel.id,
                plataforma: source,
                status: "pending"
              });
            }
          }
        }

        // 3. Processar/Sincronizar eventos do iCal
        for (const event of events) {
          // Pula eventos fora da janela: já passaram (data_fim < hoje) ou começam após o limite
          if (event.dtend < todayStr) continue;
          if (event.dtstart > limitStr) continue;

          const guestName = extractGuestName(event.summary, event.description, source);
          const numGuests = extractNumGuests(event.description);
          const phone = extractPhone(event.description);
          const resCode = extractReservationCode(event.summary, event.description);
          const resUrl = extractReservationUrl(event.description);
          const checkinTime = extractTime(event.raw_dtstart);
          const checkoutTime = extractTime(event.raw_dtend);
          
          const obsLines: string[] = [`[${source.toUpperCase()}] ${event.summary}`.trim()];
          if (phone) obsLines.push(`Tel: ${phone}`);
          if (resCode) obsLines.push(`Cod: ${resCode}`);
          if (event.description) {
            const descClean = event.description.replace(/\\n/g, " | ").replace(/\\,/g, ",");
            if (descClean.length > 0) {
              obsLines.push(descClean.length > 500 ? descClean.slice(0, 500) + "..." : descClean);
            }
          }

          const payload: Record<string, unknown> = {
            imovel_id: imovel.id,
            data_inicio: event.dtstart,
            data_fim: event.dtend,
            observacoes: obsLines.join("\n"),
            nome_hospede: guestName,
            plataforma_origem: source,
            num_hospedes: numGuests,
            ical_uid: event.uid,
            codigo_reserva: resCode,
            reserva_url: resUrl,
            status_reserva: event.summary.toUpperCase().includes("CANCEL") ? "cancelada" : "confirmada",
            hora_checkin_override: checkinTime,
            hora_checkout_override: checkoutTime,
          };

          // Tentar encontrar por ical_uid primeiro (mais preciso)
          const { data: existingByUid } = await supabase
            .from("reservas")
            .select("id, data_inicio, data_fim, nome_hospede, num_hospedes, codigo_reserva, reserva_url")
            .eq("imovel_id", imovel.id)
            .eq("ical_uid", event.uid)
            .maybeSingle();

          if (existingByUid) {
            // Verificar se houve mudanças reais
            const hasChanged = 
              existingByUid.data_inicio !== event.dtstart || 
              existingByUid.data_fim !== event.dtend ||
              existingByUid.nome_hospede !== guestName ||
              existingByUid.num_hospedes !== numGuests ||
              (existingByUid as any).codigo_reserva !== resCode ||
              (existingByUid as any).reserva_url !== resUrl;

            if (hasChanged) {
              const { error: updateError } = await supabase
                .from("reservas")
                .update(payload)
                .eq("id", existingByUid.id);
              
              if (updateError) {
                result.errors.push(`Erro ao atualizar reserva ${event.uid}: ${updateError.message}`);
              } else {
                result.synced++;
              }
            }
          } else {
            // Fallback por datas se não tiver UID (retrocompatibilidade ou mudança de UID)
            const { data: existingByDates } = await supabase
              .from("reservas")
              .select("id")
              .eq("imovel_id", imovel.id)
              .eq("data_inicio", event.dtstart)
              .eq("data_fim", event.dtend)
              .maybeSingle();

            if (!existingByDates) {
              const { error: insertError } = await supabase.from("reservas").insert(payload);
              if (insertError) {
                result.errors.push(insertError.message);
              } else {
                result.synced++;
              }
            } else {
              // Se achou por data mas não tinha UID, atualiza com o UID
              await supabase.from("reservas").update({ ical_uid: event.uid }).eq("id", existingByDates.id);
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
