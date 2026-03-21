import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Usa admin client para evitar problemas com RLS self-referencial
  const admin = createAdminClient()
  const { data: members } = await admin
    .from('members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)

  const member = members?.[0] ?? null
  if (!member) redirect('/onboarding')

  return (
    <div className="flex min-h-screen bg-[#f5f5f5]">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
