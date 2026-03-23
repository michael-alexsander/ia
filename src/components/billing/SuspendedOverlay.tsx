'use client'

import { AlertTriangle } from 'lucide-react'
import { PLAN_LABELS, PLAN_PRICES, getCheckoutUrl, type PlanName } from '@/lib/plans'

interface SuspendedOverlayProps {
  workspaceName: string
  plan: PlanName
  isAdmin: boolean
  adminEmail?: string
}

export function SuspendedOverlay({ workspaceName, plan, isAdmin, adminEmail }: SuspendedOverlayProps) {
  const checkoutUrl = getCheckoutUrl(plan)

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-red-50 border-b border-red-100 px-6 py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <div>
            <h2 className="font-semibold text-[#111827]">Acesso suspenso</h2>
            <p className="text-sm text-[#6b7280]">{workspaceName}</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {isAdmin ? (
            <>
              <p className="text-sm text-[#374151] mb-4">
                Sua assinatura foi suspensa. Para reativar o acesso da equipe ao TarefaApp, renove sua assinatura.
              </p>

              <div className="bg-[#f9fafb] rounded-xl border border-[#e5e7eb] p-4 mb-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#6b7280] uppercase font-medium tracking-wide">Plano atual</p>
                    <p className="font-semibold text-[#111827] mt-0.5">{PLAN_LABELS[plan]}</p>
                  </div>
                  <p className="font-bold text-[#128c7e] text-xl">{PLAN_PRICES[plan]}</p>
                </div>
              </div>

              <a
                href={checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-[#128c7e] text-white font-semibold rounded-xl py-3 hover:bg-[#39a878] transition-colors"
              >
                Renovar assinatura agora
              </a>

              <p className="text-xs text-[#9ca3af] text-center mt-3">
                O acesso é liberado automaticamente após o pagamento.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-[#374151] mb-4">
                O acesso à plataforma está temporariamente suspenso. Por favor, entre em contato com o administrador da sua empresa.
              </p>
              {adminEmail && (
                <a
                  href={`mailto:${adminEmail}`}
                  className="block w-full text-center bg-[#128c7e] text-white font-semibold rounded-xl py-3 hover:bg-[#39a878] transition-colors"
                >
                  Contatar administrador
                </a>
              )}
              <p className="text-xs text-[#9ca3af] text-center mt-3">
                {adminEmail ?? 'Solicite ao admin que renove a assinatura.'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
