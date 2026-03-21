# PRD — Gestor de Tarefas e Equipes AI
**Produto:** MelhorAgencia.ai
**Agente:** Gestor de Tarefas e Equipes
**Versão:** 1.2
**Data:** 2026-03-18
**Status:** Em definição

---

## 1. Visão Geral

O **Gestor de Tarefas e Equipes AI** é o primeiro agente da plataforma MelhorAgencia.ai. Ele opera via WhatsApp (Evolution API) como canal principal de interação diária, complementado por uma **interface web minimalista** para configurações, visualização e gestão estruturada.

É a evolução do Tarefa.app: em vez de um bot com comandos rígidos, é um agente com inteligência contextual, comportamento proativo, memória compartilhada e uma camada visual para o que o WhatsApp não resolve bem.

---

## 2. Problema que Resolve

> *"A experiência de criar, editar e concluir uma tarefa deve ser simples para o funcionário, e eu, como administrador, preciso mensurar a produtividade diária, semanal e mensal de todo o time."*

Hoje o fluxo de gestão de tarefas exige que o gestor saia do WhatsApp para registrar, acompanhar e cobrar tarefas. O resultado é perda de contexto, tarefas esquecidas e nenhuma visibilidade real de produtividade.

---

## 3. Personas

### 3.1 Admin (Gestor)
- Cria tarefas para si e para qualquer membro do time
- Acompanha produtividade individual e coletiva
- Recebe relatórios automáticos diários, semanais e mensais
- Tem visão completa de todas as tarefas abertas e concluídas
- Pode promover outros membros a Admin
- Acessa e configura tudo via interface web ou WhatsApp

### 3.2 Colaborador
- Recebe tarefas atribuídas pelo admin ou cria as próprias
- Atualiza status das suas tarefas (concluir, editar, excluir)
- Interage com o agente via linguagem natural no grupo ou no privado
- Acessa interface web para visualizar e gerenciar suas tarefas

---

## 4. Canais de Interação

| Canal | Quem usa | Como acionar |
|---|---|---|
| Grupo do WhatsApp da empresa | Admin + Colaboradores | Mencionar `@GestorAI` |
| Chat privado com o agente | Admin + Colaboradores | Mensagem direta |
| Interface web (dashboard) | Admin + Colaboradores | Login via Google OAuth |

---

## 5. Interface Web — Minimalista

Stack: **Next.js** + **Supabase** + **Tailwind CSS**
Autenticação: **Google OAuth** (um clique, sem senha) · **Email + Senha** · **Magic Link por e-mail**

### 5.1 Páginas e Seções

#### Tarefas (`/tasks`)
- Lista de tarefas com filtros: data, status, ID, responsável, grupo
- Colunas: ID, título, responsável, prazo, status, ações
- Status visual: `Aberta` · `Andamento` · `Concluída`
- **Botão único** "Nova Tarefa" (modal simples)
- Cada tarefa tem botões inline: **Editar** e **Excluir**
- Baixar lista filtrada em **PDF**
- Enviar relatório filtrado diretamente por **WhatsApp** ou **E-mail** para qualquer membro cadastrado

#### Membros (`/members`)
- Lista de todos os membros da empresa com nome, função, e nível de acesso
- CRUD completo: criar, editar, remover membro
- Convidar novo membro via **e-mail** ou **número de WhatsApp**
- Definir se o membro é **Admin** ou **Colaborador**

#### Grupos (`/groups`)
- Lista de grupos da empresa
- CRUD completo: criar, editar, remover grupo
- Associar membros a grupos
- Visualizar tarefas por grupo

#### Configurações (`/settings`)
- **Relatórios automáticos:** Admin marca quais quer receber (Diário / Semanal / Mensal / Todos) e por qual canal (WhatsApp / E-mail / Ambos)
- **Lembretes:** Admin define quando chegam para ele e para os colaboradores:
  - [ ] 1 dia antes do vencimento
  - [ ] 1 hora antes do vencimento
  - [ ] No dia do vencimento
- **Alertas de atraso:** Admin marca se quer receber notificação de tarefas vencidas no dia seguinte ao vencimento
- **Admins adicionais:** Admin pode promover outros membros a Admin

---

## 6. Funcionalidades do Agente (WhatsApp)

### 6.1 MVP — Essenciais

#### CRUD de Tarefas (linguagem natural)
- **Criar tarefa:** Mensagem em linguagem natural. O agente extrai responsável, prazo e descrição, confirma e salva. Retorna o ID da tarefa criada.
  - Exemplo: *"@GestorAI cria uma tarefa pro Luiz entregar o layout até sexta"*
  - Resposta: *"Tarefa criada ✓ | ID: **T25A3** | Responsável: Luiz | Prazo: 21/03 18h"*
- **Visualizar tarefas:** Listar tarefas por responsável, status ou ID.
  - Exemplo: *"@GestorAI quais tarefas abertas do Luiz?"*
