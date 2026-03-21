'use server'

export async function sendReport(_params: {
  memberIds: string[]
  channel: 'whatsapp' | 'email' | 'both'
  filename: string
}): Promise<{ error?: string; success?: boolean }> {
  // TODO: conectar ao Agente WhatsApp (Evolution API) e serviço de e-mail
  // quando o Agent Server estiver configurado no VPS
  return {
    error: 'Envio automático estará disponível quando o Agente WhatsApp estiver ativo. O PDF já foi baixado para seus downloads.',
  }
}
