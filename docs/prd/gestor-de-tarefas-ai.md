# PRD — Gestor de Tarefas e Equipes AI
**Produto:** MelhorAgencia.ai
**Agente:** TarefaApp — Gestor de Tarefas e Equipes
**Versão:** 2.0
**Data:** 2026-03-22
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

**Stack:** Next.js 15 (App Router) + Supabase + Tailwind CSS 4 + React 19
**Auth:** Google OAuth · Email + Senha · Magic Link por e-mail
**Deploy:** Vercel → app.tarefa.app
**Layout:** Sidebar colapsável (desktop) + drawer mobile + responsivo

### 5.1 Páginas

#### `/login`
- Card com logo TarefaApp em header verde
- 3 opções: Google OAuth, Email+Senha, Magic Link

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

#### `/members` — Membros ✅
- Lista: avatar, nome (ícone coroa para admin), contato, função, status
- Convidar membro: DDI +55 fixo + número DDD+tel + email opcional
- Envio automático: código 6-chars por WhatsApp + email (Resend)
- Editar / Remover membros

#### `/groups` — Grupos ✅
- CRUD de grupos + associação de membros
- Código `LINK-XXXXX` para vincular ao grupo do WhatsApp

#### `/settings` — Configurações ✅
- Horário relatório manhã / noite (por workspace)
- `reminder_hours_before`: X horas antes do prazo para lembrete

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

### 6.2 Identificação de usuários
- Membro identificado por `whatsapp_jid` (LID interno da Evolution API)
- Em grupos: bot identificado por `BOT_LID` (não pelo número de telefone)
- Privado e grupo suportados

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

### 6.6 Entidades extraídas pelo parser
`responsavel`, `prazo`, `hora`, `status`, `titulo`, `task_id`, `grupo`, `descricao`, `novo_responsavel`, `novo_prazo`, `nova_hora`

---

## 7. Modelo de Negócio

- Assinatura por agente (planos: small, medium, large)
- Integração de pagamento: Celcoin (pendente)
- Early adopters após 2 agentes funcionando

---

## 8. Critério de Sucesso — 30 dias
1.200 tarefas criadas com 12 usuários ativos

---

## 9. Roadmap Pós-MVP

- Celcoin: cobrança automática de assinaturas
- Logo no PDF e nos emails
- Notificação ao responsável quando tarefa criada para ele
- Tarefas recorrentes (diária/semanal/mensal)
- Sistema de pontuação + gamificação semanal
- Google Calendar: tarefas com prazo viram eventos
- Hard delete de membro com limpeza de referências
