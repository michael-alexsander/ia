# Arquitetura Técnica — TarefaApp (Gestor de Tarefas e Equipes AI)
**Produto:** MelhorAgencia.ai
**Versão:** 2.2
**Data:** 2026-03-24

---

## 1. Visão Geral

```
┌──────────────────────────────────────────────────────────────┐
│                      USUÁRIO FINAL                           │
│           WhatsApp (grupo ou privado)                        │
└───────────────────────┬──────────────────────────────────────┘
                        │ mensagem
                        ▼
┌──────────────────────────────────────────────────────────────┐
│            VPS DIGITAL OCEAN (198.211.112.153)               │
│                                                              │
│  ┌─────────────────┐     ┌─────────────────────────────────┐ │
│  │  Evolution API  │────▶│       Agent Server               │ │
│  │  v2.3.6 :8080   │◀────│  Node.js 20 + TypeScript         │ │
│  │  inst: tarefaapp│     │  Express :3001                   │ │
│  └─────────────────┘     │  PM2: tarefaapp-agent            │ │
│                          │                                  │ │
│                          │  webhook.ts  → parser.ts         │ │
│                          │  handlers/   → cron.ts           │ │
│                          └──────────────┬───────────────────┘ │
└─────────────────────────────────────────┼────────────────────┘
                                          │ queries/mutations
                        ┌─────────────────▼──────────────────┐
                        │            SUPABASE                 │
                        │  PostgreSQL + Auth + Storage        │
                        │  (service role key — sem RLS)       │
                        └─────────────────┬──────────────────┘
                                          │
                        ┌─────────────────▼──────────────────┐
                        │             VERCEL                  │
                        │   Next.js 16 App Router             │
                        │   app.tarefa.app                    │
                        └────────────────────────────────────┘
                                          ▲
                                          │ webhook POST
                        ┌─────────────────┴──────────────────┐
                        │         CELCOIN cel_payments        │
                        │  Checkout → webhook → ativa/suspende│
                        └────────────────────────────────────┘
```

**Serviços externos:**
- **OpenAI gpt-4o-mini** — NLP/parser de intents
- **Resend** — emails transacionais (sender: `contato@melhoragencia.ai`)
- **Celcoin cel_payments** — checkout + webhooks de assinatura

---

## 2. Schema do Banco de Dados (Supabase)

> Todas as queries usam `service_role_key` (admin client) para bypass de RLS.

### `workspaces`
```sql
id            uuid PK DEFAULT gen_random_uuid()
name          text NOT NULL
slug          text UNIQUE NOT NULL
plan          text DEFAULT 'small' CHECK (plan IN ('small','medium','large'))
status        text DEFAULT 'active' CHECK (status IN ('active','inactive','suspended'))
celcoin_id    text    -- subscription ID da Celcoin para lookup em webhooks
config        jsonb DEFAULT '{}'
created_at    timestamptz DEFAULT now()
updated_at    timestamptz DEFAULT now()
```

### `members`
```sql
id              uuid PK
workspace_id    uuid REFERENCES workspaces ON DELETE CASCADE
user_id         uuid REFERENCES auth.users ON DELETE CASCADE  -- NULL até login web
name            text NOT NULL
email           text
whatsapp        text    -- número real (+5531XXXXXXXXX) — visível no web
whatsapp_jid    text    -- LID/JID interno Evolution API — usado pelo agent
role            text DEFAULT 'member' CHECK (role IN ('admin','member'))
status          text DEFAULT 'active' CHECK (status IN ('active','inactive','invited'))
avatar_url      text
created_at      timestamptz DEFAULT now()
UNIQUE (workspace_id, user_id)
UNIQUE (workspace_id, whatsapp)
```

> **whatsapp vs whatsapp_jid:** `whatsapp` é o número real informado pelo admin (visível). `whatsapp_jid` é o LID retornado pela Evolution API ao ativar o membro via bot. Necessário porque WhatsApp usa LIDs em grupos que diferem do número real.

