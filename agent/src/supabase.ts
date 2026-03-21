import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export { supabase }

// Busca membro pelo JID interno (whatsapp_jid) — campo que só o agent usa.
// O campo whatsapp continua sendo o número real visível para humanos.
export async function findMemberByPhone(jid: string) {
  const { data } = await supabase
    .from('members')
    .select('id, workspace_id, name, role, whatsapp, whatsapp_jid')
    .eq('whatsapp_jid', jid)
    .eq('status', 'active')
    .limit(1)
    .single()

  return data ?? null
}
