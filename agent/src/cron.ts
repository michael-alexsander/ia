import cron from 'node-cron'
import { supabase } from './supabase'
import { sendText } from './evolution'

// BRT = UTC-3 → 8h BRT = 11h UTC
const LEMBRETE_DIARIO   = '0 11 * * *'   // todos os dias às 8h BRT
const RELATORIO_SEMANAL = '0 11 * * 1'   // segunda-feira às 8h BRT
const RELATORIO_MENSAL  = '0 11 1 * *'   // dia 1 de cada mês às 8h BRT

export function iniciarCronJobs() {
  cron.schedule(LEMBRETE_DIARIO,   enviarLembretesPrazo,   { timezone: 'UTC' })
  cron.schedule(RELATORIO_SEMANAL, enviarRelatorioSemanal, { timezone: 'UTC' })
  cron.schedule(RELATORIO_MENSAL,  enviarRelatorioMensal,  { timezone: 'UTC' })
  console.log('[cron] Jobs agendados: lembrete diário + relatório semanal + relatório mensal')
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function somaData(base: Date, dias: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}

function formatarData(iso: string): string {
  return new Date(iso.split('T')[0] + 'T12:00:00').toLocaleDateString('pt-BR')
}

async function buscarAdminsVinculados() {
  const { data } = await supabase
    .from('members')
    .select('id, name, whatsapp_jid, workspace_id')
    .eq('role', 'admin')
    .eq('status', 'active')
    .not('whatsapp_jid', 'is', null)
  return data ?? []
}

// ─── Lembrete diário ─────────────────────────────────────────────────────────
// Envia para cada responsável:
//   - Tarefas que vencem em 2 dias (aviso antecipado)
//   - Tarefas que vencem hoje
//   - Tarefas atrasadas

async function enviarLembretesPrazo() {
  console.log('[cron] Iniciando lembretes de prazo...')

  const hoje      = new Date()
  const hojeStr   = somaData(hoje, 0)
  const em2Str    = somaData(hoje, 2)

  // Busca tudo de uma vez: atrasadas + hoje + em 2 dias
  const { data: tarefas } = await supabase
    .from('tasks')
    .select(`
      task_id, title, due_date, status,
      assignee:members!tasks_assignee_id_fkey(id, name, whatsapp_jid)
    `)
    .lte('due_date', em2Str)
    .in('status', ['open', 'in_progress'])
    .not('assignee_id', 'is', null)

  if (!tarefas?.length) {
    console.log('[cron] Nenhuma tarefa para lembrar hoje.')
    return
  }

  // Agrupa por responsável em 3 buckets
  type Bucket = { jid: string; nome: string; antecipadas: typeof tarefas; hoje: typeof tarefas; atrasadas: typeof tarefas }
  const porMembro = new Map<string, Bucket>()

  for (const t of tarefas) {
    const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
    if (!assignee?.whatsapp_jid) continue

    if (!porMembro.has(assignee.id)) {
      porMembro.set(assignee.id, { jid: assignee.whatsapp_jid, nome: assignee.name, antecipadas: [], hoje: [], atrasadas: [] })
    }
    const entry = porMembro.get(assignee.id)!
    const prazo = t.due_date.split('T')[0]

    if (prazo > hojeStr)      entry.antecipadas.push(t)
    else if (prazo === hojeStr) entry.hoje.push(t)
    else                       entry.atrasadas.push(t)
  }

  for (const { jid, nome, antecipadas, hoje: vencem, atrasadas } of porMembro.values()) {
    // Só envia se há algo relevante
    if (!antecipadas.length && !vencem.length && !atrasadas.length) continue

    let msg = `📋 *Bom dia, ${nome}!*\n`

    if (vencem.length) {
      msg += `\n🔴 *Vencem hoje (${vencem.length}):*\n`
      for (const t of vencem) msg += `• *${t.task_id}* — ${t.title}\n`
    }

    if (atrasadas.length) {
      msg += `\n⚠️ *Atrasadas (${atrasadas.length}):*\n`
      for (const t of atrasadas) msg += `• *${t.task_id}* — ${t.title} (${formatarData(t.due_date)})\n`
    }

    if (antecipadas.length) {
      msg += `\n🟡 *Vencem em 2 dias (${antecipadas.length}):*\n`
      for (const t of antecipadas) msg += `• *${t.task_id}* — ${t.title}\n`
    }

    msg += `\n_Digite *listar tarefas* para ver todas._`

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

  const admins = await buscarAdminsVinculados()
  if (!admins.length) return

  const hoje      = new Date()
  const hojeStr   = somaData(hoje, 0)
  const inicioStr = somaData(hoje, -7)

  const workspaceIds = [...new Set(admins.map(a => a.workspace_id))]

  for (const wsId of workspaceIds) {
    const wsAdmins = admins.filter(a => a.workspace_id === wsId)

    const [{ count: concluidas }, { count: abertas }, { count: atrasadas }] = await Promise.all([
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .eq('workspace_id', wsId).eq('status', 'done').gte('updated_at', inicioStr),
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .eq('workspace_id', wsId).in('status', ['open', 'in_progress']),
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .eq('workspace_id', wsId).in('status', ['open', 'in_progress']).lt('due_date', hojeStr),
    ])

    const { data: pendentes } = await supabase
      .from('tasks')
      .select('task_id, title, due_date, assignee:members!tasks_assignee_id_fkey(name)')
      .eq('workspace_id', wsId)
      .in('status', ['open', 'in_progress'])
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(5)

    let msg = `📊 *Relatório Semanal — TarefaApp*\n`
    msg += `_${formatarData(inicioStr)} – ${formatarData(hojeStr)}_\n\n`
    msg += `✅ Concluídas na semana: *${concluidas ?? 0}*\n`
    msg += `🔵 Em aberto: *${abertas ?? 0}*\n`
    msg += `⚠️ Atrasadas: *${atrasadas ?? 0}*\n`

    if (pendentes?.length) {
      msg += `\n📋 *Próximas tarefas:*\n`
      for (const t of pendentes) {
        const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
        const prazo = t.due_date ? formatarData(t.due_date) : 'sem prazo'
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

// ─── Relatório mensal de produtividade ───────────────────────────────────────

async function enviarRelatorioMensal() {
  console.log('[cron] Iniciando relatório mensal...')

  const admins = await buscarAdminsVinculados()
  if (!admins.length) return

  const agora   = new Date()
  const mesAtual = agora.getMonth()         // 0-11
  const anoAtual = agora.getFullYear()

  // Mês anterior
  const mesPrev  = mesAtual === 0 ? 11 : mesAtual - 1
  const anoPrev  = mesAtual === 0 ? anoAtual - 1 : anoAtual
  const inicioMes = `${anoPrev}-${String(mesPrev + 1).padStart(2, '0')}-01`
  const fimMes    = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-01` // início do mês atual = fim do anterior

  const nomesMeses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const labelMes = `${nomesMeses[mesPrev]}/${anoPrev}`

  const workspaceIds = [...new Set(admins.map(a => a.workspace_id))]

  for (const wsId of workspaceIds) {
    const wsAdmins = admins.filter(a => a.workspace_id === wsId)

    // Métricas gerais do mês
    const [{ count: criadas }, { count: concluidas }, { count: atrasadas }] = await Promise.all([
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .eq('workspace_id', wsId).gte('created_at', inicioMes).lt('created_at', fimMes),
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .eq('workspace_id', wsId).eq('status', 'done')
        .gte('updated_at', inicioMes).lt('updated_at', fimMes),
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .eq('workspace_id', wsId).in('status', ['open', 'in_progress'])
        .lt('due_date', fimMes).gte('due_date', inicioMes),
    ])

    const total     = criadas ?? 0
    const done      = concluidas ?? 0
    const taxa      = total > 0 ? Math.round((done / total) * 100) : 0

    // Produtividade por membro (top 5 que mais concluíram)
    const { data: porMembro } = await supabase
      .from('tasks')
      .select('assignee:members!tasks_assignee_id_fkey(name)')
      .eq('workspace_id', wsId)
      .eq('status', 'done')
      .gte('updated_at', inicioMes)
      .lt('updated_at', fimMes)
      .not('assignee_id', 'is', null)

    const contagem = new Map<string, number>()
    for (const t of porMembro ?? []) {
      const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
      if (assignee?.name) contagem.set(assignee.name, (contagem.get(assignee.name) ?? 0) + 1)
    }
    const ranking = [...contagem.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    let msg = `🏆 *Relatório Mensal — ${labelMes}*\n\n`
    msg += `📌 *Resumo do mês:*\n`
    msg += `• Tarefas criadas: *${total}*\n`
    msg += `• Concluídas: *${done}*\n`
    msg += `• Taxa de conclusão: *${taxa}%*\n`
    msg += `• Atrasadas no período: *${atrasadas ?? 0}*\n`

    if (ranking.length) {
      msg += `\n🥇 *Top produtividade:*\n`
      const medalhas = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']
      ranking.forEach(([nome, qt], i) => {
        msg += `${medalhas[i]} ${nome}: *${qt}* tarefa${qt !== 1 ? 's' : ''} concluída${qt !== 1 ? 's' : ''}\n`
      })
    }

    // Tarefas ainda abertas herdadas do mês anterior
    const { count: pendentes } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', wsId)
      .in('status', ['open', 'in_progress'])

    msg += `\n📂 Tarefas em aberto agora: *${pendentes ?? 0}*\n`
    msg += `\n_Bom trabalho no próximo mês! 💪_`

    for (const admin of wsAdmins) {
      try {
        await sendText(admin.whatsapp_jid, msg)
        console.log(`[cron] Relatório mensal enviado para ${admin.name}`)
      } catch (err) {
        console.error(`[cron] Erro ao enviar relatório mensal para ${admin.name}:`, err)
      }
    }
  }
}