### `groups`
```sql
id              uuid PK
workspace_id    uuid REFERENCES workspaces ON DELETE CASCADE
name            text NOT NULL
description     text
whatsapp_group  text    -- JID do grupo no WhatsApp
link_code       text UNIQUE    -- código LINK-XXXXX para vinculação
linked_at       timestamptz    -- quando foi vinculado
created_at      timestamptz DEFAULT now()
```

### `group_members`
```sql
id          uuid PK
group_id    uuid REFERENCES groups ON DELETE CASCADE
member_id   uuid REFERENCES members ON DELETE CASCADE
UNIQUE (group_id, member_id)
```

### `tasks`
```sql
id              uuid PK
task_id         text UNIQUE NOT NULL    -- 5-chars alfanumérico ex: AB12C
workspace_id    uuid REFERENCES workspaces ON DELETE CASCADE
group_id        uuid REFERENCES groups ON DELETE SET NULL
title           text NOT NULL
description     text
assignee_id     uuid REFERENCES members ON DELETE SET NULL
created_by      uuid REFERENCES members ON DELETE SET NULL
status          text DEFAULT 'open' CHECK (status IN ('open','in_progress','done'))
due_date        timestamptz
due_time        time    -- hora específica para lembretes
reminded_at     timestamptz    -- evita lembrete duplicado
recurrence      text DEFAULT 'none' CHECK (recurrence IN ('none','daily','weekly','monthly'))
overdue_alerted boolean DEFAULT false
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

> **due_date:** ao criar via bot sem informar data, preenchida automaticamente com a data de hoje (`new Date().toISOString().split('T')[0]`). Display usa `.split('T')[0] + 'T12:00:00'` para evitar problema de fuso UTC.

### `task_history`
```sql
id          uuid PK
task_id     uuid REFERENCES tasks ON DELETE CASCADE
member_id   uuid REFERENCES members ON DELETE SET NULL
field       text NOT NULL
old_value   text
new_value   text
created_at  timestamptz DEFAULT now()
```

### `agent_config`
```sql
id                    uuid PK
workspace_id          uuid REFERENCES workspaces UNIQUE
report_daily          boolean DEFAULT true
report_weekly         boolean DEFAULT true
report_monthly        boolean DEFAULT true
report_channel        text DEFAULT 'whatsapp' CHECK (report_channel IN ('whatsapp','email','both'))
report_morning_time   time DEFAULT '08:00'
report_evening_time   time DEFAULT '18:00'
reminder_hours_before int DEFAULT 24    -- X horas antes do due_time para lembrete
alert_overdue_next_day boolean DEFAULT true
created_at            timestamptz DEFAULT now()
updated_at            timestamptz DEFAULT now()
```

### `invites`
```sql
id              uuid PK
workspace_id    uuid REFERENCES workspaces ON DELETE CASCADE
email           text
whatsapp        text
token           text UNIQUE NOT NULL    -- 6-chars alfanumérico ex: AB12CD
role            text DEFAULT 'member'
accepted        boolean DEFAULT false
expires_at      timestamptz DEFAULT now() + interval '7 days'
created_at      timestamptz DEFAULT now()
```

### `message_logs`
```sql
id           uuid PK DEFAULT gen_random_uuid()
workspace_id uuid REFERENCES workspaces ON DELETE CASCADE
member_id    uuid REFERENCES members ON DELETE SET NULL
source       text NOT NULL CHECK (source IN ('private', 'group'))
intent       text    -- intent reconhecido pelo parser (ex: criar_tarefa, ajuda)
created_at   timestamptz DEFAULT now()
INDEX ON message_logs(workspace_id, created_at DESC)
```

> Populada pelo bot a cada interação recebida (privado ou menção em grupo). Usada pelo admin (CHS WhatsApp Engagement) para medir engajamento real com o agente.

### `crm_logs` (admin ERP/CSM)
```sql
id               uuid PK
workspace_id     uuid REFERENCES workspaces ON DELETE CASCADE
type             text    -- reuniao, email, whatsapp, ligacao, anotacao
channel          text    -- whatsapp, email, call, presencial
note             text
author           text
contact_at       timestamptz
next_contact_at  timestamptz
created_at       timestamptz DEFAULT now()
```

---

## 3. Agent Server — Estrutura de Arquivos

```
/opt/tarefaapp/
├── src/
│   ├── index.ts          # Express entry point, inicializa cron
│   ├── webhook.ts        # Recebe eventos Evolution API, identifica membro, roteia
│   │                     # Registra message_logs com async IIFE (fire-and-forget)
│   ├── parser.ts         # NLP via gpt-4o-mini — extrai intent + entities
│   │                     # responsavel extraído para criar E para filtrar listar
│   ├── types.ts          # ParsedIntent, MsgContext, entities
│   ├── evolution.ts      # sendText(), sendMedia() helpers
│   ├── supabase.ts       # createClient() admin
│   ├── cron.ts           # node-cron — relatórios + lembretes + notif. suspensão
│   │                     # Todos os relatórios incluem link api.whatsapp.com/send
│   └── handlers/
│       ├── index.ts      # tryLinkByCode, tryLinkGroup, handleIntent
│       └── tasks.ts      # criarTarefa, listarTarefas, concluirTarefa, atualizarTarefa
│                         # due_date auto-preenchida com hoje se não informada
│                         # listarTarefas: filtra por responsavel (ILIKE nome)
├── .env                  # variáveis de ambiente
├── package.json
└── tsconfig.json
```

---

## 4. Web App — Estrutura (Next.js App Router)

```
C:\ia\src\
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx        # Auth check + DashboardShell (passa plan/status/role)
│   │   ├── tasks/page.tsx
│   │   ├── members/page.tsx
│   │   ├── groups/page.tsx
│   │   └── settings/page.tsx
│   ├── api/
│   │   └── webhooks/
│   │       └── celcoin/route.ts  # POST — ativa/suspende workspace + boas-vindas
│   ├── auth/callback/route.ts    # OAuth callback + auto-link membro por email
│   ├── login/page.tsx
│   └── onboarding/page.tsx
├── components/
│   ├── layout/
│   │   ├── DashboardShell.tsx  # Renderiza SuspendedOverlay se status=suspended
│   │   └── Sidebar.tsx         # Versão exibida: TarefaApp v2.2
│   ├── billing/
│   │   ├── UpgradeModal.tsx    # Modal de upgrade quando limite de plano atingido
│   │   └── SuspendedOverlay.tsx # Overlay full-screen para workspace suspenso
│   ├── tasks/TaskList.tsx       # PDF via jsPDF (pdfSafe, logo primitivas, links clicáveis)
│   ├── members/MemberList.tsx   # Detecta limitReached → UpgradeModal
│   ├── groups/GroupList.tsx     # Detecta limitReached → UpgradeModal
│   └── settings/SettingsForm.tsx
├── proxy.ts                     # Middleware Next.js 16 (alias de middleware.ts)
│                                # Protege rotas — libera /invite, /auth, /api/webhooks/
└── lib/
    ├── plans.ts         # PLAN_LIMITS, PLAN_LABELS, PLAN_PRICES, getCheckoutUrl, celcoinPlanToInternal
    ├── actions/
    │   ├── tasks.ts
    │   ├── members.ts   # Verifica limite members antes de criar; WA invite com link app
    │   ├── groups.ts    # Verifica limite groups antes de criar
    │   ├── settings.ts
    │   ├── reports.ts   # PDF + WA caption + email com link api.whatsapp.com/send
    │   └── billing.ts   # getBillingInfo() server action
    ├── email.ts         # sendInviteEmail + sendWelcomeEmail via Resend
    │                    # Footer com link api.whatsapp.com/send?phone=...&text=...
    └── supabase/
        ├── client.ts
        ├── server.ts
        └── admin.ts
