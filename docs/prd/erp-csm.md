# PRD — ERP / CSM Admin (MelhorAgencia.ai)

**Versão:** 1.1
**Data:** 2026-03-24
**Status:** Em produção (MVP)

---

## 1. Visão Geral

O **Admin ERP/CSM** (acessível em `admin.melhoragencia.ai`) é o painel interno da equipe MelhorAgencia para gerenciar a base de clientes do TarefaApp. Funciona como um CRM leve + sistema de Customer Success Management (CSM), combinando métricas de saúde de cliente, onboarding, cobrança e comunicação.

---

## 2. Problemas que Resolve

| Problema | Solução |
|----------|---------|
| Falta de visibilidade sobre saúde dos clientes | Customer Health Score (CHS) com 5 dimensões |
| Sem registro de interações com clientes | CRM Logs com histórico por workspace |
| Dificuldade em identificar clientes em risco | Dashboard com alertas de score baixo e contatos vencidos |
| MRR e churn sem fonte única | Dashboard financeiro consolidado |
| Onboarding não rastreado | Detecção ao vivo das 5 etapas de onboarding |
| WhatsApp engagement não mensurável | Tabela `message_logs` alimentada pelo bot em tempo real |

---

## 3. Usuários

- **Equipe de CS (Customer Success):** acompanha saúde dos clientes, registra contatos, identifica riscos
- **Gestores:** monitoram MRR, churn, NPS agregado
- **Fundadores:** visão geral do negócio

---

## 4. Features do MVP (produção)

### 4.1 Dashboard Principal (`/dashboard`)

**Métricas no topo:**
- MRR atual (R$)
- Churn rate (%)
- Clientes ativos
- NPS médio (últimos 90d)

**Seções de workspaces:**
- 🔴 Clientes em Atenção (CHS < 40)
- 📆 Clientes com contato agendado (próximo contato ≤ hoje + preview de anotação)
- 📋 Todos os Clientes (tabela com CHS, plano, status, ações)

**Ações rápidas por cliente:**
- "Ver ficha" → página de detalhes (borda rosa `rgba(235,75,113,0.3)` na seção de atenção)
- Acesso direto ao Supabase

---

### 4.2 Ficha do Cliente (`/dashboard/customers/[id]`)

**Layout:** grid-cols-3 — CHS gauge (col-span-1) + info card (col-span-2)

**Bloco superior:**
- Gauge do CHS (score 0–100, label crítico/atenção/saudável)
- Nome, status, plano, slug, ID
- Métricas: MRR, LTV (MRR × meses ativo), Meses ativo, Membros ativos, Tarefas (7d)

**CRM Logs (centro):**
- Histórico cronológico de interações (anotações da equipe de CS)
- Campos: tipo, canal, anotação, autor (read-only — capturado do usuário logado), data do contato (default: agora), próximo contato (opcional)
- Próximo contato vencido aparece em 🔴 vermelho
- Adição de novo log inline

**CHS Breakdown:**
- Barras de progresso por dimensão
- Label da dimensão WhatsApp: `WhatsApp (x msg/7d)` — contador instantâneo real

**Blocos inferiores:**
- Dados TarefaApp: tarefas totais, tarefas 7d, membros, grupos, último NPS
- Onboarding: progresso por etapa (5/5) com datas de conclusão

---

### 4.3 Customer Health Score (CHS)

**Fórmula (total 100pts):**

| Dimensão | Peso | Critério |
|----------|------|----------|
| Onboarding | 25pts | 5pts por etapa concluída (1–5) |
| Uso Recente | 25pts | Tarefas criadas nos últimos 7d (≥10 = máx, escala linear) |
| Pagamento | 15pts | 15 se `status = active`, 0 caso contrário |
| WhatsApp Engagement | 15pts | ≥5 msgs/7d = 15pts · 1–4 msgs/7d = 8pts · 0 = 0pts |
| Lifetime | 20pts | 5pts ≥1m · 10pts ≥3m · 15pts ≥7m · 20pts ≥13m |

**Labels:**
- ≤40: 🔴 crítico
- 41–70: 🟡 atenção
- ≥71: 🟢 saudável

**Label WhatsApp na ficha:** `WhatsApp (x msg/7d)` onde x é o valor real de `message_logs` dos últimos 7 dias — atualizado a cada carregamento da página (sem cache de snapshot).

**Etapas de onboarding (detecção ao vivo):**
1. Workspace criado (sempre true)
2. ≥1 membro ativo com `whatsapp_jid` (exceto admin)
3. ≥1 tarefa criada
4. ≥1 grupo com `whatsapp_group` vinculado
5. ≥5 tarefas criadas

---

### 4.4 CRM Logs

**Tabela:** `crm_logs`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| type | text | reuniao, email, whatsapp, ligacao, anotacao |
| channel | text | whatsapp, email, call, presencial |
| note | text | Anotação livre |
| author | text | Nome do CS responsável (read-only, do usuário logado) |
| contact_at | timestamptz | Data/hora do contato realizado (default: agora) |
| next_contact_at | timestamptz | Próximo agendamento (opcional) |
| created_at | timestamptz | Registro |

---

## 5. Fora do Escopo (MVP)

- Automação de e-mails de CS
- Integração direta com Celcoin para cobrança manual
- Métricas de uso por feature
- Exportação de relatórios CSV/PDF

---

## 6. Roadmap

| Feature | Prioridade | Status |
|---------|-----------|--------|
| NPS por workspace (envio automático) | Média | Backlog |
| Alertas automáticos por CHS baixo | Alta | Backlog |
| Integração Slack/Discord para CS | Baixa | Backlog |
| Segmentação por cohort | Média | Backlog |
| Histórico de status de assinatura | Média | Backlog |
