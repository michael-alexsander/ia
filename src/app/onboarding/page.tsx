'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createWorkspace } from '@/lib/actions/workspace'
import Image from 'next/image'

const initialState = { error: undefined as string | undefined, success: false }

export default function OnboardingPage() {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(createWorkspace, initialState)

  useEffect(() => {
    if (state?.success) {
      router.push('/tasks')
      router.refresh()
    }
  }, [state?.success, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#128c7e]">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm overflow-hidden">
        <div className="bg-[#128c7e] flex items-center justify-center px-8 py-6">
          <Image src="/logo.png" alt="TarefaApp" width={260} height={64} className="h-14 w-auto object-contain" priority />
        </div>
        <div className="p-8">

        <h1 className="text-xl font-semibold text-center mb-1">Crie sua empresa</h1>
        <p className="text-sm text-[#6b7280] text-center mb-6">
          Como se chama o seu negócio?
        </p>

        <form action={formAction} className="flex flex-col gap-3">
          <input
            type="text"
            name="name"
            placeholder="Ex: Agência Nova Era"
            required
            autoFocus
            disabled={isPending || state?.success}
            className="border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#128c7e] transition-colors disabled:opacity-50"
          />
          {state?.error && (
            <p className="text-sm text-red-500">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={isPending || state?.success}
            className="w-full bg-[#128c7e] text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[#39a878] transition-colors disabled:opacity-50"
          >
            {isPending || state?.success ? 'Criando...' : 'Criar e entrar'}
          </button>
        </form>
        </div>
      </div>
    </div>
  )
}
