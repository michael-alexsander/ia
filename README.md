# TarefaApp — Gestor de Tarefas e Equipes AI

**Produto:** MelhorAgencia.ai | **Versão:** 2.2 | **Status:** MVP em produção

Web app em Next.js que complementa o agente WhatsApp TarefaApp. Gestão de tarefas via linguagem natural no WhatsApp + interface web para administração.

**URL produção:** https://app.tarefa.app

---

## Stack

- **Framework:** Next.js 16 (App Router, RSC)
- **Auth:** Supabase Auth (Google OAuth + Email + Magic Link)
- **Banco:** Supabase (PostgreSQL) — service role, sem RLS
- **UI:** Tailwind CSS 4 + React 19
- **Email:** Resend (`contato@melhoragencia.ai`)
- **Deploy:** Vercel (branch `master` → auto-deploy)
- **Pagamentos:** Celcoin cel_payments (webhook em `/api/webhooks/celcoin`)

---

## Estrutura de Projetos

| Projeto | URL | Repo | Descrição |
|---------|-----|------|-----------|
| TarefaApp (web) | app.tarefa.app | `ia` | Interface web + webhooks |
| Admin ERP/CSM | admin.melhoragencia.ai | `admin` | Painel CS interno |
| Agent Bot | VPS 198.211.112.153 | `/opt/tarefaapp/` | Bot WhatsApp (Evolution API) |

---

## Desenvolvimento local

```bash
npm install
npm run dev
```

Variáveis de ambiente necessárias (ver `.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
EVOLUTION_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE
CELCOIN_CHECKOUT_SMALL / MEDIUM / LARGE
CELCOIN_WEBHOOK_SECRET
```

---

## Documentação

- [PRD TarefaApp](docs/prd/gestor-de-tarefas-ai.md)
- [Arquitetura TarefaApp](docs/architecture/gestor-de-tarefas-ai.md)
- [PRD ERP/CSM Admin](docs/prd/erp-csm.md)
- [Arquitetura ERP/CSM Admin](docs/architecture/erp-csm.md)

---

## Planos

| Plano | Preço | Grupos | Membros |
|-------|-------|--------|---------|
| Small | R$37/mês | 3 | 10 |
| Medium | R$79/mês | 10 | 30 |
| Large | R$139/mês | ∞ | ∞ |
