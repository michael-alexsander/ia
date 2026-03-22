import cron from 'node-cron'
import { supabase } from './supabase'
import { sendText } from './evolution'

export function iniciarCronJobs() {
  // Verifica relatórios a cada hora (respeita horário configurado por workspace)
  cron.schedule('0 * * * *',    verificarRelatoriosHorarios, { timezone: 'UTC' })
  // Verifica lembretes de tarefa a cada 30 min
  cron.schedule('*/30 * * * *', verificarLembretesTask,      { timezone: 'UTC' })
  console.log('[cron] Jobs agendados: relatórios (a cada hora) + lembretes de tarefa (a cada 30min)')
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function horaBRT(): number {
  return (new Date().getUTCHours() - 3 + 24) % 24
}

function somaData(base: Date, dias: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}

function formatarData(iso: string): string {
  return new Date(iso.split('T')[0] + 'T12:00:00').toLocaleDateString('pt-BR')
}

// Remove '+' e retorna só dígitos — formato que a Evolution API espera
function toPhone(w: string): string {
  return w.replace(/\D/g, '')
}

// ─── Dispatcher horário ───────────────────────────────────────────────────────
// Roda a cada hora e verifica por workspace qual job deve disparar

async function verificarRelatoriosHorarios() {
  const hora = horaBRT()
  const agora = new Date()
  const diaSemana = agora.getUTCDay() // 0=Dom 1=Seg
  const diaMes    = agora.getUTCDate()

  const { data: configs } = await supabase
    .from('agent_config')
    .select('workspace_id, report_daily, report_weekly, report_monthly, report_morning_time, report_evening_time')

  for (const cfg of configs ?? []) {
    const morningH = parseInt((cfg.report_morning_time as string).split(':')[0])
    const eveningH = parseInt((cfg.report_evening_time as string).split(':')[0])

    if (hora === morningH) {
      if (cfg.report_daily)                        await enviarLembretesPrazo(cfg.workspace_id)
      if (cfg.report_weekly  && diaSemana === 1)   await enviarRelatorioSemanal(cfg.workspace_id)
      if (cfg.report_monthly && diaMes    === 1)   await enviarRelatorioMensal(cfg.workspace_id)
    }

    if (hora === eveningH && cfg.report_daily) {
      await enviarResumoConcluidos(cfg.workspace_id)
    }
  }
}

// ─── Lembrete de tarefa (X horas antes do horário) ───────────────────────────
// Roda a cada 30 min — envia aviso quando faltam X horas para o vencimento

async function verificarLembretesTask() {
  const { data: configs } = await supabase
    .from('agent_config')
    .select('workspace_id, reminder_hours_before')

  for (const cfg of configs ?? []) {
    const horasAntes = cfg.reminder_hours_before ?? 2
    if (!horasAntes) continue

    // Momento alvo = agora + X horas, convertido para BRT
    const agora = new Date()
    const alvoUTC  = new Date(agora.getTime() + horasAntes * 60 * 60 * 1000)
    const alvoBRT  = new Date(alvoUTC.getTime() - 3 * 60 * 60 * 1000)

    const dataAlvo = alvoBRT.toISOString().split('T')[0]
    const horaAlvo = alvoBRT.getUTCHours()
    const minAlvo  = alvoBRT.getUTCMinutes()

    // Janela de ±15 min
    const pad  = (n: number) => String(n).padStart(2, '0')
    const tMin = `${pad(horaAlvo)}:${pad(Math.max(0,  minAlvo - 15))}`
    const tMax = `${pad(horaAlvo)}:${pad(Math.min(59, minAlvo + 15))}`

    const { data: tarefas } = await supabase
      .from('tasks')
      .select(`
        id, task_id, title, due_date, due_time,
        assignee:members!tasks_assignee_id_fkey(name, whatsapp)
      `)
      .eq('workspace_id', cfg.workspace_id)
      .eq('due_date', dataAlvo)
      .gte('due_time', tMin)
      .lte('due_time', tMax)
      .in('status', ['open', 'in_progress'])
      .is('reminded_at', null)
      .not('due_time', 'is', null)

    for (const t of tarefas ?? []) {
      const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
      if (!assignee?.whatsapp) continue

      const horaMarcada = (t.due_time as string).slice(0, 5)
      const msg =
        `⏰ *Lembrete de tarefa!*\n\n` +
        `*${t.task_id}* — ${t.title}\n` +
        `📅 Vence hoje às *${horaMarcada}* (em ${horasAntes}h)\n\n` +
        `_Conclua a tempo!_`

      try {
        await sendText(toPhone(assignee.whatsapp), msg)
        await supabase.from('tasks').update({ reminded_at: new Date().toISOString() }).eq('id', t.id)
        console.log(`[cron] Lembrete enviado: ${t.task_id} → ${assignee.name}`)
      } catch (err) {
        console.error(`[cron] Erro no lembrete de tarefa:`, err)
      }
    }
  }
}

// ─── Lembrete diário manhã ────────────────────────────────────────────────────
// Membros recebem apenas suas próprias tarefas.
// Admins recebem visão completa da equipe (todas as tarefas de todos os membros).

async function enviarLembretesPrazo(workspaceId: string) {
  console.log(`[cron] Lembretes manhã — workspace ${workspaceId}`)

  const hoje    = new Date()
  const hojeStr = somaData(hoje, 0)
  const em2Str  = somaData(hoje, 2)

  // Inclui role para diferenciar admin de membro
  const { data: tarefas } = await supabase
    .from('tasks')
    .select(`
      task_id, title, due_date, status,
      assignee:members!tasks_assignee_id_fkey(id, name, whatsapp, role)
    `)
    .eq('workspace_id', workspaceId)
    .lte('due_date', em2Str)
    .in('status', ['open', 'in_progress'])
    .not('assignee_id', 'is', null)

  if (!tarefas?.length) return

  type Bucket = {
    jid: string; nome: string; role: string
    antecipadas: typeof tarefas; hoje: typeof tarefas; atrasadas: typeof tarefas
  }
  const porMembro = new Map<string, Bucket>()

  for (const t of tarefas) {
    const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
    if (!assignee?.whatsapp) continue

    if (!porMembro.has(assignee.id)) {
      porMembro.set(assignee.id, {
        jid: toPhone(assignee.whatsapp),
        nome: assignee.name,
        role: assignee.role ?? 'member',
        antecipadas: [], hoje: [], atrasadas: [],
      })
    }
    const entry = porMembro.get(assignee.id)!
    const prazo = t.due_date.split('T')[0]

    if (prazo > hojeStr)        entry.antecipadas.push(t)
    else if (prazo === hojeStr) entry.hoje.push(t)
    else                        entry.atrasadas.push(t)
  }

  for (const { jid, nome, role, antecipadas, hoje: vencem, atrasadas } of porMembro.values()) {
    if (!antecipadas.length && !vencem.length && !atrasadas.length) continue

    let msg: string

    if (role === 'admin') {
      // Admin: visão completa da equipe (todas as tarefas de todos os membros)
      msg = `📋 *Bom dia, ${nome}!* — Visão da equipe:\n`

      if (atrasadas.length) {
        msg += `\n⚠️ *Atrasadas (${atrasadas.length}):*\n`
        for (const t of atrasadas) {
          const a = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
          msg += `• [${a?.name ?? '?'}] *${t.task_id}* — ${t.title} (${formatarData(t.due_date)})\n`
        }
      }
      if (vencem.length) {
        msg += `\n🔴 *Vencem hoje (${vencem.length}):*\n`
        for (const t of vencem) {
          const a = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
          msg += `• [${a?.name ?? '?'}] *${t.task_id}* — ${t.title}\n`
        }
      }
      if (antecipadas.length) {
        msg += `\n🟡 *Vencem em 2 dias (${antecipadas.length}):*\n`
        for (const t of antecipadas) {
          const a = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
          msg += `• [${a?.name ?? '?'}] *${t.task_id}* — ${t.title}\n`
        }
      }
      msg += `\n_Visão completa em app.tarefa.app_`
    } else {
      // Membro: apenas suas próprias tarefas
      msg = `📋 *Bom dia, ${nome}!*\n`

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
    }

    try {
      await sendText(jid, msg)
      console.log(`[cron] Lembrete manhã enviado para ${nome} (${role})`)
    } catch (err) {
      console.error(`[cron] Erro ao enviar para ${nome}:`, err)
    }
  }
}

// ─── Resumo noturno ───────────────────────────────────────────────────────────
// Membros recebem apenas seu próprio resumo.
// Admins recebem resumo completo da equipe (todos os membros).

async function enviarResumoConcluidos(workspaceId: string) {
  console.log(`[cron] Resumo noturno — workspace ${workspaceId}`)

  const hoje      = new Date()
  const hojeStr   = somaData(hoje, 0)
  const amanhaStr = somaData(hoje, 1)

  const { data: membros } = await supabase
    .from('members')
    .select('id, name, whatsapp, role')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .not('whatsapp', 'is', null)

  if (!membros?.length) return

  // Busca dados de todos os membros de uma vez para o relatório do admin
  const todosIds = membros.map(m => m.id)
  const [{ data: todasConcluidas }, { data: todasAbertas }] = await Promise.all([
    supabase.from('tasks').select('task_id, title, assignee_id')
      .eq('workspace_id', workspaceId)
      .eq('status', 'done')
      .in('assignee_id', todosIds)
      .gte('updated_at', hojeStr).lt('updated_at', amanhaStr),
    supabase.from('tasks').select('task_id, title, due_date, assignee_id')
      .eq('workspace_id', workspaceId)
      .in('status', ['open', 'in_progress'])
      .in('assignee_id', todosIds)
      .order('due_date', { ascending: true, nullsFirst: false }),
  ])

  for (const membro of membros) {
    let msg: string

    if (membro.role === 'admin') {
      // Admin: resumo completo de toda a equipe
      msg = `🌙 *Boa noite, ${membro.name}!* — Resumo da equipe:\n`

      const totalConcluidas = todasConcluidas?.length ?? 0
      const totalAbertas    = todasAbertas?.length ?? 0

      msg += `\n✅ *Concluídas hoje: ${totalConcluidas}*\n`
      for (const m of membros) {
        const qt = todasConcluidas?.filter(t => t.assignee_id === m.id).length ?? 0
        if (qt > 0) msg += `• ${m.name}: ${qt} tarefa${qt > 1 ? 's' : ''}\n`
      }

      const semConclusao = membros.filter(m =>
        !(todasConcluidas?.some(t => t.assignee_id === m.id))
      )
      if (semConclusao.length) {
        msg += `\n⚡ *Sem conclusão hoje:*\n`
        for (const m of semConclusao) {
          const abertas = todasAbertas?.filter(t => t.assignee_id === m.id).length ?? 0
          if (abertas > 0) msg += `• ${m.name} (${abertas} em aberto)\n`
        }
      }

      msg += `\n📂 *Total em aberto na equipe: ${totalAbertas}*`
      msg += `\n\n_Visão completa em app.tarefa.app_`
    } else {
      // Membro: apenas seu próprio resumo
      const concluidas = todasConcluidas?.filter(t => t.assignee_id === membro.id) ?? []
      const abertas    = todasAbertas?.filter(t => t.assignee_id === membro.id).slice(0, 5) ?? []

      if (!concluidas.length && !abertas.length) continue

      msg = `🌙 *Boa noite, ${membro.name}!*\n_Resumo do seu dia:_\n`

      if (concluidas.length) {
        msg += `\n✅ *Concluídas hoje (${concluidas.length}):*\n`
        for (const t of concluidas) msg += `• *${t.task_id}* — ${t.title}\n`
      } else {
        msg += `\n_Nenhuma tarefa concluída hoje._\n`
      }

      if (abertas.length) {
        msg += `\n📋 *Ainda em aberto:*\n`
        for (const t of abertas) {
          const prazo = t.due_date ? ` — ${formatarData(t.due_date)}` : ''
          msg += `• *${t.task_id}* — ${t.title}${prazo}\n`
        }
      }

      msg += `\n_Até amanhã! 💪_`
    }

    try {
      await sendText(toPhone(membro.whatsapp), msg)
      console.log(`[cron] Resumo noturno enviado para ${membro.name} (${membro.role})`)
    } catch (err) {
      console.error(`[cron] Erro no resumo noturno para ${membro.name}:`, err)
    }
  }
}

// ─── Relatório semanal ────────────────────────────────────────────────────────

async function enviarRelatorioSemanal(workspaceId: string) {
  console.log(`[cron] Relatório semanal — workspace ${workspaceId}`)

  const hoje      = new Date()
  const hojeStr   = somaData(hoje, 0)
  const inicioStr = somaData(hoje, -7)

  const { data: admins } = await supabase
    .from('members').select('name, whatsapp')
    .eq('workspace_id', workspaceId).eq('role', 'admin')
    .eq('status', 'active').not('whatsapp', 'is', null)

  if (!admins?.length) return

  const [{ count: concluidas }, { count: abertas }, { count: atrasadas }] = await Promise.all([
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).eq('status', 'done').gte('updated_at', inicioStr),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).in('status', ['open', 'in_progress']),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).in('status', ['open', 'in_progress']).lt('due_date', hojeStr),
  ])

  const { data: pendentes } = await supabase
    .from('tasks')
    .select('task_id, title, due_date, assignee:members!tasks_assignee_id_fkey(name)')
    .eq('workspace_id', workspaceId).in('status', ['open', 'in_progress'])
    .order('due_date', { ascending: true, nullsFirst: false }).limit(5)

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

  for (const admin of admins) {
    try {
      await sendText(toPhone(admin.whatsapp), msg)
      console.log(`[cron] Relatório semanal enviado para ${admin.name}`)
    } catch (err) {
      console.error(`[cron] Erro no relatório semanal para ${admin.name}:`, err)
    }
  }
}

