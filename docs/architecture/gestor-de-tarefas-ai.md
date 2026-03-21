# Arquitetura Técnica — Gestor de Tarefas e Equipes AI
**Produto:** MelhorAgencia.ai
**Versão:** 1.1
**Data:** 2026-03-21

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
│              VPS DIGITAL OCEAN (198.211.112.153)                │
│                                                                 │
│  ┌─────────────────┐      ┌──────────────────────────────────┐  │
│  │  Evolution API  │─────▶│        Agent Server              │  │
│  │  v2.3.6 :8080   │◀─────│  Node.js 20 + TypeScript         │  │
│  │  inst: tarefaapp│      │  Express :3001                   │  │
│  └─────────────────┘      │  PM2: tarefaapp-agent            │  │
│                           │                                  │  │
│                           │  • Webhook receiver              │  │
│                           │  • Message router                │  │
│                           │  • NLP parser (OpenAI)           │  │
│                           │  • Business logic                │  │
│                           │  • Notification dispatcher       │  │
│                           │  • Cron scheduler (a implementar)│  │
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

**Estado atual:** 9 tabelas + coluna `whatsapp_jid` adicionada à tabela `members` (migration 004).
**Workspace de produção:** `931eb2a6-ca77-4466-9a74-2135f8882130`

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
whatsapp        text                        -- número real com DDI, ex: +5531XXXXXXXXX (visível no app web)
whatsapp_jid    text                        -- JID/LID interno da Evolution API (usado pelo agent)
role            text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member'))
status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited'))
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()

UNIQUE (workspace_id, user_id)
UNIQUE (workspace_id, whatsapp)
```

> **Decisão de arquitetura — whatsapp vs whatsapp_jid:** O campo `whatsapp` armazena o número real (+5531XXXXXXXXX) que o admin informa ao convidar um membro — é o que aparece na interface web para humanos. O campo `whatsapp_jid` armazena o identificador retornado pela Evolution API no momento em que o membro completa o onboarding via WhatsApp. Essa separação é necessária porque o WhatsApp usa LIDs (Linked Identifiers) em versões novas que não correspondem ao número real. O agent server usa `whatsapp_jid` para identificar remetentes de mensagens. Migration aplicada: `004_add_whatsapp_jid.sql`.

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

> **Nota sobre datas:** Todas as formatações de `due_date` usam `.split('T')[0] + 'T12:00:00'` para evitar problemas de fuso UTC que causavam exibição do dia anterior na interface.

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
token           text UNIQUE NOT NULL       -- código de 6 chars alfanumérico (ex: AB12CD)
role            text DEFAULT 'member' CHECK (role IN ('admin', 'member'))
accepted        boolean DEFAULT false
expires_at      timestamptz DEFAULT now() + interval '7 days'
created_at      timestamptz DEFAULT now()
```

> O campo `token` é um código de 6 caracteres alfanumérico (ex: `AB12CD`) enviado via WhatsApp ao número informado pelo admin. O membro envia esse código para o bot para concluir o onboarding. Ao aceitar, o sistema grava o `whatsapp_jid` real no campo correspondente em `members` e ativa o `status` para `'active'`.

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
2. Evolution API dispara POST para: http://localhost:3001/webhook (evento: MESSAGES_UPSERT)
3. Webhook receiver valida o payload e extrai:
   - JID do remetente (remoteJid ou sender — pode ser LID em versões novas)
   - Texto da mensagem
   - ID do grupo (se for mensagem de grupo)
   - Menção ao bot (se grupo)
4. Message router identifica:
   - Qual workspace pertence esse JID (busca por whatsapp_jid em members)
   - Qual membro é esse JID
   - Se é grupo ou privado
   - Se o bot foi mencionado (grupo) ou mensagem direta (privado)
