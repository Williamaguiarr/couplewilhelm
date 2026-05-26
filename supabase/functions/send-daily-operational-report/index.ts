import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors'

// Defaults (mirrors src/components/calendario/types.ts)
const HORA_CHECKIN_PADRAO = '15:00'
const HORA_CHECKOUT_PADRAO = '11:00'

const normHora = (h?: string | null) => (h ? String(h).slice(0, 5) : null)

function isoDateBRT(offsetDays = 0): string {
  // BRT = UTC-3 (no DST since 2019)
  const now = new Date()
  // No server side, o 'now' já está na data correta do sistema
  // Mas para garantir o dia do calendário BRT:
  const brt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  brt.setDate(brt.getDate() + offsetDays)
  
  const year = brt.getFullYear()
  const month = String(brt.getMonth() + 1).padStart(2, '0')
  const day = String(brt.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  const hoje = isoDateBRT(0)
  const amanha = isoDateBRT(1)

  // 1. Buscar admins inscritos
  const { data: configs, error: cfgErr } = await supabase
    .from('admin_configs')
    .select('admin_id, nome_empresa, relatorio_diario_email')
    .eq('relatorio_diario_ativo', true)
    .eq('ativo', true)
    .not('relatorio_diario_email', 'is', null)

  if (cfgErr) {
    console.error('Erro ao buscar admins', cfgErr)
    return new Response(JSON.stringify({ error: cfgErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const results: any[] = []

  for (const cfg of configs ?? []) {
    // 2. Imoveis deste admin (via admin_proprietarios -> proprietario_id -> imoveis)
    const { data: links } = await supabase
      .from('admin_proprietarios')
      .select('proprietario_id')
      .eq('admin_id', cfg.admin_id)

    const proprietarioIds = (links ?? []).map((l: any) => l.proprietario_id)
    if (proprietarioIds.length === 0) {
      results.push({ admin_id: cfg.admin_id, skipped: 'sem proprietarios' })
      continue
    }

    const { data: imoveis } = await supabase
      .from('imoveis')
      .select('id, nome_imovel, hora_checkin, hora_checkout')
      .or(proprietarioIds.map((id: string) => `proprietario_id.eq.${id},proprietario_id_2.eq.${id}`).join(','))

    const imovelMap = new Map<string, any>()
    for (const i of imoveis ?? []) imovelMap.set(i.id, i)
    const imovelIds = Array.from(imovelMap.keys())
    if (imovelIds.length === 0) {
      results.push({ admin_id: cfg.admin_id, skipped: 'sem imoveis' })
      continue
    }

    // 3. Reservas com check-in OU check-out em hoje/amanha
    const { data: reservas } = await supabase
      .from('reservas')
      .select('id, imovel_id, data_inicio, data_fim, nome_hospede, hora_checkin_override, hora_checkout_override')
      .in('imovel_id', imovelIds)
      .or(`data_inicio.in.(${hoje},${amanha}),data_fim.in.(${hoje},${amanha})`)

    const construirDia = (data: string) => {
      const checkins: any[] = []
      const checkouts: any[] = []
      for (const r of reservas ?? []) {
        // No status column available based on schema check
        // if ((r as any).status === 'cancelada') continue
        const im = imovelMap.get(r.imovel_id)
        if (!im) continue
        if (r.data_inicio === data) {
          checkins.push({
            tipo: 'checkin',
            hora: normHora(r.hora_checkin_override) || normHora(im.hora_checkin) || HORA_CHECKIN_PADRAO,
            imovel: im.nome_imovel,
            hospede: r.nome_hospede || 'N/A',
          })
        }
        if (r.data_fim === data) {
          checkouts.push({
            tipo: 'checkout',
            hora: normHora(r.hora_checkout_override) || normHora(im.hora_checkout) || HORA_CHECKOUT_PADRAO,
            imovel: im.nome_imovel,
            hospede: r.nome_hospede || 'N/A',
          })
        }
      }
      checkins.sort((a, b) => a.hora.localeCompare(b.hora))
      checkouts.sort((a, b) => a.hora.localeCompare(b.hora))
      return { checkins, checkouts }
    }

    const diaHoje = construirDia(hoje)
    const diaAmanha = construirDia(amanha)

    const dias = [
      { label: 'HOJE', data: hoje, ...diaHoje },
      { label: 'AMANHÃ', data: amanha, ...diaAmanha },
    ]

    const idem = `op-report-${cfg.admin_id}-${hoje}-${Date.now()}`

    const payload = {
      templateName: 'operational-daily-report',
      recipientEmail: cfg.relatorio_diario_email,
      idempotencyKey: idem,
      templateData: {
        empresaNome: cfg.nome_empresa || 'couplewilhelm',
        geradoEm: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        hoje,
        amanha,
        dias,
      },
    }

    console.log(`Invocando send-transactional-email para ${cfg.relatorio_diario_email}`)

    const { data: iData, error: iErr } = await supabase.functions.invoke('send-transactional-email', {
      body: payload,
      headers: {
        Authorization: `Bearer ${serviceKey}`
      }
    })

    if (iErr) {
      console.error(`Erro ao invocar send-transactional-email:`, iErr)
    }

    results.push({
      admin_id: cfg.admin_id,
      email: cfg.relatorio_diario_email,
      checkins_hoje: diaHoje.checkins.length,
      checkouts_hoje: diaHoje.checkouts.length,
      checkins_amanha: diaAmanha.checkins.length,
      checkouts_amanha: diaAmanha.checkouts.length,
      invoke_data: iData,
      error: iErr,
    })
  }

  return new Response(JSON.stringify({ ok: true, hoje, amanha, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
