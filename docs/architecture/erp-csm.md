# Arquitetura — ERP / CSM Admin (admin.melhoragencia.ai)

**Versão:** 1.0
**Data:** 2026-03-23

---

## 1. Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 15 (App Router, RSC) |
| Linguagem | TypeScript |
| UI | Tailwind CSS + componentes custom (dark mode, CSS vars) |
| Banco | Supabase (PostgreSQL) — mesmo projeto do TarefaApp (`ia`) |
| Auth | Supabase Auth (email/senha, acesso restrito) |
| Deploy | Vercel (auto-deploy via GitHub, branch `main`) |
| Domínio | admin.melhoragencia.ai |

---

## 2. Estrutura de Diretórios

```
C:/admin/src/
├── app/
│   ├── dashboard/
│   │   ├── page.tsx                    # Dashboard principal
│   │   └── customers/
│   │       └── [id]/
│   │           └── page.tsx            # Ficha do cliente
│   └── layout.tsx
├── components/
│   ├── dashboard/
│   │   ├── CustomerCRMLogs.tsx         # CRM Logs (client component)
│   │   └── CustomerTable.tsx
│   └── ui/
│       ├── CHSGauge.tsx                # Gauge visual do CHS
│       └── Badge.tsx
└── lib/
    ├── metrics.ts                      # calculateCHS, calculateMRR, getOnboardingStage
    ├── plans.ts                        # PLAN_PRICES, getPlanLabel
    ├── actions/
    │   └── crm.ts                      # getCRMLogs, addCRMLog, updateCRMLog, getScheduledContacts
    └── supabase/
        ├── admin.ts                    # createAdminClient (service role, sem RLS)
        └── server.ts                   # createClient (usuário autenticado)
```

---

## 3. Banco de Dados (tabelas relevantes)

Todas as tabelas são do projeto Supabase compartilhado com o TarefaApp.

### workspaces
```sql
id, name, slug, plan, status, celcoin_id, created_at, updated_at
```
- `plan`: 'small' | 'medium' | 'large'
- `status`: 'active' | 'trial' | 'suspended' | 'cancelled'

### members
```sql
id, workspace_id, name, email, whatsapp, whatsapp_jid, role, status, avatar_url, created_at
```

### tasks
```sql
id, task_id, workspace_id, title, status, due_date, due_time, assignee_id, group_id, created_at, updated_at
```

### groups
```sql
id, workspace_id, name, whatsapp_group, created_at
```

### crm_logs
```sql
id, workspace_id, type, channel, note, author, contact_at, next_contact_at, created_at
```

### message_logs
```sql
id, workspace_id, member_id, source ('private'|'group'), intent, created_at
```
- Alimentada pelo bot WhatsApp (tarefaapp-agent no VPS)
- Usada para CHS WhatsApp Engagement

### nps_responses
```sql
id, workspace_id, score, comment, answered_at
```

---

## 4. Fluxo de Dados

### CHS Calculation (`lib/metrics.ts`)
```
calculateCHS(workspace)
  ├── getOnboardingStage(workspace.id) → 5 queries paralelas → 25pts
  ├── tasks count (7d) → 1 query → 25pts
  ├── workspace.status → 15pts
  ├── message_logs count (7d) → 1 query → 15pts
  └── months since created_at → 20pts
  → CHSResult { score, breakdown, label, color, meta }
```

### Dashboard Principal
```
/dashboard (RSC)
  ├── calculateMRR() → workspaces.plan where status=active
  ├── calculateChurn() → workspaces count
  ├── calculateAverageNPS() → nps_responses (90d)
  ├── getScheduledContacts() → crm_logs where next_contact_at ≤ now+7d
  └── workspaces.select(*) → para cada: calculateCHS()
```

### Ficha do Cliente
```
/dashboard/customers/[id] (RSC)
  ├── workspaces.select(*).eq('id', id)
  ├── calculateCHS(workspace) → inclui onboarding ao vivo
  ├── getOnboardingStage(id) → stage + completed[]
  ├── getCRMLogs(id) → crm_logs[]
  ├── members count (active)
  ├── tasks count (total + 7d)
  ├── groups count (connected)
  ├── onboarding_events (para datas de conclusão)
  └── nps_responses (último score)
```

---

## 5. Auth / Acesso

- Login via Supabase Auth (email/senha)
- Sem RLS no admin — usa `createAdminClient()` (service role key)
- Acesso restrito ao domínio `admin.melhoragencia.ai`
- Nenhuma proteção por middleware atualmente (todo acesso autenticado via Supabase)

---

## 6. Integrações

### Supabase
- URL: `NEXT_PUBLIC_SUPABASE_URL`
- Anon key: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Service role: `SUPABASE_SERVICE_ROLE_KEY`

### WhatsApp (leitura indireta)
- `message_logs` é populada pelo bot no VPS
- Admin apenas lê os dados para CHS

---

## 7. Deploy

- **Plataforma:** Vercel
- **Branch:** `main` do repositório `admin`
- **Trigger:** push automático
- **URL de produção:** https://admin.melhoragencia.ai

---

## 8. Decisões de Design

| Decisão | Razão |
|---------|-------|
| RSC (React Server Components) para todas as páginas | Zero JS no cliente para leitura, SEO, performance |
| `CustomerCRMLogs` como client component | Precisa de interatividade (add log, formulário) |
| Sem RLS no admin | Simplifica admin total — sem necessidade de contexto de usuário por tabela |
| CHS calculado em runtime | Evita necessidade de tabela de snapshot; sempre atualizado |
| Onboarding via detecção ao vivo | Tabela `onboarding_events` estava vazia; detecção por dados reais é mais confiável |
| `message_logs` separada de `tasks` | Permite medir engajamento WA independente de criação de tarefas |