5. NLP Parser processa a mensagem (OpenAI gpt-4o-mini)
6. Business logic executa a ação
7. Resposta enviada via Evolution API
```

### 4.1 Payload do Webhook (Evolution API v2.3.6)
```json
{
  "event": "MESSAGES_UPSERT",
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

> **Atenção:** Em versões novas do WhatsApp com LID ativo, o `remoteJid` pode retornar um identificador do formato `XXXXXXXXXX@lid` em vez do número real. O campo `whatsapp_jid` em `members` armazena exatamente esse valor para comparação.

---

## 5. NLP Parser — Processamento de Linguagem Natural

O parser usa o `gpt-4o-mini` para extrair intenção e entidades das mensagens.

**Intents implementados:**
- `criar_tarefa`
- `listar_tarefas`
- `concluir_tarefa`
- `atualizar_tarefa`
- `ajuda`
- `desconhecido`

### 5.1 Estrutura do prompt do sistema
```
Você é o Gestor de Tarefas AI da empresa {workspace.name}.
Membros da equipe: {lista de membros com nomes e apelidos}
Data e hora atual: {datetime}

Responda sempre em JSON com o seguinte schema:
{
  "intent": "criar_tarefa | listar_tarefas | concluir_tarefa | atualizar_tarefa | ajuda | desconhecido",
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
mensagem → parser → intent: "criar_tarefa"
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

## 6. Agent Server (VPS Digital Ocean — implementado)

**Localização no servidor:** `/opt/tarefaapp/`
**Processo PM2:** `tarefaapp-agent`
**Porta:** `3001`
**Stack:** Node.js 20 + TypeScript + tsx + Express

### 6.1 Estrutura de arquivos atual
```
/opt/tarefaapp/
├── src/
│   ├── index.ts          # entry point, inicia Express na porta 3001
│   ├── webhook.ts        # recebe e valida payload da Evolution API (MESSAGES_UPSERT)
│   ├── parser.ts         # chamada ao OpenAI gpt-4o-mini, extração de intenção/entidades
│   ├── evolution.ts      # cliente Evolution API (envio de mensagens)
│   ├── supabase.ts       # cliente Supabase (service role)
│   ├── types.ts          # tipos TypeScript compartilhados
│   └── handlers/
│       ├── index.ts      # roteamento de intents para handlers
│       └── tasks.ts      # handlers: criar_tarefa, listar_tarefas, concluir_tarefa, atualizar_tarefa
├── .env
├── package.json
└── tsconfig.json
```

### 6.2 Estrutura planejada (expansão futura)
```
src/
├── router/
│   └── message-router.ts     # identifica workspace, membro, contexto
├── notifications/
│   └── dispatcher.ts         # envia mensagens via Evolution API
├── scheduler/
│   └── cron.ts               # cron jobs para relatórios e lembretes
└── utils/
    ├── task-id.ts            # geração de ID alfanumérico
    ├── date-parser.ts        # normalização de datas em pt-BR
    └── formatter.ts          # formata mensagens WhatsApp
```

---

## 7. Evolution API (implementado)

| Propriedade | Valor |
|---|---|
| Versão | 2.3.6 |
| Porta | 8080 |
| Instância | `tarefaapp` |
| Número WhatsApp | +55 31 8950-7577 |
| Gerenciador | PM2 (mesmo VPS) |
| Webhook URL | `http://localhost:3001/webhook` |
| Evento configurado | `MESSAGES_UPSERT` |

O bot responde a:
- **DMs diretos** — qualquer mensagem enviada ao número do bot
- **Menções @ em grupos** — mensagens que mencionam o bot em grupos configurados

---

## 8. Fluxo de Onboarding de Membros via WhatsApp (implementado)

```
1. Admin em /members → "Convidar membro"
   → Preenche nome + número real (+5531XXXXXXXXX)

2. Sistema gera código de 6 chars (ex: AB12CD)
   → Armazena em tabela `invites` com expires_at = now() + 7 days
   → Envia o código via WhatsApp para o número informado

3. Membro recebe: "Seu código de acesso ao TarefaApp: AB12CD
   Envie este código para este número para ativar sua conta."

4. Membro envia o código para o bot TarefaApp

5. Bot:
   → Busca invite válido pelo token (não expirado, não aceito)
   → Grava whatsapp_jid real do remetente no campo members.whatsapp_jid
   → Atualiza members.status para 'active'
   → Marca invite como aceito
   → Responde: "Conta ativada! Você já pode criar e gerenciar tarefas."
```

---

## 9. Cron Jobs — Relatórios e Lembretes (a implementar)

Todos os cron jobs rodarão no Agent Server via `node-cron`.

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

> Todos os cron jobs respeitarão as configurações por workspace definidas em `agent_config`.

---

## 10. Estrutura do Frontend (Vercel / Next.js)

```
web/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx        # Google OAuth + Email/Senha + Magic Link
│   ├── (dashboard)/
│   │   ├── layout.tsx            # sidebar + header
│   │   ├── tasks/page.tsx        # lista de tarefas com filtros
│   │   ├── members/page.tsx      # CRUD de membros + convites via WhatsApp
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

## 11. Variáveis de Ambiente

### Agent Server (VPS Digital Ocean — `.env`)
```env
PORT=3001
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=tarefaapp
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

## 12. Limites por Plano (enforcement no backend)

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

## 13. Segurança e Isolamento Multi-tenant

- Todas as tabelas têm `workspace_id` — nunca uma query sem esse filtro
- **Row Level Security (RLS)** habilitado no Supabase em todas as tabelas
- Token JWT do Supabase carrega o `workspace_id` do usuário autenticado
- Webhook da Evolution API validado por `WEBHOOK_SECRET` em cada request
- Variáveis sensíveis nunca no repositório — apenas em `.env` e Vercel env vars

---

## 14. Decisões de Arquitetura Registradas

| Data | Decisão | Motivo |
|---|---|---|
| 2026-03-21 | Separação `whatsapp` / `whatsapp_jid` em `members` | WhatsApp usa LIDs em versões novas que não correspondem ao número real. Número real (+5531...) é para humanos no app web; JID/LID é para o agent identificar remetentes. Migration 004 aplicada. |
| 2026-03-21 | Convite via código de 6 chars (não link) | Mais simples de digitar no WhatsApp; evita problemas com links em grupos |
| 2026-03-21 | Due date formatada com `.split('T')[0] + 'T12:00:00'` | Evita bug de UTC que exibia dia anterior na interface web |
| 2026-03-21 | Evolution API na porta 8080, Agent Server na porta 3001, webhook via localhost | Ambos no mesmo VPS; comunicação interna sem exposição pública do webhook |
| 2026-03-21 | Migração de VPS Hostinger para VPS Digital Ocean | Ambiente de produção atual: 198.211.112.153 |

---

## 15. Próximos Passos (ordem de execução)

- [x] Configurar Supabase: criar projeto, rodar migrations, habilitar RLS
- [x] Configurar Evolution API no VPS Digital Ocean
- [x] Scaffold do Agent Server (Node.js + TypeScript)
- [x] Implementar webhook receiver + message router
- [x] Implementar NLP parser (OpenAI gpt-4o-mini)
- [x] Implementar handlers de tarefa (CRUD básico)
- [x] Implementar fluxo de onboarding via código de convite WhatsApp
- [ ] Implementar cron jobs (relatórios automáticos e lembretes de prazo)
- [ ] Scaffold do frontend Next.js (em andamento)
- [x] Implementar autenticação (Google OAuth + Email + Magic Link)
- [ ] Implementar páginas: Tasks, Members, Groups, Settings
- [ ] Implementar geração de PDF
- [ ] Integrar Celcoin API
- [ ] Deploy em produção (domínio final)
- [ ] Testes internos com o time
