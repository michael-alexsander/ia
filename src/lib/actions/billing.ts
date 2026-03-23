'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLAN_LIMITS, PLAN_LABELS, PLAN_PRICES, PLAN_FEATURES, getCheckoutUrl, nextPlan, type PlanName } from '@/lib/plans'

export type BillingInfo = {
  plan: PlanName
  status: 'active' | 'inactive' | 'suspended'
  groupCount: number
  memberCount: number
  limits: { groups: number; members: number }
  label: string
  price: string
  features: { groups: string; members: string; tasks: string }
  checkoutUrls: { small: string; medium: string; large: string }
  nextPlan: PlanName | null
  nextCheckoutUrl: string | null
}

export async function getBillingInfo(): Promise<BillingInfo | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()

  const { data: member } = await admin
    .from('members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .single()

  if (!member) return null

  const { data: workspace } = await admin
    .from('workspaces')
    .select('plan, status')
    .eq('id', member.workspace_id)
    .single()

  if (!workspace) return null

  const plan   = (workspace.plan ?? 'small') as PlanName
  const status = (workspace.status ?? 'active') as BillingInfo['status']

  const [{ count: groupCount }, { count: memberCount }] = await Promise.all([
    admin.from('groups').select('*', { count: 'exact', head: true }).eq('workspace_id', member.workspace_id),
    admin.from('members').select('*', { count: 'exact', head: true })
      .eq('workspace_id', member.workspace_id).in('status', ['active', 'invited']),
  ])

  const np = nextPlan(plan)

  return {
    plan,
    status,
    groupCount:   groupCount  ?? 0,
    memberCount:  memberCount ?? 0,
    limits:       PLAN_LIMITS[plan],
    label:        PLAN_LABELS[plan],
    price:        PLAN_PRICES[plan],
    features:     PLAN_FEATURES[plan],
    checkoutUrls: {
      small:  getCheckoutUrl('small'),
      medium: getCheckoutUrl('medium'),
      large:  getCheckoutUrl('large'),
    },
    nextPlan:        np,
    nextCheckoutUrl: np ? getCheckoutUrl(np) : null,
  }
}
