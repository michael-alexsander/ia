import { getGroups, getWorkspaceMembersForGroup } from '@/lib/actions/groups'
import { GroupList } from '@/components/groups/GroupList'

export default async function GroupsPage() {
  const [groups, members] = await Promise.all([getGroups(), getWorkspaceMembersForGroup()])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Grupos</h1>
        <p className="text-sm text-[#6b7280] mt-0.5">Gerencie os grupos vinculados ao WhatsApp</p>
      </div>
      <GroupList initialGroups={groups} allMembers={members} />
    </div>
  )
}
