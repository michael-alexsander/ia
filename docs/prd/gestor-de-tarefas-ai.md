# PRD — Gestor de Tarefas e Equipes AI
**Produto:** MelhorAgencia.ai
**Agente:** TarefaApp — Gestor de Tarefas e Equipes
**Versão:** 2.2
**Data:** 2026-03-24
**Status:** MVP em produção — https://app.tarefa.app

---

## 1. Visão Geral

O **TarefaApp** é o primeiro agente da plataforma MelhorAgencia.ai. Opera via **WhatsApp** (Evolution API) como canal principal de interação diária, complementado por uma **interface web** para gestão estruturada, visualização e configuração.

É a evolução do Tarefa.app: em vez de um bot com comandos rígidos, é um agente com inteligência contextual (gpt-4o-mini), comportamento proativo via cron jobs, e uma camada visual para o que o WhatsApp não resolve bem.

---

## 2. Problema que Resolve

> *"A experiência de criar, editar e concluir uma tarefa deve ser simples para o funcionário, e eu, como administrador, preciso mensurar a produtividade diária, semanal e mensal de todo o time."*

Gestores saem do WhatsApp para registrar e cobrar tarefas → perda de contexto, tarefas esquecidas, zero visibilidade de produtividade.

---

## 3. Personas

### 3.1 Admin (Gestor)
- Cria tarefas para si e para qualquer membro do time
- Acompanha produtividade individual e coletiva
- Recebe relatórios automáticos diários, semanais e mensais
- Convida membros para o workspace
- Configura horários de relatórios e lembretes
- Acessa tudo via interface web ou WhatsApp

### 3.2 Colaborador
- Recebe tarefas atribuídas ou cria as próprias
- Atualiza status (concluir, editar)
- Interage com o agente via linguagem natural (grupo ou privado)
- Acessa interface web para visualizar e gerenciar suas tarefas

---

## 4. Canais de Interação

| Canal | Quem usa | Como acionar |
|---|---|---|
| Grupo WhatsApp da empresa | Admin + Colaboradores | Mencionar `@TarefaApp` |
| Chat privado com o bot | Admin + Colaboradores | Mensagem direta |
| Interface web (dashboard) | Admin + Colaboradores | app.tarefa.app |

---

## 5. Interface Web — Implementada

**Stack:** Next.js 16 (App Router) + Supabase + Tailwind CSS 4 + React 19
**Auth:** Google OAuth · Email + Senha · Magic Link por e-mail
**Deploy:** Vercel → app.tarefa.app
**Layout:** Sidebar colapsável (desktop) + drawer mobile + responsivo
**Middleware:** `src/proxy.ts` (alias Next.js 16 para `middleware.ts`) — protege rotas, libera `/api/webhooks/`

### 5.1 Páginas

#### `/login`
- Card com logo TarefaApp em header verde
- 3 opções: Google OAuth, Email+Senha, Magic Link
- Logo exibida com container `rgba(255,255,255,0.18)` para visibilidade sobre fundo verde

#### `/onboarding`
- Criação de workspace (empresa) no primeiro login
- Membros convidados pulam esta etapa automaticamente (auto-link por email)

#### `/tasks` — Tarefas ✅
- **Toolbar linha 1 (topo-direita):** Relatório PDF + Nova Tarefa
- **Toolbar linha 2 (filtros):** Busca (ID/Título) | Responsável | Grupo | Prazo (de–até) | Status | Limpar
- Filtro padrão: tarefas do usuário logado
- Paginação: 10 tarefas/página com navegação (‹ Anterior / Próxima › + números)
- Colunas: ID · Título · Responsável · Grupo · Prazo · Status · Ações
- Status inline editável: `Aberta` · `Andamento` · `Concluída`
- Highlight visual: vermelho = vencida, amarelo = vence hoje
- Modal criar/editar: título, descrição, responsável, grupo, prazo (data + hora)
- Relatório PDF: jsPDF + autoTable — download local + envio WhatsApp e/ou email
  - Logo via primitivas gráficas (quadrado verde + círculo branco)
  - `pdfSafe()` remove emojis/surrogates para compatibilidade Helvetica
  - Links clicáveis no rodapé (app.tarefa.app + WhatsApp)

#### `/members` — Membros ✅
- Lista: avatar, nome (ícone coroa para admin), contato, função, status
- Convidar membro: DDI +55 fixo + número DDD+tel + email opcional
- Envio automático: código 6-chars por WhatsApp + email (Resend)
- Editar / Remover membros
- Bloqueia convite quando limite do plano atingido → exibe `UpgradeModal`

#### `/groups` — Grupos ✅
- CRUD de grupos + associação de membros
- Código `LINK-XXXXX` para vincular ao grupo do WhatsApp
- Bloqueia criação quando limite do plano atingido → exibe `UpgradeModal`

#### `/settings` — Configurações ✅
- Horário relatório manhã / noite (por workspace)
- `reminder_hours_before`: X horas antes do prazo para lembrete

#### Workspace suspenso
- `DashboardShell` exibe `SuspendedOverlay` (tela cheia, não contornável)
- Admin vê preço + link de renovação
- Membros veem contato do admin

---

## 6. Agent WhatsApp — Implementado

### 6.1 Comandos (linguagem natural via gpt-4o-mini)

| Intent | Exemplo |
|---|---|
| `criar_tarefa` | "cria uma tarefa pro Luiz entregar o layout até sexta" |
| `listar_tarefas` | "quais tarefas abertas do Luiz?" |
| `atualizar_tarefa` | "muda o prazo da AB123 para segunda" |
| `concluir_tarefa` | "conclui a AB123" |
| `ajuda` | "ajuda" |

