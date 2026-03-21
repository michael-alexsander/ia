import { supabase } from '../supabase'
import { MsgContext, ParsedIntent } from '../types'

function generateTaskId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let id = ''
  for (let i = 0; i < 5; i++) id += chars[Math.floor(Math.random() * chars.length)]
  return id
}

async function uniqueTaskId(workspaceId: string): Promise<string> {
  let id = generateTaskId()
  while (true) {
    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('task_id', id)
    if ((count ?? 0) === 0) return id
    id = generateTaskId()
  }
}

const STATUS_LABEL: Record<string, string> = {
  open: '🔵 Aberta',
  in_progress: '🟡 Andamento',
  done: '✅ Concluída',
}

export async function criarTarefa(
  ctx: MsgContext,
  entities: ParsedIntent['entities']
): Promise<string> {
  if (!entities.titulo) {
    return '❌ Preciso do título da tarefa.\nEx: *criar tarefa* Revisar proposta para João até sexta'
  }

  // Busca responsável por nome (ou assume o criador se não informado / "eu")
  let assignee_id: string = ctx.memberId
  let assigneeName: string = ctx.memberName
  const respQuery = entities.responsavel?.toLowerCase()
  if (respQuery && respQuery !== 'eu' && respQuery !== 'mim') {
    const { data } = await supabase
      .from('members')
      .select('id, name')
      .eq('workspace_id', ctx.workspaceId)
      .eq('status', 'active')
      .ilike('name', `%${entities.responsavel}%`)
      .limit(1)
    if (data?.length) {
      assignee_id = data[0].id
      assigneeName = data[0].name
    }
  }

  // Busca grupo por nome ou pelo grupo do WhatsApp de onde veio a mensagem
  let group_id: string | null = null
  let groupName = ''
  if (entities.grupo) {
    const { data } = await supabase
      .from('groups')
      .select('id, name')
      .eq('workspace_id', ctx.workspaceId)
      .ilike('name', `%${entities.grupo}%`)
      .limit(1)
    if (data?.length) {
      group_id = data[0].id
      groupName = data[0].name
    }
  } else if (ctx.isGroup && ctx.groupWhatsappId) {
    const { data } = await supabase
      .from('groups')
      .select('id, name')
      .eq('workspace_id', ctx.workspaceId)
      .eq('whatsapp_group', ctx.groupWhatsappId)
      .single()
    if (data) {
      group_id = data.id
      groupName = data.name
    }
  }

  const task_id = await uniqueTaskId(ctx.workspaceId)

  const { error } = await supabase.from('tasks').insert({
    task_id,
    workspace_id: ctx.workspaceId,
    title: entities.titulo.trim(),
    assignee_id,
    group_id,
    created_by: ctx.memberId,
    due_date: entities.prazo ?? null,
    due_time: entities.hora ?? null,
    status: 'open',
  })

  if (error) {
    console.error('[criarTarefa]', error)
    return '❌ Erro ao criar tarefa. Tente novamente.'
  }

  let msg = `✅ Tarefa criada!\n\n🆔 *${task_id}*\n📋 ${entities.titulo}`
  if (assigneeName) msg += `\n👤 Responsável: ${assigneeName}`
  if (groupName)    msg += `\n👥 Grupo: ${groupName}`
  if (entities.prazo) {
    const dateOnly = entities.prazo.split('T')[0]
    msg += `\n📅 Prazo: ${new Date(dateOnly + 'T12:00:00').toLocaleDateString('pt-BR')}`
    if (entities.hora) msg += ` às ${entities.hora}`
  }
  return msg
}

