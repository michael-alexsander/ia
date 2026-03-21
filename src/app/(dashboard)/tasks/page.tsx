import { getTasks, getMembers, getGroups } from '@/lib/actions/tasks'
import { TaskList } from '@/components/tasks/TaskList'

export default async function TasksPage() {
  const [tasks, members, groups] = await Promise.all([getTasks(), getMembers(), getGroups()])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Tarefas</h1>
        <p className="text-sm text-[#6b7280] mt-0.5">Gerencie as tarefas da sua equipe</p>
      </div>
      <TaskList initialTasks={tasks} members={members} groups={groups} />
    </div>
  )
}
