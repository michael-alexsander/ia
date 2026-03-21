'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

function generateTaskId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let id = ''
  for (let i = 0; i < 5; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}

async function getWorkspaceMember() {
  // Usa anon client só para obter o usuário autenticado
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Usa admin client para buscar o membro (evita problema com RLS self-referencial)
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

export async function getTasks() {
  const member = await getWorkspaceMember()
  if (!member) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('tasks')
    .select(`
      id, task_id, title, description, status, due_date, due_time, recurrence, created_at,
      assignee:members!tasks_assignee_id_fkey(id, name),
      group:groups(id, name)
    `)
    .eq('workspace_id', member.workspace_id)
    .order('created_at', { ascending: false })

  return (data ?? []).map(task => ({
    ...task,
    assignee: Array.isArray(task.assignee) ? (task.assignee[0] ?? null) : task.assignee,
    group: Array.isArray(task.group) ? (task.group[0] ?? null) : task.group,
  }))
}

export async function getMembers() {
  const member = await getWorkspaceMember()
  if (!member) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('members')
    .select('id, name, email, whatsapp, role, status')
    .eq('workspace_id', member.workspace_id)
    .eq('status', 'active')
    .order('name')

  return data ?? []
}

export async function getGroups() {
  const member = await getWorkspaceMember()
  if (!member) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('groups')
    .select('id, name')
    .eq('workspace_id', member.workspace_id)
    .order('name')

  return data ?? []
}

export async function createTask(formData: FormData) {
  const member = await getWorkspaceMember()
  if (!member) return { error: 'Não autenticado' }

  const title       = formData.get('title') as string
  const assignee_id = (formData.get('assignee_id') as string) || null
  const group_id    = (formData.get('group_id') as string) || null
  const due_date    = (formData.get('due_date') as string) || null
  const due_time    = (formData.get('due_time') as string) || null
  const description = (formData.get('description') as string) || null

  if (!title?.trim()) return { error: 'Título obrigatório' }

  const admin = createAdminClient()

  // Gera ID único no workspace
  let task_id = generateTaskId()
  let exists = true
  while (exists) {
    const { count } = await admin
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', member.workspace_id)
      .eq('task_id', task_id)
    exists = (count ?? 0) > 0
    if (exists) task_id = generateTaskId()
  }

  const { error } = await admin.from('tasks').insert({
    task_id,
    workspace_id: member.workspace_id,
    title: title.trim(),
    description: description?.trim() || null,
    assignee_id: assignee_id || null,
    group_id: group_id || null,
    created_by: member.id,
    due_date: due_date || null,
    due_time: due_time || null,
    status: 'open',
  })

  if (error) return { error: 'Erro ao criar tarefa' }

  revalidatePath('/tasks')
  return { success: true, task_id }
}

export async function updateTaskStatus(taskId: string, status: string) {
  const member = await getWorkspaceMember()
  if (!member) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('tasks')
    .update({ status })
    .eq('id', taskId)
    .eq('workspace_id', member.workspace_id)

  if (error) return { error: 'Erro ao atualizar' }

  revalidatePath('/tasks')
  return { success: true }
}

export async function updateTask(taskId: string, formData: FormData) {
  const member = await getWorkspaceMember()
  if (!member) return { error: 'Não autenticado' }

  const title       = (formData.get('title') as string)?.trim()
  const assignee_id = (formData.get('assignee_id') as string) || null
  const group_id    = (formData.get('group_id') as string) || null
  const due_date    = (formData.get('due_date') as string) || null
  const due_time    = (formData.get('due_time') as string) || null
  const description = (formData.get('description') as string)?.trim() || null
  const status      = (formData.get('status') as string) || undefined

  if (!title) return { error: 'Título obrigatório' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('tasks')
    .update({ title, assignee_id, group_id, due_date, due_time, description, ...(status ? { status } : {}) })
    .eq('id', taskId)
    .eq('workspace_id', member.workspace_id)

  if (error) return { error: 'Erro ao atualizar tarefa' }

  revalidatePath('/tasks')
  return { success: true }
}

export async function deleteTask(taskId: string) {
  const member = await getWorkspaceMember()
  if (!member) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('workspace_id', member.workspace_id)

  if (error) return { error: 'Erro ao excluir' }

  revalidatePath('/tasks')
  return { success: true }
}