export async function listarTarefas(
  ctx: MsgContext,
  entities: ParsedIntent['entities']
): Promise<string> {
  let query = supabase
    .from('tasks')
    .select(`
      task_id, title, status, due_date,
      assignee:members!tasks_assignee_id_fkey(name),
      group:groups(name)
    `)
    .eq('workspace_id', ctx.workspaceId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(10)

  if (entities.status_filtro && entities.status_filtro !== 'all') {
    query = query.eq('status', entities.status_filtro)
  } else {
    // padrão: abertas e em andamento
    query = query.in('status', ['open', 'in_progress'])
  }

  const { data: tasks } = await query

  if (!tasks?.length) return '📭 Nenhuma tarefa encontrada.'

  const today = new Date(); today.setHours(0, 0, 0, 0)

  let msg = `📋 *${tasks.length} tarefa${tasks.length !== 1 ? 's' : ''}*\n\n`
  for (const t of tasks) {
    const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
    const group    = Array.isArray(t.group)    ? t.group[0]    : t.group

    let prazoStr = ''
    if (t.due_date) {
      // Extrai só a parte da data (YYYY-MM-DD) independente do formato vindo do banco
      const dateOnly = t.due_date.split('T')[0]
      const d = new Date(dateOnly + 'T12:00:00')
      const today2 = new Date(); today2.setHours(0, 0, 0, 0)
      const diff = Math.round((d.getTime() - today2.getTime()) / 86400000)
      const dateFormatted = d.toLocaleDateString('pt-BR')
      if (diff < 0)        prazoStr = `⚠️ Atrasada (${dateFormatted})`
      else if (diff === 0) prazoStr = `🔴 Vence hoje`
      else if (diff === 1) prazoStr = `🟠 Vence amanhã`
      else                 prazoStr = `📅 ${dateFormatted}`
    }

    const emoji = t.status === 'in_progress' ? '🟡' : '🔵'
    msg += `${emoji} *${t.task_id}* — ${t.title}\n`
    if (assignee?.name) msg += `   👤 ${assignee.name}`
    if (group?.name)    msg += `  👥 ${group.name}`
    if (assignee?.name || group?.name) msg += '\n'
    if (prazoStr)       msg += `   ${prazoStr}\n`
    msg += '\n'
  }

  return msg.trim()
}

export async function concluirTarefa(
  ctx: MsgContext,
  entities: ParsedIntent['entities']
): Promise<string> {
  if (!entities.task_id) {
    return '❌ Informe o ID da tarefa.\nEx: *concluir* AB123'
  }

  const task_id = entities.task_id.toUpperCase()

  const { data: task } = await supabase
    .from('tasks')
    .select('id, title, status')
    .eq('workspace_id', ctx.workspaceId)
    .eq('task_id', task_id)
    .single()

  if (!task)              return `❌ Tarefa *${task_id}* não encontrada.`
  if (task.status === 'done') return `ℹ️ Tarefa *${task_id}* já estava concluída.`

  await supabase
    .from('tasks')
    .update({ status: 'done' })
    .eq('id', task.id)

  return `✅ *${task_id}* concluída!\n📋 ${task.title}`
}

export async function atualizarTarefa(
  ctx: MsgContext,
  entities: ParsedIntent['entities']
): Promise<string> {
  if (!entities.task_id) return '❌ Informe o ID da tarefa. Ex: *atualizar* AB123'

  const task_id = entities.task_id.toUpperCase()

  const { data: task } = await supabase
    .from('tasks')
    .select('id, title')
    .eq('workspace_id', ctx.workspaceId)
    .eq('task_id', task_id)
    .single()

  if (!task) return `❌ Tarefa *${task_id}* não encontrada.`

  const updates: Record<string, unknown> = {}
  let assigneeName = ''

  if (entities.novo_titulo)     updates.title    = entities.novo_titulo
  if (entities.novo_prazo)      updates.due_date = entities.novo_prazo.split('T')[0]
  if (entities.nova_hora)       updates.due_time = entities.nova_hora
  if (entities.novo_status)     updates.status   = entities.novo_status

  // Atualizar responsável por nome
  if (entities.novo_responsavel) {
    const respQuery = entities.novo_responsavel.toLowerCase()
    if (respQuery === 'eu' || respQuery === 'mim') {
      updates.assignee_id = ctx.memberId
      assigneeName = ctx.memberName
    } else {
      const { data } = await supabase
        .from('members')
        .select('id, name')
        .eq('workspace_id', ctx.workspaceId)
        .eq('status', 'active')
        .ilike('name', `%${entities.novo_responsavel}%`)
        .limit(1)
      if (data?.length) {
        updates.assignee_id = data[0].id
        assigneeName = data[0].name
      }
    }
  }

  if (!Object.keys(updates).length) {
    return '❌ Informe o que deseja atualizar.\nEx: *atualizar* AB123 responsável Ana\nEx: *atualizar* AB123 prazo sexta\nEx: *atualizar* AB123 status em andamento'
  }

  await supabase.from('tasks').update(updates).eq('id', task.id)

  let msg = `✏️ Tarefa *${task_id}* atualizada!\n`
  if (entities.novo_titulo)     msg += `📋 Novo título: ${entities.novo_titulo}\n`
  if (entities.novo_prazo)      msg += `📅 Novo prazo: ${new Date(entities.novo_prazo.split('T')[0] + 'T12:00:00').toLocaleDateString('pt-BR')}\n`
  if (entities.nova_hora)       msg += `🕐 Novo horário: ${entities.nova_hora}\n`
  if (entities.novo_status)     msg += `📊 Novo status: ${STATUS_LABEL[entities.novo_status]}\n`
  if (assigneeName)             msg += `👤 Novo responsável: ${assigneeName}\n`

  return msg.trim()
}
