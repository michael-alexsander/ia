// ─── Planos e limites Celcoin ─────────────────────────────────────────────────

export type PlanName = 'small' | 'medium' | 'large'

export const PLAN_LIMITS: Record<PlanName, { groups: number; members: number }> = {
  small:  { groups: 3,          members: 10 },
  medium: { groups: 10,         members: 30 },
  large:  { groups: Infinity,   members: Infinity },
}

export const PLAN_LABELS: Record<PlanName, string> = {
  small:  'Small',
  medium: 'Medium',
  large:  'Large',
}

export const PLAN_PRICES: Record<PlanName, string> = {
  small:  'R$ 37/mês',
  medium: 'R$ 79/mês',
  large:  'R$ 139/mês',
}

export const PLAN_FEATURES: Record<PlanName, { groups: string; members: string; tasks: string }> = {
  small:  { groups: '3 grupos',         members: '10 membros',         tasks: 'Tarefas ilimitadas' },
  medium: { groups: '10 grupos',        members: '30 membros',         tasks: 'Tarefas ilimitadas' },
  large:  { groups: 'Grupos ilimitados', members: 'Membros ilimitados', tasks: 'Tarefas ilimitadas' },
}

// Checkout URLs — configuradas via env vars ou fallback padrão
export function getCheckoutUrl(plan: PlanName): string {
  const urls: Record<PlanName, string> = {
    small:  process.env.CELCOIN_CHECKOUT_SMALL  ?? 'https://celcash.celcoin.com.br/landingpage7350005/tarefa-app/comprar/plano-small/70',
    medium: process.env.CELCOIN_CHECKOUT_MEDIUM ?? 'https://celcash.celcoin.com.br/landingpage7350005/tarefa-app/comprar/plano-medium/70',
    large:  process.env.CELCOIN_CHECKOUT_LARGE  ?? 'https://celcash.celcoin.com.br/landingpage7350005/tarefa-app/comprar/plano-large/70',
  }
  return urls[plan]
}

// Mapeia nome do plano Celcoin para PlanName interno
export function celcoinPlanToInternal(celcoinPlanName: string): PlanName | null {
  const map: Record<string, PlanName> = {
    'plano-small':  'small',
    'plano-medium': 'medium',
    'plano-large':  'large',
    'small':        'small',
    'medium':       'medium',
    'large':        'large',
  }
  return map[celcoinPlanName.toLowerCase()] ?? null
}

// Retorna o próximo plano acima do atual
export function nextPlan(current: PlanName): PlanName | null {
  const order: PlanName[] = ['small', 'medium', 'large']
  const idx = order.indexOf(current)
  return idx < order.length - 1 ? order[idx + 1] : null
}
