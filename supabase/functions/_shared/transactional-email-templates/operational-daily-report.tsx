import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'couplewilhelm'

interface Evento {
  hora: string
  tipo: 'checkin' | 'checkout'
  imovel: string
  hospede: string
}

interface DayBlock {
  label: string
  data: string
  checkins: Evento[]
  checkouts: Evento[]
}

interface OperationalDailyReportProps {
  empresaNome?: string
  geradoEm?: string
  dias?: DayBlock[]
}

const fallback: DayBlock[] = [
  { label: 'HOJE', data: '2026-05-26', checkins: [], checkouts: [] },
  { label: 'AMANHÃ', data: '2026-05-27', checkins: [], checkouts: [] },
]

const OperationalDailyReportEmail = ({
  empresaNome = SITE_NAME,
  geradoEm = new Date().toLocaleString('pt-BR'),
  dias = fallback,
}: OperationalDailyReportProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Relatório operacional diário — check-ins e check-outs</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Relatório Operacional</Heading>
        <Text style={subtitle}>{empresaNome}</Text>

        {dias.map((dia) => (
          <Section key={dia.data} style={daySection}>
            <Heading as="h2" style={h2}>
              {dia.label} · {dia.data}
            </Heading>

            <Text style={blockTitle}>📤 Check-outs</Text>
            {dia.checkouts.length === 0 ? (
              <Text style={empty}>Nenhuma movimentação</Text>
            ) : (
              dia.checkouts.map((e, i) => (
                <Text key={`co-${i}`} style={eventLine}>
                  <strong>{e.hora}</strong> — {e.imovel} ({e.hospede || 'N/A'})
                </Text>
              ))
            )}

            <Text style={blockTitle}>📥 Check-ins</Text>
            {dia.checkins.length === 0 ? (
              <Text style={empty}>Nenhuma movimentação</Text>
            ) : (
              dia.checkins.map((e, i) => (
                <Text key={`ci-${i}`} style={eventLine}>
                  <strong>{e.hora}</strong> — {e.imovel} ({e.hospede || 'N/A'})
                </Text>
              ))
            )}
            <Hr style={hr} />
          </Section>
        ))}

        <Text style={footer}>Gerado em {geradoEm}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OperationalDailyReportEmail,
  subject: (data: Record<string, any>) => {
    const hoje = data?.dias?.[0]?.data ?? ''
    return `Relatório Operacional — ${hoje}`
  },
  displayName: 'Relatório operacional diário',
  previewData: {
    empresaNome: 'couplewilhelm',
    geradoEm: '26/05/2026 07:00',
    dias: [
      {
        label: 'HOJE',
        data: '2026-05-26',
        checkins: [{ hora: '15:00', tipo: 'checkin', imovel: 'Cobertura Marinho', hospede: 'João Silva' }],
        checkouts: [{ hora: '11:00', tipo: 'checkout', imovel: 'Suíte Dourada', hospede: 'Maria Costa' }],
      },
      {
        label: 'AMANHÃ',
        data: '2026-05-27',
        checkins: [],
        checkouts: [{ hora: '11:00', tipo: 'checkout', imovel: 'Cobertura Marinho', hospede: 'João Silva' }],
      },
    ],
  },
} satisfies TemplateEntry

const main: React.CSSProperties = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container: React.CSSProperties = { padding: '28px 28px', maxWidth: '560px' }
const h1: React.CSSProperties = { fontSize: '24px', fontWeight: 700, color: '#0A192F', margin: '0 0 4px' }
const subtitle: React.CSSProperties = { fontSize: '13px', color: '#C5A059', margin: '0 0 24px', textTransform: 'uppercase', letterSpacing: '1px' }
const h2: React.CSSProperties = { fontSize: '16px', fontWeight: 700, color: '#0A192F', margin: '12px 0 8px' }
const daySection: React.CSSProperties = { marginBottom: '16px' }
const blockTitle: React.CSSProperties = { fontSize: '13px', fontWeight: 600, color: '#0A192F', margin: '12px 0 4px' }
const eventLine: React.CSSProperties = { fontSize: '14px', color: '#1f2937', margin: '2px 0', lineHeight: '1.5' }
const empty: React.CSSProperties = { fontSize: '13px', color: '#9ca3af', margin: '2px 0 8px', fontStyle: 'italic' }
const hr: React.CSSProperties = { borderColor: '#e5e7eb', margin: '16px 0' }
const footer: React.CSSProperties = { fontSize: '12px', color: '#9ca3af', margin: '24px 0 0', textAlign: 'center' as const }
