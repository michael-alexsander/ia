import { getWorkspaceMembers } from '@/lib/actions/members'
import { MemberList } from '@/components/members/MemberList'

export default async function MembersPage() {
  const members = await getWorkspaceMembers()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Membros</h1>
        <p className="text-sm text-[#6b7280] mt-0.5">Gerencie os membros da sua equipe</p>
      </div>
      <MemberList initialMembers={members} />
    </div>
  )
}
