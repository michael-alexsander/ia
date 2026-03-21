export type Plan = 'small' | 'medium' | 'large'
export type WorkspaceStatus = 'active' | 'inactive' | 'suspended'
export type MemberRole = 'admin' | 'member'
export type MemberStatus = 'active' | 'inactive' | 'invited'
export type TaskStatus = 'open' | 'in_progress' | 'done'
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly'
export type ReportChannel = 'whatsapp' | 'email' | 'both'

export interface Workspace {
  id: string
  name: string
  slug: string
  plan: Plan
  status: WorkspaceStatus
  celcoin_id: string | null
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Member {
  id: string
  workspace_id: string
  user_id: string | null
  name: string
  email: string | null
  whatsapp: string | null
  role: MemberRole
  status: MemberStatus
  created_at: string
  updated_at: string
}

export interface Group {
  id: string
  workspace_id: string
  name: string
  whatsapp_group: string | null
  description: string | null
  created_at: string
  updated_at: string
}

export interface GroupMember {
  id: string
  group_id: string
  member_id: string
  created_at: string
}

export interface Task {
  id: string
  task_id: string           // código alfanumérico ex: T25A3
  workspace_id: string
  group_id: string | null
  title: string
  description: string | null
  assignee_id: string | null
  created_by: string | null
  status: TaskStatus
  due_date: string | null
  recurrence: Recurrence
  recurrence_end: string | null
  overdue_alerted: boolean
  created_at: string
  updated_at: string
}

export interface TaskHistory {
  id: string
  task_id: string
  member_id: string | null
  field: string
  old_value: string | null
  new_value: string | null
  created_at: string
}

export interface AgentConfig {
  id: string
  workspace_id: string
  report_daily: boolean
  report_weekly: boolean
  report_monthly: boolean
  report_channel: ReportChannel
  report_morning_time: string
  report_evening_time: string
  reminder_1day: boolean
  reminder_1hour: boolean
  reminder_same_day: boolean
  alert_overdue_next_day: boolean
  created_at: string
  updated_at: string
}

export interface Invite {
  id: string
  workspace_id: string
  email: string | null
  whatsapp: string | null
  token: string
  role: MemberRole
  accepted: boolean
  expires_at: string
  created_at: string
}

export interface ConversationContext {
  id: string
  workspace_id: string
  member_id: string
  context: unknown[]
  updated_at: string
}
