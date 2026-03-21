import cron from 'node-cron'
import { supabase } from './supabase'
import { sendText } from './evolution'

// BRT = UTC-3 → 8h BRT = 11h UTC
const LEMBRETE_DIARIO  = '0 11 * * *'   // todos os dias às 8h BRT
const RELATORIO_SEMANAL = '0 11 * * 1'  // segunda-feira às 8h BRT

export function iniciarCronJobs() {
  cron.schedule(LEMBRETE_DIARIO,   enviarLembretesPrazo,    { timezone: 'UTC' })
  cron.schedule(RELATORIO_SEMANAL, enviarRelatorioSemanal,  { timezone: 'UTC' })
  console.log('[cron] Jobs agendados: lembrete diário (8h BRT) + relatório semanal (seg 8h BRT)')
}

// ─── Lembrete diário ─────────────────────────────────────────────────────────

async function enviarLembretesPrazo() {
  console.log('[cron] Iniciando lembretes de prazo...')
  const hoje = new Date().toISOString().split('T')[0]

  // Busca tarefas que vencem hoje ou estão atrasadas
  const { data: tarefas } = await supabase
    .from('tasks')
    .select(`
      task_id, title, due_date, status,
      assignee:members!tasks_assignee_id_fkey(id, name, whatsapp_jid)
    `)
    .lte('due_date', hoje)
    .in('status', ['open', 'in_progress'])
    .not('assignee_id', 'is', null)

  if (!tarefas?.length) {
    console.log('[cron] Nenhuma tarefa para lembrar hoje.')
    return
  }

  // Agrupa por responsável
  const porMembro = new Map<string, {
    jid: string
    nome: string
    hoje: typeof tarefas
    atrasadas: typeof tarefas
  }>()

  for (const t of tarefas) {
    const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
    if (!assignee?.whatsapp_jid) continue

    if (!porMembro.has(assignee.id)) {
      porMembro.set(assignee.id, { jid: assignee.whatsapp_jid, nome: assignee.name, hoje: [], atrasadas: [] })
    }
    const entry = porMembro.get(assignee.id)!
    if (t.due_date === hoje) entry.hoje.push(t)
    else entry.atrasadas.push(t)
  }

  for (const { jid, nome, hoje: vencem, atrasadas } of porMembro.values()) {
    let msg = `📋 *Bom dia, ${nome}!*\n\n`

    if (vencem.length) {
      msg += `🔴 *Vencem hoje (${vencem.length}):*\n`
      for (const t of vencem) msg += `• *${t.task_id}* — ${t.title}\n`
      msg += '\n'
    }

    if (atrasadas.length) {
      msg += `⚠️ *Atrasadas (${atrasadas.length}):*\n`
      for (const t of atrasadas) {
        const d = new Date(t.due_date.split('T')[0] + 'T12:00:00').toLocaleDateString('pt-BR')
        msg += `• *${t.task_id}* — ${t.title} (${d})\n`
      }
      msg += '\n'
    }

    msg += `_Digite *listar tarefas* para ver todas._`

    try {
      await sendText(jid, msg)
      console.log(`[cron] Lembrete enviado para ${nome}`)
    } catch (err) {
      console.error(`[cron] Erro ao enviar para ${nome}:`, err)
    }
  }
}

// ─── Relatório semanal ────────────────────────────────────────────────────────

async function enviarRelatorioSemanal() {
  console.log('[cron] Iniciando relatório semanal...')

  const hoje = new Date()
  const inicioSemana = new Date(hoje)
  inicioSemana.setDate(hoje.getDate() - 7)
  const inicioStr = inicioSemana.toISOString().split('T')[0]
  const hojeStr   = hoje.toISOString().split('T')[0]

  // Busca todos os workspaces com membros admin ativos e vinculados
  const { data: admins } = await supabase
    .from('members')
    .select('id, name, whatsapp_jid, workspace_id')
    .eq('role', 'admin')
    .eq('status', 'active')
    .not('whatsapp_jid', 'is', null)

  if (!admins?.length) return

  // Para cada workspace, gera o relatório e envia para todos os admins
  const workspaceIds = [...new Set(admins.map(a => a.workspace_id))]

  for (const wsId of workspaceIds) {
    const wsAdmins = admins.filter(a => a.workspace_id === wsId)

    // Métricas da semana
    const [{ count: concluidas }, { count: abertas }, { count: atrasadas }] = await Promise.all([
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .eq('workspace_id', wsId).eq('status', 'done')
        .gte('updated_at', inicioStr),
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .eq('workspace_id', wsId).in('status', ['open', 'in_progress']),
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .eq('workspace_id', wsId).in('status', ['open', 'in_progress'])
        .lt('due_date', hojeStr),
    ])

    // Top 5 tarefas abertas mais antigas
    const { data: pendentes } = await supabase
      .from('tasks')
      .select('task_id, title, due_date, assignee:members!tasks_assignee_id_fkey(name)')
      .eq('workspace_id', wsId)
      .in('status', ['open', 'in_progress'])
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(5)

    const semanaLabel = `${new Date(inicioStr + 'T12:00:00').toLocaleDateString('pt-BR')} – ${new Date(hojeStr + 'T12:00:00').toLocaleDateString('pt-BR')}`

    let msg = `📊 *Relatório Semanal — TarefaApp*\n`
    msg += `_${semanaLabel}_\n\n`
    msg += `✅ Concluídas na semana: *${concluidas ?? 0}*\n`
    msg += `🔵 Em aberto: *${abertas ?? 0}*\n`
    msg += `⚠️ Atrasadas: *${atrasadas ?? 0}*\n`

    if (pendentes?.length) {
      msg += `\n📋 *Próximas tarefas:*\n`
      for (const t of pendentes) {
        const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
        const prazo = t.due_date
          ? new Date(t.due_date.split('T')[0] + 'T12:00:00').toLocaleDateString('pt-BR')
          : 'sem prazo'
        msg += `• *${t.task_id}* — ${t.title}`
        if (assignee?.name) msg += ` (${assignee.name})`
        msg += ` — ${prazo}\n`
      }
    }

    for (const admin of wsAdmins) {
      try {
        await sendText(admin.whatsapp_jid, msg)
        console.log(`[cron] Relatório semanal enviado para ${admin.name}`)
      } catch (err) {
        console.error(`[cron] Erro ao enviar relatório para ${admin.name}:`, err)
      }
    }
  }
}