**Comportamentos importantes:**
- **Prazo automático:** ao criar tarefa sem data informada, `due_date` é preenchida automaticamente com a data de hoje. A confirmação mostra o prazo com `(hoje)` quando auto-preenchido.
- **Responsável automático:** ao criar sem informar responsável, assume o usuário que enviou a mensagem.
- **Filtros de listagem:** `listar tarefas do Luiz` filtra por `assignee_id` via busca por nome parcial (`ILIKE`). `listar minhas tarefas` filtra pelo próprio usuário.

### 6.2 Identificação de usuários
- Membro identificado por `whatsapp_jid` (LID interno da Evolution API)
- Em grupos: bot identificado por `BOT_LID` (não pelo número de telefone)
- Privado e grupo suportados
- Cada interação é registrada em `message_logs` para o CHS WhatsApp Engagement

### 6.3 Fluxo de ativação de membro
1. Admin convida via web → código 6-chars enviado por WhatsApp + email
2. Convidado envia código no chat com o bot
3. Bot ativa o membro e responde com confirmação + link app.tarefa.app/login

### 6.4 Vinculação de grupo WhatsApp
- Admin copia código `LINK-XXXXX` do grupo no app web
- Envia o código no grupo do WhatsApp com o bot adicionado
- Bot detecta, vincula o grupo e confirma

### 6.5 Relatórios automáticos (cron)

| Relatório | Frequência | Conteúdo |
|---|---|---|
| Diário manhã | Configurável (padrão 08h BRT) | Vencidas + vence hoje + vence em 2 dias |
| Diário noite | Configurável (padrão 18h BRT) | Concluídas hoje + abertas |
| Semanal | Segunda 08h BRT | Produtividade da semana |
| Mensal | Dia 1 às 08h BRT | Ranking de produtividade do mês |
| Lembretes | A cada 30min | X horas antes do prazo (configurável) |
| Suspensão | Diário 09h BRT | Notifica admins de workspaces suspensos |

Todos os relatórios incluem link `https://api.whatsapp.com/send?phone=5531989507577&text=Quero%20criar%20tarefa%2C%20como%20funciona%3F` para facilitar criação de tarefas.

### 6.6 Entidades extraídas pelo parser
`titulo`, `responsavel`, `prazo`, `hora`, `grupo`, `task_id`, `status_filtro`, `novo_titulo`, `novo_prazo`, `nova_hora`, `novo_responsavel`, `novo_status`

> `responsavel` é extraído tanto para criação (define assignee) quanto para listagem (filtra por assignee).

---

## 7. Modelo de Negócio — Celcoin (Implementado)

### 7.1 Planos

| Plano  | Preço     | Grupos | Membros | Tarefas    |
|--------|-----------|--------|---------|------------|
| Small  | R$37/mês  | 3      | 10      | Ilimitadas |
| Medium | R$79/mês  | 10     | 30      | Ilimitadas |
| Large  | R$139/mês | ∞      | ∞       | Ilimitadas |

### 7.2 Checkout
- Landing pages Celcoin: `celcash.celcoin.com.br/landingpage7350005/tarefa-app/`
- Planos: `/comprar/plano-small/70`, `/plano-medium/71`, `/plano-large/72`

### 7.3 Webhook Celcoin → TarefaApp
- Endpoint: `POST https://app.tarefa.app/api/webhooks/celcoin`
- Autenticação: token no body (`body.token`) verificado contra `CELCOIN_WEBHOOK_SECRET`
- **Ativação:** `subscription.addTransaction` (captured) → workspace `active` + envia boas-vindas
- **Suspensão:** subscription `canceled`/`closed` → workspace `suspended` + WhatsApp para admin
- **Novo cliente:** envia email de boas-vindas (Resend) + WhatsApp de boas-vindas com próximos passos
- Configurado em: painel Celcoin → Módulos → Webservice → Configurar módulo

### 7.4 Limites de plano
- `createGroup` e `inviteMember` verificam limite antes de criar
- Retorna `{ limitReached: true, plan, upgradeUrl }` quando excedido
- UI exibe `UpgradeModal` com planos superiores e links de checkout

### 7.5 Workspace suspenso
- `workspaces.status = 'suspended'` bloqueia acesso no web app via `SuspendedOverlay`
- Cron diário 09h BRT renotifica admins de workspaces suspensos por WhatsApp

---

## 8. Links WhatsApp

- **Formato padrão:** `https://api.whatsapp.com/send?phone=5531989507577&text=Quero%20criar%20tarefa%2C%20como%20funciona%3F`
- Usado em: emails (welcome + report), PDF, caption WA, mensagem de boas-vindas Celcoin, cron reports
- Motivo: `api.whatsapp.com/send` garante texto pré-preenchido consistente em todos os clientes (mobile, desktop, web), ao contrário de `wa.me` que pode não pré-preencher quando acessado de dentro do WhatsApp

---

## 9. Critério de Sucesso — 30 dias
1.200 tarefas criadas com 12 usuários ativos

---

## 10. Roadmap Pós-MVP

| Feature | Status |
|---|---|
| Logo no PDF e nos emails | ✅ Feito (primitivas gráficas jsPDF) |
| Notificação ao responsável quando tarefa criada para ele | Backlog |
| Hard delete de membro (limpar assignee_id + deletar) | Backlog |
| Conectar Vercel ao GitHub para CI/CD automático | Backlog |
| Tarefas recorrentes (diária/semanal/mensal) | Backlog |
| Sistema de pontuação + gamificação semanal | Backlog |
| Google Calendar: tarefas com prazo viram eventos | Backlog |
