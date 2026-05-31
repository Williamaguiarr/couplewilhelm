# Gerar Relatório em Word e PDF para Download

## Problema
O relatório anterior foi criado apenas como `RELATORIO_DIAGNOSTICO_AUDITORIA.md` dentro do código-fonte do projeto, não como arquivo baixável. Por isso você não encontrou o arquivo.

## O que vou fazer
1. Gerar `RELATORIO_DIAGNOSTICO_AUDITORIA.docx` (Word) em `/mnt/documents/` usando a biblioteca `docx`, com formatação profissional (títulos, tabelas de prioridade/impacto, listas).
2. Converter para `RELATORIO_DIAGNOSTICO_AUDITORIA.pdf` via LibreOffice, também em `/mnt/documents/`.
3. Validar visualmente as páginas geradas (QA de layout, tabelas e quebras).
4. Disponibilizar ambos os arquivos como artefatos clicáveis para download direto no chat.

## Conteúdo
Mesmo conteúdo já aprovado do `RELATORIO_DIAGNOSTICO_AUDITORIA.md`:
- Sumário Executivo
- Análise por Módulo (Reservas, Financeiro, Banco/Segurança)
- Diagnóstico de Problemas e Riscos (tabelas com Prioridade e Impacto)
- Recomendações de Curto e Longo Prazo
- Conclusão

## Fora do escopo
- Nenhuma alteração no código do sistema, banco de dados ou regras de negócio.
- Apenas geração de documento para estudo offline.
