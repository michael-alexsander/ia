import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DashboardShell } from '@/components/layout/DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: members } = await admin
    .from('members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)

  const member = members?.[0] ?? null
  if (!member) redirect('/onboarding')

  return <DashboardShell>{children}</DashboardShell>
}
