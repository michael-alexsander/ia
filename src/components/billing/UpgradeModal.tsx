'use client'

import { X, Zap, Users, Layers } from 'lucide-react'
import { PLAN_LABELS, PLAN_PRICES, PLAN_FEATURES, getCheckoutUrl, type PlanName } from '@/lib/plans'

interface UpgradeModalProps {
  currentPlan: PlanName
  limitType: 'groups' | 'members'
  upgradeUrl: string
  onClose: () => void
}

const PLAN_ICONS: Record<PlanName, React.ReactNode> = {
  small:  <Layers   size={18} className="text-[#128c7e]" />,
  medium: <Users    size={18} className="text-[#128c7e]" />,
  large:  <Zap      size={18} className="text-[#128c7e]" />,
}

const LIMIT_MESSAGES: Record<'groups' | 'members', string> = {
  groups:  'Você atingiu o limite de grupos do seu plano.',
  members: 'Você atingiu o limite de membros do seu plano.',
}

const PLANS_ORDER: PlanName[] = ['small', 'medium', 'large']

export function UpgradeModal({ currentPlan, limitType, upgradeUrl, onClose }: UpgradeModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#128c7e] px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-lg">Faça upgrade do plano</h2>
            <p className="text-white/80 text-sm mt-0.5">{LIMIT_MESSAGES[limitType]}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Planos */}
        <div className="p-6">
          <p className="text-sm text-[#6b7280] mb-4">
            Seu plano atual: <span className="font-semibold text-[#111827]">{PLAN_LABELS[currentPlan]} — {PLAN_PRICES[currentPlan]}</span>
          </p>

          <div className="space-y-3">
            {PLANS_ORDER.filter(p => p !== currentPlan).map(plan => {
              const features = PLAN_FEATURES[plan]
              const url      = getCheckoutUrl(plan)
              const isRecommended = plan === 'medium' || (currentPlan === 'medium' && plan === 'large')
              return (
                <a
                  key={plan}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block border-2 rounded-xl p-4 hover:border-[#128c7e] transition-all cursor-pointer ${
                    isRecommended ? 'border-[#128c7e] bg-[#f0fdf9]' : 'border-[#e5e7eb]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {PLAN_ICONS[plan]}
                      <span className="font-semibold text-[#111827]">{PLAN_LABELS[plan]}</span>
                      {isRecommended && (
                        <span className="text-xs bg-[#128c7e] text-white px-2 py-0.5 rounded-full font-medium">
                          Recomendado
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-[#128c7e] text-lg">{PLAN_PRICES[plan]}</span>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-[#6b7280]">
                    <span>• {features.groups}</span>
                    <span>• {features.members}</span>
                    <span>• {features.tasks}</span>
                  </div>
                  <div className="mt-3">
                    <span className="inline-block w-full text-center bg-[#128c7e] text-white text-sm font-medium rounded-lg py-2 hover:bg-[#39a878] transition-colors">
                      Assinar plano {PLAN_LABELS[plan]} →
                    </span>
                  </div>
                </a>
              )
            })}
          </div>

          <p className="text-xs text-[#9ca3af] text-center mt-4">
            Após o pagamento, o acesso é liberado automaticamente.
          </p>
        </div>
      </div>
    </div>
  )
}
