import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { celcoinPlanToInternal, PLAN_LABELS } from '@/lib/plans'
import { sendWelcomeEmail } from '@/lib/email'

// Status de assinatura que indicam pagamento ativo
const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'waitingPayment', // aguardando mas considerado ativo
])

// Status de transação que indicam pagamento confirmado
const PAID_TRANSACTION_STATUSES = new Set([
  'captured',
  'paidAndManuallyConfirmed',
  'partialCaptured',
])

// Status de assinatura que indicam suspensão
const SUSPENDED_SUBSCRIPTION_STATUSES = new Set([
  'canceled',
  'closed',
])

// Status de transação que indicam falha/cancelamento
const FAILED_TRANSACTION_STATUSES = new Set([
  'notCaptured',
  'notAuthorized',
  'reversed',
  'chargeback',
])

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[webhook/celcoin] Evento recebido:', JSON.stringify(body))

    // Verificação de segurança: token enviado no body pela cel_cash
    const secret = process.env.CELCOIN_WEBHOOK_SECRET
    if (secret) {
      const token = body.token ?? req.headers.get('x-webhook-token')
      if (token !== secret) {
        console.warn('[webhook/celcoin] Token inválido')
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Extrai campos do payload cel_cash
    const type             = body.type ?? ''
    const subscription     = body.subscription ?? {}
    const transaction      = body.transaction ?? (body.Transactions ?? [])[0] ?? {}
    const customer         = body.Customer ?? subscription.Customer ?? body.customer ?? {}

    const subscriptionId    = subscription.id    ?? body.subscriptionId ?? null
    const subscriptionMyId  = subscription.myId  ?? null
    const subscriptionStatus= subscription.status ?? null
    const transactionStatus = transaction.status  ?? null
    const customerEmail     = customer.email      ?? null
    const customerName      = customer.name       ?? customer.nome  ?? null
    const customerPhone     = customer.cellphone  ?? customer.celular ?? customer.phone ?? null

    // Tenta identificar o plano pelo nome/myId do plano
    const planName = subscription.Plan?.name ?? subscription.plan?.name ?? body.planName ?? null
    const planMyId = subscription.Plan?.myId ?? subscription.plan?.myId ?? null

    const admin = createAdminClient()

    // ─── Determinar ação baseado no tipo de evento e status ───────────────────

    const shouldActivate =
      // Assinatura ativa com transação paga
      (type === 'subscription.addTransaction' && PAID_TRANSACTION_STATUSES.has(transactionStatus)) ||
      // Atualização de status com assinatura ativa
      (type === 'transaction.updateStatus'     && PAID_TRANSACTION_STATUSES.has(transactionStatus) && ACTIVE_SUBSCRIPTION_STATUSES.has(subscriptionStatus)) ||
      // Contrato aceito (primeira ativação)
      (type === 'contract.accepted'            && ACTIVE_SUBSCRIPTION_STATUSES.has(subscriptionStatus))

    const shouldSuspend =
      // Assinatura cancelada/encerrada
      SUSPENDED_SUBSCRIPTION_STATUSES.has(subscriptionStatus) ||
      // Transação falhou E assinatura não está ativa
      (FAILED_TRANSACTION_STATUSES.has(transactionStatus) && !ACTIVE_SUBSCRIPTION_STATUSES.has(subscriptionStatus))

    // ─── Encontrar workspace ──────────────────────────────────────────────────

    async function findWorkspace(): Promise<string | null> {
      // 1. Por celcoin_id (subscription ID numérico)
      if (subscriptionId) {
        const { data: ws } = await admin
          .from('workspaces')
          .select('id')
          .eq('celcoin_id', String(subscriptionId))
          .limit(1)
          .single()
        if (ws?.id) return ws.id
      }

      // 2. Por myId da assinatura (pode ser o email do admin armazenado como myId)
      if (subscriptionMyId) {
        const { data: ws } = await admin
          .from('workspaces')
          .select('id')
          .eq('celcoin_id', subscriptionMyId)
          .limit(1)
          .single()
        if (ws?.id) return ws.id
      }

      // 3. Fallback: pelo email do cliente (admin do workspace)
      if (customerEmail) {
        const { data: member } = await admin
          .from('members')
          .select('workspace_id')
          .eq('email', customerEmail)
          .eq('role', 'admin')
          .eq('status', 'active')
          .limit(1)
          .single()
        if (member?.workspace_id) return member.workspace_id
      }

      return null
    }

    // ─── Ativar workspace ─────────────────────────────────────────────────────
    if (shouldActivate) {
      const plan = (planName ?? planMyId) ? celcoinPlanToInternal(planName ?? planMyId) : null
      const workspaceId = await findWorkspace()
      const isNewCustomer = !workspaceId

      if (workspaceId) {
        // Workspace existente → apenas atualiza status/plano
        const update: Record<string, unknown> = {
          status:     'active',
          updated_at: new Date().toISOString(),
        }
        if (subscriptionId) update.celcoin_id = String(subscriptionId)
        if (plan)           update.plan = plan

        await admin.from('workspaces').update(update).eq('id', workspaceId)
        console.log(`[webhook/celcoin] Workspace ${workspaceId} ativado — evento: ${type}, plano: ${plan ?? 'sem alteração'}`)
      } else {
        // Novo cliente → log apenas (workspace criado no onboarding web)
        console.log(`[webhook/celcoin] Novo cliente — sem workspace ainda: ${customerEmail}`)
      }

      // Boas-vindas apenas para novos clientes (workspace não existia antes)
      if (isNewCustomer && (customerEmail || customerPhone)) {
        await enviarBoasVindasNovoCliente({ customerName, customerEmail, customerPhone, plan })
      }
    }

    // ─── Suspender workspace ──────────────────────────────────────────────────
    else if (shouldSuspend) {
      const workspaceId = await findWorkspace()

      if (!workspaceId) {
        console.warn('[webhook/celcoin] Workspace não encontrado para suspensão:', { subscriptionId, customerEmail })
        return NextResponse.json({ received: true, warning: 'workspace_not_found' })
      }

      await admin.from('workspaces')
        .update({ status: 'suspended', updated_at: new Date().toISOString() })
        .eq('id', workspaceId)

      console.log(`[webhook/celcoin] Workspace ${workspaceId} suspenso — evento: ${type}, subscription status: ${subscriptionStatus}`)

      // Notifica admins via WhatsApp
      await notificarAdminsSuspenso(workspaceId, admin)
    }

    else {
      console.log(`[webhook/celcoin] Evento ignorado: ${type} (subscription: ${subscriptionStatus}, transaction: ${transactionStatus})`)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[webhook/celcoin] Erro:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function enviarBoasVindasNovoCliente({
  customerName,
  customerEmail,
  customerPhone,
  plan,
}: {
  customerName:  string | null
  customerEmail: string | null
  customerPhone: string | null
  plan:          import('@/lib/plans').PlanName | null
}) {
  const nome      = customerName ?? 'Cliente'
  const planLabel = plan ? PLAN_LABELS[plan] : 'TarefaApp'

  const url      = process.env.EVOLUTION_URL
  const apikey   = process.env.EVOLUTION_API_KEY
  const instance = process.env.EVOLUTION_INSTANCE

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  if (url && apikey && instance && customerPhone) {
    const phone = customerPhone.replace(/\D/g, '')
    const phoneWithDDI = phone.startsWith('55') ? phone : `55${phone}`

    const msg =
      `🎉 *Bem-vindo ao TarefaApp, ${nome}!*\n\n` +
      `Seu plano *${planLabel}* foi ativado com sucesso! ✅\n\n` +
      `*Próximo passo:* acesse o link abaixo e crie sua conta usando o email que você usou no cadastro:\n` +
      `👉 https://app.tarefa.app\n\n` +
      `Depois disso, você poderá convidar sua equipe e já começar a criar tarefas por aqui mesmo, pelo WhatsApp! 🚀\n\n` +
      `💬 Crie tarefas diretamente no WhatsApp, é simples: https://api.whatsapp.com/send?phone=5531989507577&text=Quero%20criar%20tarefa%2C%20como%20funciona%3F\n\n` +
      `Qualquer dúvida é só responder esta mensagem.`

    try {
      await fetch(`${url}/message/sendText/${instance}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', apikey },
        body:    JSON.stringify({ number: phoneWithDDI, text: msg }),
      })
      console.log(`[webhook/celcoin] WhatsApp de boas-vindas enviado para ${phoneWithDDI}`)
    } catch (err) {
      console.error('[webhook/celcoin] Erro ao enviar WhatsApp de boas-vindas:', err)
    }
  }

  // ── Email ─────────────────────────────────────────────────────────────────
  if (customerEmail) {
    try {
      await sendWelcomeEmail({ to: customerEmail, name: nome, planLabel })
      console.log(`[webhook/celcoin] Email de boas-vindas enviado para ${customerEmail}`)
    } catch (err) {
      console.error('[webhook/celcoin] Erro ao enviar email de boas-vindas:', err)
    }
  }
}

async function notificarAdminsSuspenso(workspaceId: string, admin: ReturnType<typeof createAdminClient>) {
  try {
    const { data: workspace } = await admin
      .from('workspaces')
      .select('name, plan')
      .eq('id', workspaceId)
      .single()

    const { data: admins } = await admin
      .from('members')
      .select('name, whatsapp')
      .eq('workspace_id', workspaceId)
      .eq('role', 'admin')
      .eq('status', 'active')
      .not('whatsapp', 'is', null)

    if (!admins?.length) return

    const url      = process.env.EVOLUTION_URL
    const apikey   = process.env.EVOLUTION_API_KEY
    const instance = process.env.EVOLUTION_INSTANCE
    if (!url || !apikey || !instance) return

    const checkoutUrls: Record<string, string> = {
      small:  process.env.CELCOIN_CHECKOUT_SMALL  ?? 'https://celcash.celcoin.com.br/landingpage7350005/tarefa-app/comprar/plano-small/70',
      medium: process.env.CELCOIN_CHECKOUT_MEDIUM ?? 'https://celcash.celcoin.com.br/landingpage7350005/tarefa-app/comprar/plano-medium/71',
      large:  process.env.CELCOIN_CHECKOUT_LARGE  ?? 'https://celcash.celcoin.com.br/landingpage7350005/tarefa-app/comprar/plano-large/72',
    }
    const plan        = (workspace?.plan ?? 'small') as string
    const checkoutUrl = checkoutUrls[plan] ?? checkoutUrls.small

    for (const adm of admins) {
      const phone = adm.whatsapp.replace(/\D/g, '')
      const msg =
        `⚠️ *Acesso ao TarefaApp suspenso*\n\n` +
        `Olá, ${adm.name}! O acesso da empresa *${workspace?.name ?? ''}* foi suspenso por falta de pagamento.\n\n` +
        `Para reativar, renove sua assinatura:\n` +
        `👉 ${checkoutUrl}\n\n` +
        `Dúvidas? Responda aqui ou acesse app.tarefa.app`

      await fetch(`${url}/message/sendText/${instance}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', apikey },
        body:    JSON.stringify({ number: phone, text: msg }),
      })
    }
  } catch (err) {
    console.error('[webhook/celcoin] Erro ao notificar admins:', err)
  }
}
