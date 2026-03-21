'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export async function createWorkspace(_: unknown, formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Nome obrigatório' }

  // Pega o usuário autenticado
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Sessão expirada. Faça login novamente.' }

  const admin = createAdminClient()

  // Gera slug único
  let slug = slugify(name)
  const { count } = await admin
    .from('workspaces')
    .select('*', { count: 'exact', head: true })
    .eq('slug', slug)
  if ((count ?? 0) > 0) slug = `${slug}-${Date.now()}`

  // Cria workspace
  const { data: workspace, error: wsError } = await admin
    .from('workspaces')
    .insert({ name, slug, plan: 'small' })
    .select()
    .single()

  console.log('[createWorkspace] workspace criado:', workspace?.id, '| erro:', wsError?.message)

  if (wsError || !workspace) {
    return { error: 'Erro ao criar empresa. Tente novamente.' }
  }

  // Cria membro admin
  const { error: memberError } = await admin.from('members').insert({
    workspace_id: workspace.id,
    user_id: user.id,
    name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Admin',
    email: user.email,
    role: 'admin',
    status: 'active',
  })

  console.log('[createWorkspace] membro criado | erro:', memberError?.message)

  if (memberError) {
    await admin.from('workspaces').delete().eq('id', workspace.id)
    return { error: 'Erro ao configurar conta. Tente novamente.' }
  }

  // Cria config padrão do agente
  await admin.from('agent_config').insert({ workspace_id: workspace.id })

  return { success: true }
}