- **Editar tarefa:** Alterar prazo, responsável, status ou descrição via ID ou contexto.
  - Exemplo: *"@GestorAI muda o prazo da T25A3 para segunda"*
- **Concluir tarefa:** Colaborador conclui pelo ID ou contexto.
  - Exemplo: *"Conclui a T25A3"*
- **Excluir tarefa:** Admin ou responsável exclui pelo ID.

#### ID das Tarefas
- Código alfanumérico de 5 caracteres gerado aleatoriamente. Exemplo: `T25A3`, `K9BX1`
- Aparece em toda comunicação WhatsApp referente à tarefa
- Aparece na coluna ID da interface web
- Usado para referenciar a tarefa de forma precisa em comandos

#### Status das Tarefas
Cada tarefa possui exatamente 3 status:

| Status | Descrição |
|---|---|
| `Aberta` | Tarefa criada, ainda não iniciada |
| `Andamento` | Em execução pelo responsável |
| `Concluída` | Finalizada |

#### Atribuição e Notificação
- Ao criar tarefa para um colaborador, o agente notifica o colaborador no privado com os detalhes e o ID.
- O colaborador pode aceitar, pedir ajuste de prazo ou reportar impedimento.

#### Tarefas Recorrentes
- Admin define tarefas que se repetem (diária, semanal, mensal).
- O agente cria automaticamente no ciclo definido com novo ID a cada ocorrência.

#### Lembretes Automáticos
- Configuráveis por Admin via interface web (seção Configurações).
- Opções: 1 dia antes, 1 hora antes, no dia do vencimento.

#### Cobranças de Entrega (Proativo)
- Se uma tarefa vencer sem conclusão, o agente notifica o responsável e o admin.
- Se configurado, envia alerta no dia seguinte ao vencimento também.

#### Relatórios Automáticos

| Relatório | Horário | Conteúdo | Destinatário |
|---|---|---|---|
| Diário manhã | 08h | Tarefas abertas do dia por pessoa | Admin |
| Diário noite | 18h | Tarefas concluídas no dia | Admin |
| Semanal | Segunda 08h | Resumo de produtividade da semana | Admin |
| Mensal | Dia 1 às 08h | Resumo de produtividade do mês | Admin |
| Sob demanda | Quando solicitado | De acordo com o pedido | Quem pediu |

> Relatórios são enviados por WhatsApp e/ou e-mail conforme configurado pelo Admin.

#### Relatório Sob Demanda
- Exemplo: *"Me mostra a produtividade do Luiz essa semana"*
- Agente responde com resumo formatado no WhatsApp.

---

### 6.2 Nice to Have (pós-MVP)

- Sistema de pontuação por tarefa (dificuldade/importância)
- Gamificação semanal entre colaboradores (ranking/coroa)
- Integração com Google Calendar (tarefas com prazo viram eventos)
- Integração com Gmail (notificação por email nativa)

---

## 7. Fluxos Principais

### Fluxo 1 — Criar Tarefa via WhatsApp
```
Admin no grupo → "@GestorAI cria tarefa pro Luiz: entregar layout da home até sexta 18h"
  → Agente confirma: "Confirma? Tarefa: 'Entregar layout da home' | Responsável: Luiz | Prazo: 21/03 18h"
  → Admin responde "sim"
  → Tarefa salva no Supabase com ID gerado (ex: T25A3)
  → Agente responde no grupo: "Tarefa criada ✓ | ID: T25A3"
  → Agente notifica Luiz no privado: "Nova tarefa para você! ID: T25A3 | 'Entregar layout da home' | Prazo: 21/03 18h"
```

### Fluxo 2 — Concluir Tarefa
```
Luiz no privado → "Conclui a T25A3"
  → Agente confirma conclusão
  → Atualiza status no Supabase para "Concluída"
  → Notifica o Admin: "Luiz concluiu a T25A3 — 'Entregar layout da home' ✓"
```

### Fluxo 3 — Tarefa Atrasada (Proativo)
```
Prazo vencido sem conclusão
  → Agente notifica o responsável: "Oi Luiz, a tarefa T25A3 venceu hoje. Consegue concluir?"
  → Agente notifica o Admin: "Tarefa em atraso | T25A3 — 'Entregar layout da home' | Responsável: Luiz"
  → Se configurado: no dia seguinte envia novo alerta
```

### Fluxo 4 — Relatório Diário (Proativo)
```
Todos os dias às 08h
  → Agente envia para Admin (WhatsApp e/ou email):

  "Bom dia, Michael! Resumo de hoje — 18/03

  📋 Tarefas abertas: 8
  • Luiz (2): T25A3 Layout home | T18B2 Revisão copy
  • Ana (3): ...

  ⚠️ Em atraso: 1
  • Pedro: T09C1 Planilha de custos (venceu ontem)"
```

### Fluxo 5 — Convidar Membro (Interface Web)
```
Admin em /members → "Convidar membro"
  → Preenche nome + email OU número de WhatsApp
  → Sistema envia convite com link de acesso
  → Novo membro faz login via Google OAuth
  → Membro é adicionado ao workspace da empresa
```

