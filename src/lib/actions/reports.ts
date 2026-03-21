'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'TarefaApp <onboarding@resend.dev>'

async function getWorkspaceMember() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: member } = await admin
    .from('members')
    .select('id, workspace_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .single()
  return member ?? null
}

export async function sendReport(params: {
  memberIds: string[]
  channel: 'whatsapp' | 'email' | 'both'
  filename: string
  pdfBase64: string
}): Promise<{ error?: string; success?: boolean; sent?: number }> {
  const me = await getWorkspaceMember()
  if (!me) return { error: 'Sem permissão — usuário não autenticado ou sem membro ativo' }

  const admin = createAdminClient()
  const { data: members } = await admin
    .from('members')
    .select('id, name, email, whatsapp')
    .in('id', params.memberIds)
    .eq('workspace_id', me.workspace_id)

  if (!members?.length) return { error: 'Nenhum destinatário encontrado' }

  const { channel, filename, pdfBase64 } = params
  const url      = process.env.EVOLUTION_URL
  const apikey   = process.env.EVOLUTION_API_KEY
  const instance = process.env.EVOLUTION_INSTANCE

  let sent = 0
  const errors: string[] = []

  for (const member of members) {
    // WhatsApp
    if ((channel === 'whatsapp' || channel === 'both') && member.whatsapp) {
      try {
        const phone = member.whatsapp.replace(/\D/g, '')
        const res = await fetch(`${url}/message/sendMedia/${instance}`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', apikey: apikey! },
          body: JSON.stringify({
            number:    phone,
            mediatype: 'document',
            mimetype:  'application/pdf',
            media:     `data:application/pdf;base64,${pdfBase64}`,
            fileName:  filename,
            caption:   '📊 Relatório de Tarefas',
          }),
        })
        if (res.ok) {
          sent++
        } else {
          const body = await res.text()
          errors.push(`WPP ${member.name}: ${res.status} ${body.slice(0, 100)}`)
        }
      } catch (err) {
        errors.push(`WPP ${member.name}: ${String(err).slice(0, 100)}`)
      }
    } else if ((channel === 'whatsapp' || channel === 'both') && !member.whatsapp) {
      errors.push(`WPP ${member.name}: sem número cadastrado`)
    }

    // E-mail
    if ((channel === 'email' || channel === 'both') && member.email) {
      try {
        const { error: resendError } = await resend.emails.send({
          from:    FROM,
          to:      member.email,
          subject: `📊 Relatório de Tarefas — ${new Date().toLocaleDateString('pt-BR')}`,
          html:    `<p>Olá, ${member.name}!</p><p>Segue em anexo o relatório de tarefas.</p>`,
          attachments: [{ filename, content: Buffer.from(pdfBase64, 'base64') }],
        })
        if (resendError) {
          errors.push(`Email ${member.name}: ${resendError.message}`)
        } else {
          sent++
        }
      } catch (err) {
        errors.push(`Email ${member.name}: ${String(err).slice(0, 100)}`)
      }
    } else if ((channel === 'email' || channel === 'both') && !member.email) {
      errors.push(`Email ${member.name}: sem e-mail cadastrado`)
    }
  }

  if (sent === 0) {
    return { error: errors.length ? errors.join(' | ') : 'Falha no envio — verifique os contatos cadastrados' }
  }

  return { success: true, sent }
}