```

---

## 5. Fluxos Críticos

### 5.1 Recebimento de mensagem WhatsApp
```
Evolution API → POST /webhook
  → webhook.ts: extrai remoteJid, texto, isGroup
  → findMemberByJid(jid) → membro do workspace
  → Se não encontrado: tryLinkByCode(jid, text) → ativa convite
  → Se grupo: verifica menção @bot via BOT_PHONE ou BOT_LID
  → Se LINK-XXXXX: tryLinkGroup(groupJid, code)
  → parser.ts: gpt-4o-mini → { intent, entities }
  → message_logs INSERT (async IIFE fire-and-forget — não bloqueia resposta)
  → handlers/index.ts: handleIntent → handlers/tasks.ts
  → sendText(remoteJid, resposta)
```

### 5.2 Criação de tarefa via bot
```
criarTarefa(ctx, entities)
  → entities.responsavel? → busca membro por ILIKE → assignee_id
  → else → assignee_id = ctx.memberId (usuário que enviou)
  → entities.grupo? → busca grupo por ILIKE → group_id
  → else if isGroup → usa whatsapp_group do grupo vinculado → group_id
  → due_date = entities.prazo ?? new Date().toISOString().split('T')[0]  ← auto hoje
  → INSERT tasks
  → confirmação com 📅 prazo + "(hoje)" se auto-preenchido
