# Arquitetura Técnica — Gestor de Tarefas e Equipes AI
**Produto:** MelhorAgencia.ai
**Versão:** 1.0
**Data:** 2026-03-18

---

## 1. Visão Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUÁRIO FINAL                            │
│              WhatsApp (grupo ou privado)                        │
└────────────────────────┬────────────────────────────────────────┘
                         │ mensagem
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   VPS HOSTINGER                                 │
│                                                                 │
│  ┌─────────────────┐      ┌──────────────────────────────────┐  │
│  │  Evolution API  │─────▶│        Agent Server              │  │
│  │  (WhatsApp)     │◀─────│  (Node.js / TypeScript)          │  │
│  └─────────────────┘      │                                  │  │
│                           │  • Webhook receiver              │  │
│                           │  • Message router                │  │
│                           │  • NLP parser (OpenAI)           │  │
│                           │  • Business logic                │  │
│                           │  • Notification dispatcher       │  │
│                           │  • Cron scheduler                │  │
│                           └──────────────┬───────────────────┘  │
│                                          │                      │
│                           ┌──────────────▼───────────────────┐  │
│                           │     n8n (integrações externas)   │  │
│                           │  • Email (Gmail/SMTP)            │  │
│                           │  • Futuras integrações           │  │
│                           └──────────────────────────────────┘  │
└──────────────────────────────────┬──────────────────────────────┘
                                   │ queries / mutations
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SUPABASE                                 │
│         PostgreSQL + pgvector + Auth + Storage                  │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │          VERCEL              │
                    │   Next.js (interface web)    │
                    │   + Edge functions           │
                    └─────────────────────────────┘
```

---

## 2. Schema do Banco de Dados (Supabase)

### 2.1 `workspaces` — empresas clientes
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
name          text NOT NULL
slug          text UNIQUE NOT NULL
plan          text NOT NULL CHECK (plan IN ('small', 'medium', 'large'))
status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended'))
celcoin_id    text                          -- ID da assinatura na Celcoin
config        jsonb DEFAULT '{}'            -- configurações gerais do workspace
created_at    timestamptz DEFAULT now()
updated_at    timestamptz DEFAULT now()
```

### 2.2 `members` — usuários do workspace
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id    uuid REFERENCES workspaces(id) ON DELETE CASCADE
user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE
name            text NOT NULL
email           text
whatsapp        text                        -- número com DDI, ex: 5511999999999
role            text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member'))
status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited'))
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()

UNIQUE (workspace_id, user_id)
UNIQUE (workspace_id, whatsapp)
```

### 2.3 `groups` — grupos do workspace
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id    uuid REFERENCES workspaces(id) ON DELETE CASCADE
name            text NOT NULL
whatsapp_group  text                        -- ID do grupo no WhatsApp
description     text
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

### 2.4 `group_members` — membros por grupo
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
group_id    uuid REFERENCES groups(id) ON DELETE CASCADE
member_id   uuid REFERENCES members(id) ON DELETE CASCADE
created_at  timestamptz DEFAULT now()

UNIQUE (group_id, member_id)
```

### 2.5 `tasks` — tarefas
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
task_id         text UNIQUE NOT NULL        -- código alfanumérico ex: T25A3
workspace_id    uuid REFERENCES workspaces(id) ON DELETE CASCADE
group_id        uuid REFERENCES groups(id) ON DELETE SET NULL
title           text NOT NULL
description     text
assignee_id     uuid REFERENCES members(id) ON DELETE SET NULL
created_by      uuid REFERENCES members(id) ON DELETE SET NULL
status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done'))
due_date        timestamptz
recurrence      text CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly')) DEFAULT 'none'
recurrence_end  timestamptz
overdue_alerted boolean DEFAULT false       -- se já enviou alerta de atraso
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

### 2.6 `task_history` — auditoria de mudanças
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
task_id     uuid REFERENCES tasks(id) ON DELETE CASCADE
member_id   uuid REFERENCES members(id) ON DELETE SET NULL
field       text NOT NULL                  -- campo alterado
old_value   text
new_value   text
created_at  timestamptz DEFAULT now()
```

### 2.7 `agent_config` — configurações por workspace
```sql
id                      uuid PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id            uuid REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE
report_daily            boolean DEFAULT true
report_weekly           boolean DEFAULT true
report_monthly          boolean DEFAULT true
report_channel          text DEFAULT 'whatsapp' CHECK (report_channel IN ('whatsapp', 'email', 'both'))
report_morning_time     time DEFAULT '08:00'
report_evening_time     time DEFAULT '18:00'
reminder_1day           boolean DEFAULT true
reminder_1hour          boolean DEFAULT false
reminder_same_day       boolean DEFAULT true
alert_overdue_next_day  boolean DEFAULT true
created_at              timestamptz DEFAULT now()
updated_at              timestamptz DEFAULT now()
```

### 2.8 `invites` — convites pendentes
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id    uuid REFERENCES workspaces(id) ON DELETE CASCADE
email           text
whatsapp        text
token           text UNIQUE NOT NULL
role            text DEFAULT 'member' CHECK (role IN ('admin', 'member'))
accepted        boolean DEFAULT false
expires_at      timestamptz DEFAULT now() + interval '7 days'
created_at      timestamptz DEFAULT now()
```