---

## 8. Regras de Negócio

1. Apenas **Admin** pode criar tarefas para outros membros.
2. **Colaboradores** só podem criar tarefas para si mesmos (MVP).
3. Qualquer membro pode concluir ou editar suas próprias tarefas.
4. Apenas **Admin** pode excluir tarefas de outros.
5. O agente sempre pede **confirmação** antes de criar ou excluir uma tarefa.
6. Máximo de **2 edições por sessão** de criação de tarefa via WhatsApp.
7. Se o agente não identificar responsável ou prazo, pergunta antes de criar.
8. Cada empresa é um **workspace isolado** — nenhum dado vaza entre clientes.
9. Um Admin pode promover outros membros a Admin via interface web ou WhatsApp.
10. O ID da tarefa é único dentro do workspace da empresa.

---

## 9. Planos e Limites

| Plano | Grupos | Membros | Tarefas |
|---|---|---|---|
| **Small** | 3 | 10 | Ilimitadas |
| **Medium** | 10 | 30 | Ilimitadas |
| **Large** | Ilimitados | Ilimitados | Ilimitadas |

- Cobrança por assinatura mensal via **Celcoin API**
- Preços a definir em documento de pricing separado

---

## 10. Memória do Agente

O agente mantém em Supabase:

| Tabela | Descrição |
|---|---|
| `workspaces` | Dados da empresa (nome, plano, configurações) |
| `members` | Nome, telefone, email, função e nível de acesso |
| `groups` | Grupos da empresa e membros associados |
| `tasks` | Tarefas com ID, status, responsável, prazo, histórico |
| `agent_config` | Horários de relatório, canais preferidos, alertas configurados |
| `conversation_context` | Contexto recente para resolução de ambiguidades |

A memória é **compartilhada com outros agentes** da MelhorAgencia.ai.

---

## 11. Fora do Escopo — MVP

- Integração com ferramentas externas (Notion, Trello, Google Calendar) — pós-MVP
- Gestão de projetos com subníveis / épicos
- Controle de horas trabalhadas
- Chat entre membros via agente
- App mobile próprio

---

## 12. Critério de Sucesso — 30 dias

| Métrica | Meta |
|---|---|
| Tarefas criadas | ≥ 1.200 |
| Usuários ativos | ≥ 12 |
| Taxa de conclusão de tarefas | ≥ 60% |
| Tarefas criadas via linguagem natural sem erro de parsing | ≥ 85% |
| Admin recebendo relatórios automáticos sem falhas | 100% dos dias |

---

## 13. Stack Técnica

| Componente | Tecnologia |
|---|---|
| Interface web | Next.js + Tailwind CSS |
| Autenticação | Google OAuth (via Supabase Auth) |
| Interface de conversa | WhatsApp via Evolution API |
| Lógica do agente | TypeScript / Node.js |
| LLM | OpenAI API (`gpt-4.1-mini`) |
| Banco de dados | Supabase (PostgreSQL + pgvector) |
| Pagamentos | Celcoin API |
| Hospedagem do agente | VPS Hostinger |
| Frontend / webhooks | Vercel |
| IDE | Cursor |
| Engenheiro chefe | Claude Code (não confundir com o LLM do produto) |
| Repositório | GitHub |

---

## 14. Identidade Visual

A interface web segue a identidade do **TarefaApp**, mantendo logotipo e paleta de cores originais.

| Elemento | Valor |
|---|---|
| **Cor primária** | `#128c7e` (teal escuro — botões, links, ações principais) |
| **Cor accent / hover** | `#00baa5` (teal claro — destaques, estados hover) |
| **Hover de botões** | `#39a878` |
| **Fundo** | `#ffffff` |
| **Texto** | `#000000` |
| **Estilo** | Light · Minimalista · Whitespace generoso |
| **Logotipo** | Logotipo oficial do TarefaApp (443×107px) |
| **Tipografia** | H1: 60px · H2: 40px · H3: 30px · Body: 18px / line-height 1.5 |

---

## 15. Próximos Passos

- [ ] Validar PRD v1.1 com Michael
- [ ] Documento de Arquitetura Técnica
- [ ] Schema do banco de dados (Supabase)
- [ ] Configurar ambiente (Evolution API no VPS Hostinger)
- [ ] Desenvolver autenticação Google OAuth
- [ ] Desenvolver interface web minimalista (Next.js)
- [ ] Desenvolver webhook de entrada (recebe mensagem do WhatsApp)
- [ ] Desenvolver parser de linguagem natural (criar tarefa)
- [ ] Desenvolver CRUD completo de tarefas
- [ ] Desenvolver sistema de notificações e lembretes
- [ ] Desenvolver relatórios automáticos (cron jobs)
- [ ] Desenvolver geração de PDF e envio por WhatsApp/email
- [ ] Integrar Celcoin API (planos e assinaturas)
- [ ] Testes internos com o time da MelhorAgencia.ai
- [ ] Abertura para Early Adopters
