import { getTasks, getMembers, getGroups, getCurrentMember } from '@/lib/actions/tasks'
import { TaskList } from '@/components/tasks/TaskList'

export default async function TasksPage() {
  const [tasks, members, groups, me] = await Promise.all([
    getTasks(), getMembers(), getGroups(), getCurrentMember()
  ])

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="mb-4 lg:mb-6">
        <h1 className="text-2xl font-bold">Tarefas</h1>
        <p className="text-sm text-[#6b7280] mt-0.5">Gerencie as tarefas da sua equipe</p>
      </div>
      <TaskList
        initialTasks={tasks}
        members={members}
        groups={groups}
        currentMemberId={me?.id ?? null}
      />
    </div>
  )
}