### 2.9 `conversation_context` — memória de conversa
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id    uuid REFERENCES workspaces(id) ON DELETE CASCADE
member_id       uuid REFERENCES members(id) ON DELETE CASCADE
context         jsonb DEFAULT '[]'          -- últimas N mensagens
updated_at      timestamptz DEFAULT now()

UNIQUE (workspace_id, member_id)
```

---

## 3. Geração do Task ID

ID alfanumérico de 5 caracteres, único por workspace. Formato: `[A-Z0-9]{5}`.

```typescript
// Exemplos: T25A3, K9BX1, ZM4Q7
function generateTaskId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let id = ''
  for (let i = 0; i < 5; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}

// Verificar unicidade no workspace antes de salvar
async function createUniqueTaskId(workspaceId: string): Promise<string> {
  let id: string
  let exists = true
  while (exists) {
    id = generateTaskId()
    exists = await checkTaskIdExists(workspaceId, id)
  }
  return id
}
```

---

## 4. Fluxo do Webhook WhatsApp → Agente

```
1. Usuário envia mensagem no WhatsApp
2. Evolution API dispara POST para: https://[vps-hostinger]/webhook/whatsapp
3. Webhook receiver valida o payload e extrai:
   - Número do remetente
   - Texto da mensagem
   - ID do grupo (se for mensagem de grupo)
   - Menção ao bot (se grupo)
4. Message router identifica:
   - Qual workspace pertence esse número
   - Qual membro é esse número
   - Se é grupo ou privado
   - Se o bot foi mencionado (grupo) ou mensagem direta (privado)
5. NLP Parser processa a mensagem (OpenAI gpt-4.1-mini)
6. Business logic executa a ação
7. Resposta enviada via Evolution API
```

### 4.1 Payload do Webhook (Evolution API)
```json
{
  "event": "messages.upsert",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "MSG_ID"
    },
    "message": {
      "conversation": "texto da mensagem"
    },
    "pushName": "Nome do Usuário"
  }
}
```

---

## 5. NLP Parser — Processamento de Linguagem Natural

O parser usa o `gpt-4.1-mini` para extrair intenção e entidades das mensagens.

### 5.1 Estrutura do prompt do sistema
```
Você é o Gestor de Tarefas AI da empresa {workspace.name}.
Membros da equipe: {lista de membros com nomes e apelidos}
Data e hora atual: {datetime}

Responda sempre em JSON com o seguinte schema:
{
  "intent": "create_task | update_task | complete_task | delete_task | list_tasks | report | unknown",
  "entities": {
    "task_id": string | null,
    "title": string | null,
    "assignee_name": string | null,
    "due_date": ISO8601 | null,
    "status": "open | in_progress | done" | null,
    "recurrence": "none | daily | weekly | monthly" | null,
    "report_type": "daily | weekly | monthly | custom" | null
  },
  "missing": ["campo1", "campo2"],   // campos obrigatórios não identificados
  "confidence": 0.0-1.0,
  "response_hint": "sugestão de resposta ao usuário"
}
```

### 5.2 Fluxo de criação de tarefa
```
mensagem → parser → intent: "create_task"
  ↓
missing: [] → confirmar e criar
missing: ["assignee"] → perguntar "Para quem é a tarefa?"
missing: ["due_date"] → perguntar "Qual o prazo?"
  ↓
usuário responde → parser com contexto → campos completos
  ↓
confirmar → "Confirma? [título] | [responsável] | [prazo]"
  ↓
