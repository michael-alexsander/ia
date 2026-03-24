import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DashboardShell } from '@/components/layout/DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Busca membro + workspace em uma única query
  const { data: member } = await admin
    .from('members')
    .select('workspace_id, role, email')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .single()

  if (!member) redirect('/onboarding')

  // Busca status e plano do workspace
  const { data: workspace } = await admin
    .from('workspaces')
    .select('name, plan, status')
    .eq('id', member.workspace_id)
    .single()

  // Busca email do admin (para membros não-admin verem contato)
  let adminEmail: string | null = null
  if (member.role !== 'admin' && workspace?.status === 'suspended') {
    const { data: adminMember } = await admin
      .from('members')
      .select('email')
      .eq('workspace_id', member.workspace_id)
      .eq('role', 'admin')
      .eq('status', 'active')
      .limit(1)
      .single()
    adminEmail = adminMember?.email ?? null
  }

  const userName  = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? undefined
  const userAvatar = user.user_metadata?.avatar_url as string | undefined

  return (
    <DashboardShell
      workspaceName={workspace?.name ?? ''}
      workspacePlan={(workspace?.plan ?? 'small') as 'small' | 'medium' | 'large'}
      workspaceStatus={(workspace?.status ?? 'active') as 'active' | 'inactive' | 'suspended'}
      userRole={member.role as 'admin' | 'member'}
      adminEmail={adminEmail}
      userName={userName}
      userAvatar={userAvatar}
    >
      {children}
    </DashboardShell>
  )
}
