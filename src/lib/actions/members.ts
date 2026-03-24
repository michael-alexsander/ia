'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'
import { sendInviteEmail } from '@/lib/email'
import { PLAN_LIMITS, getCheckoutUrl, nextPlan, type PlanName } from '@/lib/plans'

async function getWorkspaceMember() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: member } = await admin
    .from('members')
    .select('id, name, workspace_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .single()

  return member ?? null
}

async function getWorkspacePlan(workspaceId: string): Promise<PlanName> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('workspaces')
    .select('plan')
    .eq('id', workspaceId)
    .single()
  return (data?.plan ?? 'small') as PlanName
}

export async function getWorkspaceMembers() {
  const member = await getWorkspaceMember()
  if (!member) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('members')
    .select('id, name, email, whatsapp, role, status, avatar_url, created_at')
    .eq('workspace_id', member.workspace_id)
    .order('name')

  return data ?? []
}

export async function updateMember(memberId: string, formData: FormData) {
  const me = await getWorkspaceMember()
  if (!me || me.role !== 'admin') return { error: 'Sem permissão' }

  const name       = (formData.get('name') as string)?.trim()
  const email      = (formData.get('email') as string)?.trim() || null
  const role       = (formData.get('role') as 'admin' | 'member') || 'member'
  const avatar_url = (formData.get('avatar_url') as string)?.trim() || null

  if (!name) return { error: 'Nome obrigatório' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('members')
    .update({ name, email, role, avatar_url })
    .eq('id', memberId)
    .eq('workspace_id', me.workspace_id)

  if (error) return { error: 'Erro ao atualizar membro' }
  revalidatePath('/members')
  return { success: true }
}

export async function removeMember(memberId: string) {
  const me = await getWorkspaceMember()
  if (!me || me.role !== 'admin') return { error: 'Sem permissão' }
  if (me.id === memberId) return { error: 'Você não pode remover a si mesmo' }

  const admin = createAdminClient()

  // Remove referências nas tarefas antes de deletar
  await admin.from('tasks').update({ assignee_id: null }).eq('assignee_id', memberId)
  await admin.from('tasks').update({ created_by:  null }).eq('created_by',  memberId)

  const { error } = await admin
    .from('members')
    .delete()
    .eq('id', memberId)
    .eq('workspace_id', me.workspace_id)

  if (error) return { error: 'Erro ao remover membro' }
  revalidatePath('/members')
  return { success: true }
}

// Gera código curto e legível para o usuário digitar no WhatsApp (ex: AB12CD)
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// Envia o código de convite via WhatsApp usando a Evolution API
async function sendWhatsAppInvite(phone: string, name: string, code: string): Promise<void> {
  const url      = process.env.EVOLUTION_URL
  const apikey   = process.env.EVOLUTION_API_KEY
  const instance = process.env.EVOLUTION_INSTANCE
  if (!url || !apikey || !instance) return

  const text =
    `Olá, ${name}! 👋\n\n` +
    `Você foi convidado para o *TarefaApp*.\n\n` +
    `Para ativar seu usuário, basta responder aqui nessa conversa me enviando esse código abaixo 👇\n\n` +
    `*${code}*\n\n` +
    `Basta digitar o código e enviar aqui mesmo na conversa, só isso!\n\n` +
    `👉 Visão completa em https://app.tarefa.app`

  await fetch(`${url}/message/sendText/${instance}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', apikey },
    body:    JSON.stringify({ number: phone, text }),
  })
}

export async function inviteMember(
  _: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean; token?: string; sentViaWhatsapp?: boolean; sentViaEmail?: boolean; limitReached?: boolean; plan?: PlanName; upgradeUrl?: string }> {
  const me = await getWorkspaceMember()
  if (!me || me.role !== 'admin') return { error: 'Sem permissão' }

  const name     = (formData.get('name') as string)?.trim()
  const email    = (formData.get('email') as string)?.trim() || null
  const whatsapp = (formData.get('whatsapp') as string)?.replace(/\D/g, '') || null
  const role     = (formData.get('role') as 'admin' | 'member') || 'member'

  if (!name) return { error: 'Nome obrigatório' }
  if (!email && !whatsapp) return { error: 'Informe e-mail ou WhatsApp' }

  const admin = createAdminClient()

  // ─── Verifica limite de membros do plano ──────────────────────────────────
  const plan   = await getWorkspacePlan(me.workspace_id)
  const limits = PLAN_LIMITS[plan]

  if (limits.members !== Infinity) {
    const { count } = await admin
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', me.workspace_id)
      .in('status', ['active', 'invited'])

    if ((count ?? 0) >= limits.members) {
      const np = nextPlan(plan)
      return {
        error:        `Limite de membros atingido (${limits.members}) no plano ${plan}.`,
        limitReached: true,
        plan,
        upgradeUrl:   np ? getCheckoutUrl(np) : getCheckoutUrl('large'),
      }
    }
  }

  // Verifica duplicata (active ou invited)
  if (email) {
    const { count } = await admin
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', me.workspace_id)
      .eq('email', email)
      .in('status', ['active', 'invited'])
    if ((count ?? 0) > 0) return { error: 'Este e-mail já é membro da empresa' }
  }

  if (whatsapp) {
    const { count } = await admin
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', me.workspace_id)
      .eq('whatsapp', `+${whatsapp}`)
      .in('status', ['active', 'invited'])
    if ((count ?? 0) > 0) return { error: 'Este WhatsApp já está cadastrado' }
  }

  const code    = generateInviteCode()
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const wppFormatted = whatsapp ? `+${whatsapp}` : null

  // Cria membro com status "invited"
  const { error: memberError } = await admin.from('members').insert({
    workspace_id: me.workspace_id,
    name,
    email,
    whatsapp: wppFormatted,
    role,
    status: 'invited',
  })
  if (memberError) return { error: 'Erro ao criar convite' }

  // Cria registro de convite com código curto
  await admin.from('invites').insert({
    workspace_id: me.workspace_id,
    email,
    whatsapp: wppFormatted,
    token:      code,
    role,
    expires_at: expires,
  })

  // Busca nome do workspace para personalizar o email
  const { data: workspace } = await admin
    .from('workspaces')
    .select('name')
    .eq('id', me.workspace_id)
    .single()

  // Envia o código automaticamente via WhatsApp se o número foi informado
  let sentViaWhatsapp = false
  if (whatsapp) {
    try {
      await sendWhatsAppInvite(whatsapp, name, code)
      sentViaWhatsapp = true
    } catch (err) {
      console.error('[inviteMember] erro ao enviar WhatsApp:', err)
    }
  }

  // Envia por e-mail se email informado
  let sentViaEmail = false
  if (email) {
    try {
      await sendInviteEmail({
        to: email,
        name,
        code,
        workspaceName: workspace?.name,
        inviterName: me.name,
      })
      sentViaEmail = true
    } catch (err) {
      console.error('[inviteMember] erro ao enviar e-mail:', err)
    }
  }

  revalidatePath('/members')
  return { success: true, token: code, sentViaWhatsapp, sentViaEmail }
}