```

### 5.3 Listagem de tarefas com filtros via bot
```
listarTarefas(ctx, entities)
  → status_filtro? → eq('status', ...) else in(['open','in_progress'])
  → entities.responsavel?
    → 'eu'/'mim' → eq('assignee_id', ctx.memberId)
    → nome → SELECT id FROM members WHERE ILIKE '%nome%'
             → in('assignee_id', ids)
  → LIMIT 10, ORDER BY due_date ASC
```

### 5.4 Convite de membro
```
Admin → /members → InviteModal → inviteMember() server action
  → Verifica limite de membros do plano → se excedido: retorna { limitReached }
  → INSERT members (status='invited') + INSERT invites (token 6-chars)
  → Evolution API sendText → WhatsApp com código
  → Resend sendInviteEmail → email com código
  → Convidado envia código no bot
  → tryLinkByCode: UPDATE members (whatsapp_jid, status='active')
  → Convidado acessa web → auth/callback → vincula user_id por email
```

### 5.5 Pagamento Celcoin → Ativação de workspace
```
Cliente compra plano na landing page Celcoin
  → Celcoin: POST https://app.tarefa.app/api/webhooks/celcoin
    body: { token, type, subscription, transaction, Customer }
  → Verifica body.token === CELCOIN_WEBHOOK_SECRET
  → type='subscription.addTransaction' + transaction.status='captured'
  → findWorkspace() por celcoin_id → fallback por Customer.email
  → SE workspace existente: UPDATE workspaces SET status='active', plan=X
  → SE novo cliente:
      → WhatsApp de boas-vindas para Customer.cellphone
      → Email de boas-vindas para Customer.email (Resend)
  → Retorna { received: true }
```

### 5.6 Suspensão de workspace
```
Celcoin: subscription.status = 'canceled' | 'closed'
  → webhook: UPDATE workspaces SET status='suspended'
  → notificarAdminsSuspenso: WhatsApp para admins com link de renovação
  → Cron 09h BRT diário: renotifica admins de workspaces ainda suspensos
  → DashboardShell: renderiza SuspendedOverlay (tela cheia, não contornável)
```

### 5.7 Auth callback (auto-link convidado)
```
Google/email OAuth → /auth/callback?code=XXX
  → exchangeCodeForSession → user.email
  → admin.from('members').eq('email', email).is('user_id', null)
  → Se encontrar: UPDATE members SET user_id=user.id, status='active'
  → redirect('/tasks')  ← pula /onboarding
