# CLAUDE.md — TarefaApp (ia)

Contexto do projeto para o Claude Code. Leia antes de qualquer tarefa.

---

## O que é este projeto

**TarefaApp** é um gestor de tarefas via WhatsApp + interface web.
- **Web app:** Next.js 16 → deploy Vercel → https://app.tarefa.app
- **Agent bot:** TypeScript/Node.js → VPS Digital Ocean 198.211.112.153 → `/opt/tarefaapp/`
- **Admin CSM:** projeto separado em `C:/admin` → https://admin.melhoragencia.ai
- **Banco:** Supabase (PostgreSQL), service role key, sem RLS

---

## Repositórios

| Projeto | Caminho local | Branch | Deploy |
|---------|--------------|--------|--------|
| TarefaApp web | `C:/ia` | `master` | Vercel auto |
| Admin ERP/CSM | `C:/admin` | `master` | Vercel manual (`npx vercel deploy --prod --yes`) |

---

## VPS (Agent Bot)

```bash
ssh -i ~/.ssh/vps_temp -o StrictHostKeyChecking=no root@198.211.112.153
```

- Processos PM2: `evolution-api` (porta 8080) + `tarefaapp-agent` (porta 3001)
- Código bot: `/opt/tarefaapp/src/`
- Restart: `pm2 restart tarefaapp-agent`
- Logs: `pm2 logs tarefaapp-agent --lines 20 --nostream`

**Arquivos principais do bot:**
- `webhook.ts` — entrada de mensagens, registra `message_logs` via async IIFE
- `parser.ts` — NLP com gpt-4o-mini, extrai intent + entities
- `handlers/tasks.ts` — criarTarefa (due_date auto-hoje), listarTarefas (filtra por responsavel)
- `cron.ts` — relatórios automáticos (diário/semanal/mensal/lembretes)
- `evolution.ts` — sendText(), sendMedia()

---

## Banco de Dados (Supabase)

Tabelas principais: `workspaces`, `members`, `tasks`, `groups`, `group_members`, `invites`, `agent_config`, `task_history`, `message_logs`, `crm_logs`

**Importante:**
- `message_logs` é alimentada pelo bot a cada interação WA → usada para CHS WhatsApp Engagement no admin
- `whatsapp_jid` ≠ `whatsapp`: jid é LID interno da Evolution API, whatsapp é o número real
- `due_date` usa `.split('T')[0] + 'T12:00:00'` para evitar bug de fuso UTC

---

## Deploy

### Web app (ia)
```bash
cd C:/ia
git add <arquivos>
git commit -m "mensagem"
git push  # Vercel detecta e deploya automaticamente
```

### Admin
```bash
cd C:/admin
git add <arquivos>
git commit -m "mensagem"
npx vercel deploy --prod --yes
```

### Bot (VPS)
- Editar arquivos via SSH + Python (para patches complexos)
- `pm2 restart tarefaapp-agent` após qualquer mudança

---

## Links importantes

- Bot WhatsApp: `https://api.whatsapp.com/send?phone=5531989507577&text=Quero%20criar%20tarefa%2C%20como%20funciona%3F`
  - **Usar sempre `api.whatsapp.com/send`** (não `wa.me`) — garante texto pré-preenchido em todos os clientes
- Celcoin webhook: `https://app.tarefa.app/api/webhooks/celcoin`
- Evolution API: `http://localhost:8080`, instance `tarefaapp`, apikey `429683C4C977415CAAFCCE10F7D57E11`

---

## Planos

| Plano | Preço | Grupos | Membros |
|-------|-------|--------|---------|
| Small | R$37/mês | 3 | 10 |
| Medium | R$79/mês | 10 | 30 |
| Large | R$139/mês | ∞ | ∞ |

---

## Armadilhas conhecidas

- **jsPDF:** não suporta Unicode/emojis com Helvetica. Use `pdfSafe()` e primitivas gráficas para logo.
- **Supabase JS v2:** `.insert().catch()` não funciona — use `await` com try/catch ou async IIFE.
- **Next.js 16 middleware:** arquivo deve ser `proxy.ts` (não `middleware.ts`) neste projeto.
- **Celcoin webhook:** autenticação via `body.token`, não header.
- **WhatsApp LID:** em grupos, o bot é identificado por `BOT_LID`, não pelo número de telefone.
- **Tailwind 4:** classes geradas dinamicamente (ex: `grid-cols-[200px,1fr]`) não compilam — use classes fixas ou inline styles.

---

## Documentação completa

- `docs/prd/gestor-de-tarefas-ai.md` — PRD v2.2
- `docs/architecture/gestor-de-tarefas-ai.md` — Arquitetura v2.2
- `docs/prd/erp-csm.md` — PRD Admin v1.1
- `docs/architecture/erp-csm.md` — Arquitetura Admin v1.0
