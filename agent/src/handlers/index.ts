import { MsgContext, ParsedIntent } from '../types'
import { criarTarefa, listarTarefas, concluirTarefa, atualizarTarefa } from './tasks'
import { supabase } from '../supabase'

const HELP_MSG = `👋 *TarefaApp — Comandos*

📋 *Tarefas*
• *criar tarefa* [título] — cria uma nova tarefa
• *listar tarefas* — vê as tarefas abertas
• *concluir* [ID] — marca como concluída
• *atualizar* [ID] — edita uma tarefa

💡 *Exemplos:*
• criar tarefa Revisar proposta para João até sexta
• criar tarefa Reunião de alinhamento responsável Ana grupo Vendas
• listar tarefas
• concluir AB123
• atualizar AB123 novo prazo segunda`

// Tenta vincular um JID desconhecido via código de convite.
// O token é gerado no web app e enviado automaticamente via WhatsApp para o novo membro.
// Quando o membro envia o código, o agent grava o JID em whatsapp_jid e ativa a conta.
export async function tryLinkByCode(jid: string, text: string): Promise<string | null> {
  const token = text.trim().toUpperCase().replace(/\s+/g, '')
  if (token.length < 4) return null

  const { data: invite, error: inviteErr } = await supabase
    .from('invites')
    .select('id, workspace_id, email, whatsapp, role')
    .eq('token', token)
    .eq('accepted', false)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .single()

  if (inviteErr || !invite) {
    console.log(`[link] token "${token}" não encontrado ou expirado`, inviteErr?.message)
    return null
  }

  // Encontra o membro — busca separada por whatsapp e email para evitar
  // problemas de encoding do '+' no filtro .or() do PostgREST
  let member: { id: string; name: string } | null = null

  if (invite.whatsapp) {
    const { data, error } = await supabase
      .from('members')
      .select('id, name')
      .eq('workspace_id', invite.workspace_id)
      .eq('status', 'invited')
      .eq('whatsapp', invite.whatsapp)
      .limit(1)
      .single()
    if (error) console.log(`[link] busca por whatsapp falhou:`, error.message)
    if (data) member = data
  }

  if (!member && invite.email) {
    const { data, error } = await supabase
      .from('members')
      .select('id, name')
      .eq('workspace_id', invite.workspace_id)
      .eq('status', 'invited')
      .eq('email', invite.email)
      .limit(1)
      .single()
    if (error) console.log(`[link] busca por email falhou:`, error.message)
    if (data) member = data
  }

  if (!member) {
    console.log(`[link] membro convidado não encontrado para token "${token}" — wpp: ${invite.whatsapp} email: ${invite.email}`)
    return null
  }

  // Grava o JID interno e ativa o membro
  await Promise.all([
    supabase.from('members').update({ whatsapp_jid: jid, status: 'active' }).eq('id', member.id),
    supabase.from('invites').update({ accepted: true }).eq('id', invite.id),
  ])

  console.log(`[link] ${member.name} ativado — JID: ${jid}`)
  return (
    `✅ Olá, *${member.name}*! Sua conta foi ativada com sucesso!\n\n` +
    `Agora você pode gerenciar suas tarefas aqui pelo WhatsApp.\n\n` +
    `Para acessar o painel web, entre em:\n` +
    `🔗 app.tarefa.app/login\n\n` +
    `Digite *ajuda* para ver os comandos disponíveis.`
  )
}

// Vincula um grupo do WhatsApp a um grupo do TarefaApp via link_code
export async function tryLinkGroup(
  groupJid: string,
  linkCode: string,
  memberId: string,
  workspaceId: string
): Promise<string> {
  const code = linkCode.trim().toUpperCase()

  const { data: group } = await supabase
    .from('groups')
    .select('id, name, workspace_id, whatsapp_group')
    .eq('link_code', code)
    .eq('workspace_id', workspaceId)
    .limit(1)
    .single()

  if (!group) {
    return `❌ Código *${code}* inválido. Verifique o código no app web e tente novamente.`
  }

  if (group.whatsapp_group) {
    return `⚠️ O grupo *${group.name}* já está vinculado a um grupo do WhatsApp.`
  }

  await supabase
    .from('groups')
    .update({ whatsapp_group: groupJid, linked_at: new Date().toISOString() })
    .eq('id', group.id)

  console.log(`[link-group] grupo "${group.name}" vinculado — JID: ${groupJid}`)
  return `✅ Grupo *${group.name}* vinculado com sucesso!\nAgora posso receber comandos aqui. Mencione *@TarefaApp ajuda* para ver o que posso fazer.`
}

export async function handleIntent(
  ctx: MsgContext,
  parsed: ParsedIntent
): Promise<string> {
  switch (parsed.intent) {
    case 'criar_tarefa':
      return criarTarefa(ctx, parsed.entities)
    case 'listar_tarefas':
      return listarTarefas(ctx, parsed.entities)
    case 'concluir_tarefa':
      return concluirTarefa(ctx, parsed.entities)
    case 'atualizar_tarefa':
      return atualizarTarefa(ctx, parsed.entities)
    case 'ajuda':
      return HELP_MSG
    default:
      return `🤔 Não entendi. Digite *ajuda* para ver os comandos disponíveis.`
  }
}