// ─── Relatório mensal ─────────────────────────────────────────────────────────

async function enviarRelatorioMensal(workspaceId: string) {
  console.log(`[cron] Relatório mensal — workspace ${workspaceId}`)

  const agora    = new Date()
  const mesAtual = agora.getMonth()
  const anoAtual = agora.getFullYear()
  const mesPrev  = mesAtual === 0 ? 11 : mesAtual - 1
  const anoPrev  = mesAtual === 0 ? anoAtual - 1 : anoAtual
  const inicioMes = `${anoPrev}-${String(mesPrev + 1).padStart(2, '0')}-01`
  const fimMes    = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-01`

  const nomesMeses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const labelMes = `${nomesMeses[mesPrev]}/${anoPrev}`

  const { data: admins } = await supabase
    .from('members').select('name, whatsapp')
    .eq('workspace_id', workspaceId).eq('role', 'admin')
    .eq('status', 'active').not('whatsapp', 'is', null)

  if (!admins?.length) return

  const [{ count: criadas }, { count: concluidas }, { count: atrasadas }] = await Promise.all([
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).gte('created_at', inicioMes).lt('created_at', fimMes),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).eq('status', 'done')
      .gte('updated_at', inicioMes).lt('updated_at', fimMes),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).in('status', ['open', 'in_progress'])
      .lt('due_date', fimMes).gte('due_date', inicioMes),
  ])

  const total = criadas ?? 0
  const done  = concluidas ?? 0
  const taxa  = total > 0 ? Math.round((done / total) * 100) : 0

  const { data: porMembro } = await supabase
    .from('tasks')
    .select('assignee:members!tasks_assignee_id_fkey(name)')
    .eq('workspace_id', workspaceId).eq('status', 'done')
    .gte('updated_at', inicioMes).lt('updated_at', fimMes)
    .not('assignee_id', 'is', null)

  const contagem = new Map<string, number>()
  for (const t of porMembro ?? []) {
    const assignee = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee
    if (assignee?.name) contagem.set(assignee.name, (contagem.get(assignee.name) ?? 0) + 1)
  }
  const ranking = [...contagem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  const { count: pendentes } = await supabase
    .from('tasks').select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId).in('status', ['open', 'in_progress'])

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

  msg += `\n📂 Tarefas em aberto agora: *${pendentes ?? 0}*\n`
  msg += `\n_Bom trabalho no próximo mês! 💪_`

  for (const admin of admins) {
    try {
      await sendText(toPhone(admin.whatsapp), msg)
      console.log(`[cron] Relatório mensal enviado para ${admin.name}`)
    } catch (err) {
      console.error(`[cron] Erro no relatório mensal para ${admin.name}:`, err)
    }
  }
}