```

---

## 6. Configurações de Ambiente

### VPS Digital Ocean (198.211.112.153)
- OS: Ubuntu 24.10, Node.js 20, PM2
- Processo `evolution-api` (porta 8080) + `tarefaapp-agent` (porta 3001)
- `/opt/tarefaapp/.env`

**Variáveis VPS:**
```
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
EVOLUTION_URL=http://localhost:8080
EVOLUTION_API_KEY=429683C4C977415CAAFCCE10F7D57E11
EVOLUTION_INSTANCE=tarefaapp
BOT_PHONE=5531989507577
BOT_JID=5531989507577@s.whatsapp.net
BOT_LID=50801628172409
CELCOIN_CHECKOUT_SMALL / MEDIUM / LARGE  (URLs de checkout)
```

### Vercel (app.tarefa.app)
- Next.js 16, Node.js runtime
- Branch: `master` do repo `michael-alexsander/ia`

**Variáveis Vercel:**
```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
EVOLUTION_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE
CELCOIN_CHECKOUT_SMALL / MEDIUM / LARGE
CELCOIN_WEBHOOK_SECRET=a9e9a42c48cb6e9ac0a2590b7a1fd126
```

### Celcoin cel_payments
- Painel: `celcash.celcoin.com.br` → Módulos → Webservice → Configurar módulo
- Galax ID: `37608` | Galax HASH: `Yp9vZvO7WdPzPi7962SuGfZ8MvA0XsVhBfIr9tCb`
- URL Webhook configurada: `https://app.tarefa.app/api/webhooks/celcoin`
- Token de segurança: enviado no `body.token` de cada request

### Resend
- Domínio `melhoragencia.ai` verificado (DKIM + SPF + MX — Hostinger)
- FROM: `TarefaApp <contato@melhoragencia.ai>`
- Usos: convite de membro + relatório PDF + email de boas-vindas

### SSH VPS
- Chave em `~/.ssh/vps_temp`
- `ssh -i ~/.ssh/vps_temp -o StrictHostKeyChecking=no root@198.211.112.153`

---

## 7. Decisões Técnicas

| Decisão | Motivo |
|---|---|
| Admin client (service role) em todas as queries | Evita problemas com RLS self-referencial em members |
| `whatsapp_jid` separado de `whatsapp` | WhatsApp usa LIDs em grupos que diferem do número real |
| `BOT_LID` env var | Bot identificado por LID diferente do número em grupos |
| Hourly cron dispatcher | Permite horários configuráveis por workspace sem N crons fixos |
| `reminded_at` no tasks | Evita lembretes duplicados em janelas de 30min |
| `due_date` split + T12:00:00 | Evita erro de fuso UTC que mostrava dia anterior |
| `due_date` auto-hoje no bot | UX: criar tarefa sem data → prazo = hoje, evita `null` no banco |
| `responsavel` no parser p/ listar | Mesmo campo usado para criar e filtrar; parser ciente do contexto |
| Async IIFE para message_logs | `.catch()` não existe no Supabase JS v2; IIFE garante fire-and-forget sem quebrar o fluxo |
| `proxy.ts` como middleware (Next.js 16) | Next.js 16 aceita `proxy.ts` como alias de `middleware.ts`; `/api/webhooks/` excluído da proteção de auth |
| Token webhook no body (não header) | Celcoin cel_payments envia `body.token` — não usa headers customizados |
| Boas-vindas apenas para novos clientes | Evita spam em renovações; detectado por ausência de workspace com celcoin_id |
| Sem trial gratuito | R$37 é barreira baixa; trial cria complexidade e ghost signups |
| Paginação frontend (não server) | Todos os dados já carregados, filtros reativos sem round-trips |
| `api.whatsapp.com/send` ao invés de `wa.me` | `wa.me?text=` não pré-preenche quando clicado de dentro do WhatsApp; `api.whatsapp.com/send` é consistente em todos os clientes |
| Logo PDF via primitivas gráficas | jsPDF Helvetica não suporta Unicode/emojis; primitivas (quadrado + círculo) são confiáveis |
| `pdfSafe()` no PDF | Remove surrogates/emojis de títulos para evitar texto garbled no PDF |
| `message_logs` separada de `tasks` | Mede engajamento WhatsApp independente de criação de tarefas |
