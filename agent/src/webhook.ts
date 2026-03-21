import { Request, Response } from 'express'
import { findMemberByPhone } from './supabase'
import { parseMessage } from './parser'
import { handleIntent } from './handlers'
import { sendText } from './evolution'
import { MsgContext } from './types'
import { tryLinkByCode, tryLinkGroup } from './handlers'

const BOT_JID = process.env.BOT_JID! // ex: 553189507577@s.whatsapp.net
const BOT_LID = process.env.BOT_LID  // LID do bot no WhatsApp, ex: 50801628172409

function extractText(message: Record<string, unknown>): string {
  return (
    (message?.conversation as string) ||
    ((message?.extendedTextMessage as Record<string, unknown>)?.text as string) ||
    ((message?.imageMessage as Record<string, unknown>)?.caption as string) ||
    ''
  )
}

function isBotMentioned(message: Record<string, unknown>): boolean {
  const botPhone = BOT_JID.replace('@s.whatsapp.net', '')
  const text = extractText(message)

  // Checa menção via JID ou LID no texto
  if (text.includes(`@${botPhone}`)) return true
  if (BOT_LID && text.includes(`@${BOT_LID}`)) return true

  // Checa mentionedJid em extendedTextMessage
  const extMsg = message?.extendedTextMessage as Record<string, unknown> | undefined
  const ctxInfo = extMsg?.contextInfo as Record<string, unknown> | undefined
  const mentioned: string[] = (ctxInfo?.mentionedJid as string[]) ?? []
  if (mentioned.includes(BOT_JID)) return true
  if (BOT_LID && mentioned.some(j => j.includes(BOT_LID))) return true

  return false
}

function cleanMentions(text: string): string {
  return text.replace(/@\d+/g, '').replace(/\s+/g, ' ').trim()
}

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  // Responde imediatamente para não deixar a Evolution esperando
  res.status(200).json({ ok: true })

  try {
    const body = req.body

    // Só processa mensagens novas
    if (body.event !== 'messages.upsert') return

    const data = body.data
    if (!data) return

    // Ignora mensagens enviadas pelo próprio bot
    if (data.key?.fromMe === true) return

    const remoteJid: string = data.key?.remoteJid ?? ''
    const isGroup = remoteJid.endsWith('@g.us')
    const message: Record<string, unknown> = data.message ?? {}

    if (!message || Object.keys(message).length === 0) return

    // Em grupos: só responde se o bot foi mencionado com @
    if (isGroup && !isBotMentioned(message)) return

    let rawText = extractText(message)
    if (!rawText.trim()) return

    if (isGroup) rawText = cleanMentions(rawText)

    // Identifica o remetente
    const senderJid: string = isGroup
      ? (data.participant ?? data.key?.participant ?? '')
      : remoteJid

    const senderPhone = senderJid.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '')

    if (!senderPhone) return

    // Busca o membro no banco
    const member = await findMemberByPhone(senderPhone)
    if (!member) {
      // Número desconhecido — tenta vincular via código de convite
      const linkReply = await tryLinkByCode(senderPhone, rawText)
      if (linkReply) {
        await sendText(remoteJid, linkReply)
      } else {
        await sendText(remoteJid,
          `❓ Não reconheço seu número.\n\n` +
          `Se você foi convidado, envie o código de 6 letras/números que recebeu.\n` +
          `Se o código não funcionar, peça um novo convite ao administrador.`
        )
      }
      return
    }

    const ctx: MsgContext = {
      workspaceId:      member.workspace_id,
      memberId:         member.id,
      memberName:       member.name,
      memberRole:       member.role as 'admin' | 'member',
      senderPhone,
      remoteJid,
      isGroup,
      groupWhatsappId:  isGroup ? remoteJid : undefined,
      instanceName:     body.instance ?? '',
    }

    console.log(`[webhook] ${ctx.memberName} → "${rawText}"`)

    // Em grupos: intercepta código de vinculação LINK-XXXXX antes do OpenAI
    if (isGroup && /^LINK-[A-Z0-9]{5}$/i.test(rawText.trim())) {
      if (ctx.memberRole !== 'admin') {
        await sendText(remoteJid, `❌ Apenas administradores podem vincular grupos.`)
        return
      }
      const linkReply = await tryLinkGroup(remoteJid, rawText.trim(), ctx.memberId, ctx.workspaceId)
      await sendText(remoteJid, linkReply)
      return
    }

    // Processa com OpenAI
    const parsed = await parseMessage(rawText)
    console.log(`[webhook] intent: ${parsed.intent}`, parsed.entities)

    // Executa o handler e responde
    const reply = await handleIntent(ctx, parsed)
    await sendText(remoteJid, reply)

  } catch (err) {
    console.error('[webhook] erro:', err)
  }
}
