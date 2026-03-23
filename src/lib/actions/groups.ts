'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { PLAN_LIMITS, getCheckoutUrl, nextPlan, type PlanName } from '@/lib/plans'

async function getWorkspaceMember() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: member } = await admin
    .from('members')
    .select('id, workspace_id, role')
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

function generateLinkCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = 'LINK-'
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function getGroups() {
  const member = await getWorkspaceMember()
  if (!member) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('groups')
    .select(`
      id, name, description, whatsapp_group, link_code, linked_at, created_at,
      group_members(member_id, members(id, name, avatar_url))
    `)
    .eq('workspace_id', member.workspace_id)
    .order('name')

  return (data ?? []).map(g => ({
    ...g,
    members: (g.group_members ?? []).map((gm: any) => gm.members).filter(Boolean),
  }))
}

export async function getWorkspaceMembersForGroup() {
  const member = await getWorkspaceMember()
  if (!member) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('members')
    .select('id, name, avatar_url')
    .eq('workspace_id', member.workspace_id)
    .eq('status', 'active')
    .order('name')

  return data ?? []
}

export async function createGroup(_: unknown, formData: FormData): Promise<{ error?: string; success?: boolean; limitReached?: boolean; plan?: PlanName; upgradeUrl?: string }> {
  const member = await getWorkspaceMember()
  if (!member || member.role !== 'admin') return { error: 'Sem permissão' }

  const name        = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const memberIds   = formData.getAll('member_ids') as string[]

  if (!name) return { error: 'Nome obrigatório' }

  const admin = createAdminClient()

  // ─── Verifica limite de grupos do plano ───────────────────────────────────
  const plan   = await getWorkspacePlan(member.workspace_id)
  const limits = PLAN_LIMITS[plan]

  if (limits.groups !== Infinity) {
    const { count } = await admin
      .from('groups')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', member.workspace_id)

    if ((count ?? 0) >= limits.groups) {
      const np = nextPlan(plan)
      return {
        error:        `Limite de grupos atingido (${limits.groups}) no plano ${plan}.`,
        limitReached: true,
        plan,
        upgradeUrl:   np ? getCheckoutUrl(np) : getCheckoutUrl('large'),
      }
    }
  }

  // Gera link_code único
  let link_code = generateLinkCode()
  let exists = true
  while (exists) {
    const { count } = await admin
      .from('groups')
      .select('*', { count: 'exact', head: true })
      .eq('link_code', link_code)
    exists = (count ?? 0) > 0
    if (exists) link_code = generateLinkCode()
  }

  const { data: group, error } = await admin
    .from('groups')
    .insert({ workspace_id: member.workspace_id, name, description, link_code })
    .select()
    .single()

  if (error || !group) return { error: 'Erro ao criar grupo' }

  if (memberIds.length > 0) {
    await admin.from('group_members').insert(
      memberIds.map(mid => ({ group_id: group.id, member_id: mid }))
    )
  }

  revalidatePath('/groups')
  return { success: true }
}

export async function updateGroup(groupId: string, formData: FormData) {
  const member = await getWorkspaceMember()
  if (!member || member.role !== 'admin') return { error: 'Sem permissão' }

  const name        = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const memberIds   = formData.getAll('member_ids') as string[]

  if (!name) return { error: 'Nome obrigatório' }

  const admin = createAdminClient()

  const { error } = await admin
    .from('groups')
    .update({ name, description })
    .eq('id', groupId)
    .eq('workspace_id', member.workspace_id)

  if (error) return { error: 'Erro ao atualizar grupo' }

  await admin.from('group_members').delete().eq('group_id', groupId)
  if (memberIds.length > 0) {
    await admin.from('group_members').insert(
      memberIds.map(mid => ({ group_id: groupId, member_id: mid }))
    )
  }

  revalidatePath('/groups')
  return { success: true }
}

export async function deleteGroup(groupId: string) {
  const member = await getWorkspaceMember()
  if (!member || member.role !== 'admin') return { error: 'Sem permissão' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('groups')
    .delete()
    .eq('id', groupId)
    .eq('workspace_id', member.workspace_id)

  if (error) return { error: 'Erro ao excluir grupo' }

  revalidatePath('/groups')
  return { success: true }
}
