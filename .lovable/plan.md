## Visão Operacional — Check-ins / Check-outs no Calendário

Adicionar uma nova visão dentro de `/admin/calendario` para a equipe de limpeza e logística, separada da visão atual de Ocupação.

### Estrutura da página

Tabs no topo:
- **Ocupação** (atual, mantida intacta)
- **Operacional** (nova)

### Banco de dados

Adicionar tabela `limpezas` para rastrear status de limpeza por reserva (atrelada à data de checkout):

```text
limpezas
- id
- reserva_id (uuid)
- imovel_id (uuid)
- data_limpeza (date) — normalmente = data_fim da reserva
- status (text: 'pendente' | 'concluida')
- responsavel (text, nullable)
- observacoes (text, nullable)
- concluida_em (timestamptz, nullable)
- created_at / updated_at
```

RLS:
- Master: tudo
- Admin (ativo): tudo nos imóveis dele
- Proprietário: SELECT nos imóveis dele

Índice em `(imovel_id, data_limpeza)`.

### Visão Operacional — UI

**Resumo do dia (cards no topo):**
- Check-ins hoje
- Check-outs hoje
- Total de hóspedes do dia
- Limpezas pendentes

**Seletor de período:** Hoje | Amanhã | Próximos 7 dias | Data específica

**Filtros:** Imóvel · Tipo (check-in/check-out) · Status da limpeza

**Lista agrupada por dia**, cada card de evento mostra:
- Imóvel · Hóspede · Nº hóspedes · Plataforma
- Horário check-in/out (vem de `imoveis.checkin_horario`/`checkout_horario` se existir, senão padrão 15h/11h)
- Badge de tipo: verde (check-in) / vermelho (check-out)
- Badge de limpeza: amarelo (pendente) / azul (concluída) — só em check-outs
- Indicador "muitos hóspedes" quando `num_hospedes >= 5`
- Botões: Marcar limpeza concluída · Atribuir responsável · Adicionar observação (dialog)

**Modo calendário compacto (toggle):** mini grid mensal com badges de entradas/saídas por dia e tooltip com detalhes.

**Mobile:** lista vertical compacta, cards densos, ações em sheet.

Visual seguindo o tema premium (Marinho/Dourado, Playfair/Inter), tokens semânticos apenas.

### Arquivos

- `supabase/migrations/...` — tabela `limpezas` + RLS + índice
- `src/pages/admin/Calendario.tsx` — Tabs Ocupação / Operacional
- `src/components/calendario/VisaoOperacional.tsx` — nova visão
- `src/components/calendario/EventoCard.tsx` — card de evento
- `src/components/calendario/LimpezaDialog.tsx` — editar limpeza
- `src/components/calendario/ResumoDia.tsx` — cards de KPI
- `src/components/calendario/MiniCalendario.tsx` — modo grid compacto

### Notas técnicas

- Limpezas são geradas/garantidas no carregamento via `upsert` por `reserva_id` para reservas com checkout no período visível (auto-criação preguiçosa, evita backfill pesado).
- `num_hospedes` e `nome_hospede` vêm de `reservas`; já existem.
- Plataforma detectada via `plataforma_origem` (preferencial) ou prefixo em `observacoes` (compatibilidade com lógica atual).
