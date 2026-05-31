# Relatório de Diagnóstico, Auditoria e Análise Técnica
**Data:** 31 de Maio de 2026
**Assunto:** Análise Crítica da Estrutura do Sistema de Gestão de Reservas e Financeiro

---

## 1. Sumário Executivo
Este documento apresenta uma análise profunda da arquitetura atual do sistema, identificando pontos de fragilidade e riscos para a escalabilidade. O sistema evoluiu de uma ferramenta de automação para um sistema financeiro crítico, o que exige a formalização de regras que hoje são tratadas de forma volátil no frontend.

---

## 2. Análise por Módulo

### 2.1 Reservas e Calendário
*   **Sincronização iCal:** A lógica de detecção de cancelamentos foi aprimorada, mas ainda depende de uma execução sequencial que pode falhar em volumes altos.
*   **Duplicidade:** Existe risco de colisão se uma reserva manual for criada com datas ligeiramente diferentes de uma reserva de portal que ainda não foi sincronizada.
*   **Imutabilidade:** A implementação recente da "Reserva Auditada" resolve o maior risco de integridade histórica, mas reservas não auditadas ainda são vulneráveis a recálculos retroativos involuntários.

### 2.2 Financeiro e Comissões
*   **Cálculos Voláteis:** Muitos cálculos são feitos no navegador (Frontend). Se a lógica de cálculo for alterada no código para atender uma nova demanda, ela pode afetar a exibição de dados passados não congelados.
*   **Herança de Taxas:** A hierarquia de comissão (Reserva > Imóvel > Proprietário) é resolvida em tempo de execução. Uma mudança no cadastro do Proprietário "viaja no tempo" e altera o financeiro de reservas passadas não auditadas.
*   **Taxas de Limpeza e Extras:** Ganhos extras e taxas de limpeza possuem regras de repasse que nem sempre são persistidas no momento da criação, gerando dependência de estados atuais do banco.

### 2.3 Banco de Dados e Segurança
*   **Atomicidade:** Algumas operações financeiras (como o congelamento) envolvem múltiplas tabelas. Falhas de conexão durante esses processos podem gerar estados parciais.
*   **Rastreabilidade:** Embora tenhamos o `historico_auditoria`, alterações em cadastros de Proprietários e Imóveis não possuem um log de versionamento de campos específicos (ex: "quem mudou a taxa de 25 para 30 em tal data").
*   **RLS (Row Level Security):** As políticas de segurança estão bem definidas, mas precisam de revisão constante à medida que novos papéis (admins, operacionais, parceiros) forem criados.

---

## 3. Diagnóstico de Problemas e Riscos

### 3.1 Problemas Atuais (Correção Imediata)
| Problema | Prioridade | Impacto | Descrição |
| :--- | :--- | :--- | :--- |
| Cálculos em Frontend | Crítica | Financeiro | Riscos de divergência entre o que o Admin vê e o que o Proprietário vê se houver inconsistência no código. |
| Volatilidade de Taxas | Alta | Dados | Mudanças em cadastros alteram o passado de reservas não auditadas. |
| Timeout iCal | Média | Operacional | Processamento síncrono que pode travar com o crescimento do número de imóveis. |

### 3.2 Riscos Futuros (Médio Prazo)
| Risco | Prioridade | Impacto | Descrição |
| :--- | :--- | :--- | :--- |
| Falta de Versionamento de Regras | Alta | Relatórios | Impossibilidade de auditar "qual era a regra de repasse" em janeiro de 2024 se ela foi alterada em março. |
| Concorrência de Dados | Média | Usuários | Múltiplos admins editando a mesma reserva ou lançamentos financeiros simultaneamente. |
| Sobrecarga de Processamento | Baixa | Performance | Dashboard acumulado calculando milhares de linhas em tempo real no dispositivo do usuário. |

---

## 4. Recomendações de Melhoria

### 4.1 Curto Prazo (Agora)
1.  **Snapshot no Insert:** Ao criar uma reserva, salvar uma cópia da taxa de comissão vigente no momento.
2.  **Centralização em SQL:** Mover as fórmulas financeiras de JavaScript para Database Functions ou Views.
3.  **Auditoria Automática:** Reservas integradas via iCal com valores validados devem ser auditadas automaticamente após um período de carência.

### 4.2 Longo Prazo (Escalabilidade)
1.  **Arquitetura de Filas:** Mover a sincronização do iCal para um sistema de background jobs (queues) individual por imóvel.
2.  **Versionamento de Entidades:** Criar um histórico de alterações (Audit Log) para os cadastros de Imóveis e Proprietários.
3.  **Módulo de Previsão:** Implementar cálculos de "Revenue Management" baseados em dados históricos persistidos.

---

## 5. Conclusão
O sistema é funcional e robusto para a operação atual, mas a transição para um modelo onde os **dados financeiros são persistidos (Snapshots)** em vez de **calculados (Live)** é o passo necessário para garantir a segurança jurídica e financeira da empresa à medida que ela escala para centenas de unidades.

---
**Elaborado por:** Lovable AI
**Status do Sistema:** Estável com necessidade de refatoração financeira.
