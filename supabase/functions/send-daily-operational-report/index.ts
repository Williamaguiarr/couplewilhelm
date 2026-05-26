import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'
import * as React from 'https://esm.sh/react@18.3.1?dev'
import { renderAsync } from 'https://esm.sh/@react-email/components@0.0.22?deps=react@18.3.1,react-dom@18.3.1'



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

const SITE_NAME = "couplewilhelm"
const SENDER_DOMAIN = "notify.couplewilhelm.online"
const FROM_DOMAIN = "notify.couplewilhelm.online"

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
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

    console.log(`Enfileirando email para ${cfg.relatorio_diario_email}`)

    const templateName = 'operational-daily-report'
    const template = TEMPLATES[templateName]
    
    // Resolve effective recipient
    const effectiveRecipient = cfg.relatorio_diario_email
    const normalizedEmail = effectiveRecipient.toLowerCase()

    // 1. Get/Create unsubscribe token
    let unsubscribeToken: string
    const { data: existingToken } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingToken) {
      unsubscribeToken = existingToken.token
    } else {
      unsubscribeToken = generateToken()
      await supabase.from('email_unsubscribe_tokens').insert({ token: unsubscribeToken, email: normalizedEmail })
    }

    // 2. Render templates
    const html = await renderAsync(React.createElement(template.component, payload.templateData))
    const plainText = await renderAsync(React.createElement(template.component, payload.templateData), { plainText: true })
    const resolvedSubject = typeof template.subject === 'function' ? template.subject(payload.templateData) : template.subject
    const messageId = crypto.randomUUID()

    // 3. Log pending
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'pending',
    })

    // 4. Enqueue
    const { error: enqueueError } = await supabase.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId,
        to: effectiveRecipient,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: resolvedSubject,
        html,
        text: plainText,
        purpose: 'transactional',
        label: templateName,
        idempotency_key: idem,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    })

    if (enqueueError) {
      console.error(`Erro ao enfileirar email:`, enqueueError)
    }

    results.push({
      admin_id: cfg.admin_id,
      email: cfg.relatorio_diario_email,
      enqueued: !enqueueError,
      error: enqueueError,
    })

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
