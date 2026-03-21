'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function getWorkspaceMember() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

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

export async function getSettings() {
  const member = await getWorkspaceMember()
  if (!member) return null

  const admin = createAdminClient()
  const { data } = await admin
    .from('agent_config')
    .select('*')
    .eq('workspace_id', member.workspace_id)
    .single()

  return data
}

export async function saveSettings(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const member = await getWorkspaceMember()
  if (!member || member.role !== 'admin') return { error: 'Sem permissão' }

  const updates = {
    report_daily:            formData.get('report_daily') === 'on',
    report_weekly:           formData.get('report_weekly') === 'on',
    report_monthly:          formData.get('report_monthly') === 'on',
    report_channel:          formData.get('report_channel') as string || 'whatsapp',
    report_morning_time:     formData.get('report_morning_time') as string || '08:00',
    report_evening_time:     formData.get('report_evening_time') as string || '18:00',
    reminder_hours_before:   parseInt(formData.get('reminder_hours_before') as string) || 2,
    alert_overdue_next_day:  formData.get('alert_overdue_next_day') === 'on',
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('agent_config')
    .update(updates)
    .eq('workspace_id', member.workspace_id)

  if (error) return { error: 'Erro ao salvar configurações' }

  revalidatePath('/settings')
  return { success: true }
}