"sim" → salvar no Supabase → retornar ID
```

---

## 6. Estrutura do Agent Server (VPS Hostinger)

```
agent-server/
├── src/
│   ├── index.ts                  # entry point, inicia o servidor HTTP
│   ├── webhook/
│   │   └── whatsapp.ts           # recebe e valida payload da Evolution API
│   ├── router/
│   │   └── message-router.ts     # identifica workspace, membro, contexto
│   ├── parser/
│   │   └── nlp-parser.ts         # chamada ao OpenAI, extração de intenção
│   ├── handlers/
│   │   ├── create-task.ts
│   │   ├── update-task.ts
│   │   ├── complete-task.ts
│   │   ├── delete-task.ts
│   │   ├── list-tasks.ts
│   │   └── report.ts
│   ├── notifications/
│   │   └── dispatcher.ts         # envia mensagens via Evolution API
│   ├── scheduler/
│   │   └── cron.ts               # cron jobs para relatórios e lembretes
│   ├── services/
│   │   ├── supabase.ts           # cliente Supabase
│   │   ├── openai.ts             # cliente OpenAI
│   │   └── evolution.ts          # cliente Evolution API
│   └── utils/
│       ├── task-id.ts            # geração de ID alfanumérico
│       ├── date-parser.ts        # normalização de datas em pt-BR
│       └── formatter.ts          # formata mensagens WhatsApp
├── .env
├── package.json
└── tsconfig.json
```

---

## 7. Cron Jobs — Relatórios e Lembretes

Todos os cron jobs rodam no Agent Server via `node-cron`.

| Job | Expressão cron | Ação |
|---|---|---|
| Relatório manhã | `0 8 * * *` | Envia tarefas abertas para admins |
| Relatório noite | `0 18 * * *` | Envia tarefas concluídas no dia |
| Relatório semanal | `0 8 * * 1` | Envia resumo semanal (segunda-feira) |
| Relatório mensal | `0 8 1 * *` | Envia resumo mensal (dia 1) |
| Lembrete 1 dia antes | `0 9 * * *` | Verifica tarefas vencendo amanhã |
| Lembrete 1 hora antes | `0 * * * *` | Verifica tarefas vencendo em 1h |
| Lembrete no dia | `0 8 * * *` | Verifica tarefas vencendo hoje |
| Alerta de atraso | `0 9 * * *` | Verifica tarefas vencidas ontem |
| Tarefas recorrentes | `0 0 * * *` | Cria novas ocorrências de tarefas recorrentes |

> Todos os cron jobs respeitam as configurações por workspace definidas em `agent_config`.

---

## 8. Estrutura do Frontend (Vercel / Next.js)

```
web/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx        # Google OAuth + Email/Senha + Magic Link
│   ├── (dashboard)/
│   │   ├── layout.tsx            # sidebar + header
│   │   ├── tasks/page.tsx        # lista de tarefas com filtros
│   │   ├── members/page.tsx      # CRUD de membros + convites
│   │   ├── groups/page.tsx       # CRUD de grupos
│   │   └── settings/page.tsx     # configurações do workspace
│   └── api/
│       ├── tasks/route.ts        # REST endpoints tarefas
│       ├── members/route.ts
│       ├── groups/route.ts
│       └── reports/pdf/route.ts  # geração de PDF
├── components/
│   ├── tasks/
│   │   ├── TaskList.tsx
│   │   ├── TaskFilters.tsx
│   │   ├── TaskRow.tsx           # com botões Editar/Excluir inline
│   │   └── CreateTaskModal.tsx   # modal único de criação
│   ├── members/
│   ├── groups/
│   └── ui/                       # componentes base (botões, inputs, etc.)
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # cliente browser
│   │   └── server.ts             # cliente server-side
│   └── pdf/
│       └── report-generator.ts   # geração de PDF com filtros
└── styles/
    └── globals.css               # paleta TarefaApp (#128c7e, #00baa5)
```

---

## 9. Variáveis de Ambiente

### Agent Server (VPS Hostinger — `.env`)
```env
PORT=3001
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=
WEBHOOK_SECRET=
```

### Frontend (Vercel — variáveis de ambiente)
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CELCOIN_API_KEY=
CELCOIN_API_URL=
REPORT_WEBHOOK_SECRET=
```

---

## 10. Limites por Plano (enforcement no backend)

```typescript
const PLAN_LIMITS = {
  small:  { groups: 3,         members: 10,        tasks: Infinity },
  medium: { groups: 10,        members: 30,        tasks: Infinity },
  large:  { groups: Infinity,  members: Infinity,  tasks: Infinity },
}

// Verificado antes de criar grupo ou membro
async function checkPlanLimit(workspaceId: string, resource: 'groups' | 'members') {
  const workspace = await getWorkspace(workspaceId)
  const limit = PLAN_LIMITS[workspace.plan][resource]
  const current = await countResource(workspaceId, resource)
  if (current >= limit) throw new PlanLimitError(resource, limit)
}
```

---

## 11. Segurança e Isolamento Multi-tenant

- Todas as tabelas têm `workspace_id` — nunca uma query sem esse filtro
- **Row Level Security (RLS)** habilitado no Supabase em todas as tabelas
- Token JWT do Supabase carrega o `workspace_id` do usuário autenticado
- Webhook da Evolution API validado por `WEBHOOK_SECRET` em cada request
- Variáveis sensíveis nunca no repositório — apenas em `.env` e Vercel env vars

---

## 12. Próximos Passos (ordem de execução)

- [ ] Configurar Supabase: criar projeto, rodar migrations, habilitar RLS
- [ ] Configurar Evolution API no VPS Hostinger
- [ ] Scaffold do Agent Server (Node.js + TypeScript)
- [ ] Implementar webhook receiver + message router
- [ ] Implementar NLP parser (OpenAI)
- [ ] Implementar handlers de tarefa (CRUD)
- [ ] Implementar cron jobs
- [ ] Scaffold do frontend Next.js
- [ ] Implementar autenticação (Google OAuth + Email + Magic Link)
- [ ] Implementar páginas: Tasks, Members, Groups, Settings
- [ ] Implementar geração de PDF
- [ ] Integrar Celcoin API
- [ ] Deploy: Agent Server no Hostinger, Frontend na Vercel
- [ ] Testes internos com o time
