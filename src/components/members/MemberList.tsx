'use client'

import { useState, useTransition, useActionState } from 'react'
import { UserPlus, Pencil, Trash2, Mail, Phone, X, Crown } from 'lucide-react'
import { inviteMember, updateMember, removeMember } from '@/lib/actions/members'
import { UpgradeModal } from '@/components/billing/UpgradeModal'
import Image from 'next/image'
import type { PlanName } from '@/lib/plans'

type Member = {
  id: string
  name: string
  email: string | null
  whatsapp: string | null
  role: 'admin' | 'member'
  status: 'active' | 'inactive' | 'invited'
  avatar_url: string | null
  created_at: string
}

const STATUS_STYLE: Record<string, string> = {
  active:   'bg-green-50 text-green-700',
  invited:  'bg-yellow-50 text-yellow-700',
  inactive: 'bg-[#f5f5f5] text-[#6b7280]',
}
const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo', invited: 'Convidado', inactive: 'Inativo',
}

function MemberAvatar({ member, size = 32 }: { member: Pick<Member, 'name' | 'avatar_url'>; size?: number }) {
  if (member.avatar_url) {
    return (
      <Image
        src={member.avatar_url}
        alt={member.name}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-full bg-[#128c7e]/10 flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <span className="text-[#128c7e] font-semibold" style={{ fontSize: size * 0.4 }}>
        {member.name.charAt(0).toUpperCase()}
      </span>
    </div>
  )
}

export function MemberList({ initialMembers }: { initialMembers: Member[] }) {
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [showInvite,    setShowInvite]    = useState(false)
  const [isPending,     startTransition]  = useTransition()

  const active  = initialMembers.filter(m => m.status === 'active')
  const invited = initialMembers.filter(m => m.status === 'invited')

  function handleRemove(member: Member) {
    if (!confirm(`Remover ${member.name} da equipe?`)) return
    startTransition(async () => { await removeMember(member.id) })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-[#e5e7eb] p-4 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-[#6b7280]">
          <span><strong className="text-black">{active.length}</strong> ativo{active.length !== 1 ? 's' : ''}</span>
          {invited.length > 0 && (
            <span><strong className="text-yellow-600">{invited.length}</strong> aguardando</span>
          )}
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 bg-[#128c7e] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#39a878] transition-colors"
        >
          <UserPlus size={15} />
          Convidar membro
        </button>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl border border-[#e5e7eb] overflow-hidden">
        {initialMembers.length === 0 ? (
          <div className="text-center py-16 text-[#6b7280] text-sm">
            Nenhum membro além de você. Convide sua equipe!
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
                <th className="text-left px-4 py-3 font-medium text-[#6b7280]">Membro</th>
                <th className="text-left px-4 py-3 font-medium text-[#6b7280]">Contato</th>
                <th className="text-left px-4 py-3 font-medium text-[#6b7280]">Função</th>
                <th className="text-left px-4 py-3 font-medium text-[#6b7280]">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {initialMembers.map(member => (
                <tr key={member.id} className="border-b border-[#e5e7eb] last:border-0 hover:bg-[#f9fafb] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <MemberAvatar member={member} />
                      <div className="font-medium flex items-center gap-1.5">
                        {member.name}
                        {member.role === 'admin' && (
                          <Crown size={12} className="text-[#128c7e]" />
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#6b7280]">
                    <div className="flex flex-col gap-0.5">
                      {member.email && (
                        <span className="flex items-center gap-1.5 text-xs">
                          <Mail size={11} /> {member.email}
                        </span>
                      )}
                      {member.whatsapp && (
                        <span className="flex items-center gap-1.5 text-xs">
                          <Phone size={11} /> {member.whatsapp}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      member.role === 'admin'
                        ? 'bg-[#128c7e]/10 text-[#128c7e]'
                        : 'bg-[#f5f5f5] text-[#6b7280]'
                    }`}>
                      {member.role === 'admin' ? 'Admin' : 'Membro'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[member.status]}`}>
                      {STATUS_LABEL[member.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setEditingMember(member)}
                        disabled={isPending}
                        title="Editar membro"
                        className="p-1.5 text-[#6b7280] hover:text-[#128c7e] hover:bg-[#f5f5f5] rounded transition-colors disabled:opacity-50"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleRemove(member)}
                        disabled={isPending}
                        title="Remover da equipe"
                        className="p-1.5 text-[#6b7280] hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {showInvite    && <InviteModal onClose={() => setShowInvite(false)} />}
      {editingMember && <EditMemberModal member={editingMember} onClose={() => setEditingMember(null)} />}
    </div>
  )
}

/* ── Modal de edição ─────────────────────────────── */

function EditMemberModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError]   = useState('')
  const [preview, setPreview] = useState(member.avatar_url ?? '')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateMember(member.id, formData)
      if (result?.error) setError(result.error)
      else onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl border border-[#e5e7eb] w-full max-w-md p-6 shadow-lg">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Editar membro</h2>
          <button onClick={onClose} className="text-[#6b7280] hover:text-black transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-1">
            <div className="relative">
              {preview ? (
                <Image
                  src={preview}
                  alt={member.name}
                  width={56}
                  height={56}
                  className="rounded-full object-cover border-2 border-[#e5e7eb]"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-[#128c7e]/10 flex items-center justify-center border-2 border-[#e5e7eb]">
                  <span className="text-[#128c7e] font-bold text-xl">
                    {member.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">URL da foto</label>
              <input
                type="url"
                name="avatar_url"
                defaultValue={member.avatar_url ?? ''}
                placeholder="https://... (auto via WhatsApp)"
                onChange={e => setPreview(e.target.value)}
                className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#128c7e] transition-colors"
              />
              <p className="text-xs text-[#6b7280] mt-1">Preenchido automaticamente via WhatsApp</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input
              type="text" name="name" required
              defaultValue={member.name}
              className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#128c7e] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">E-mail</label>
            <input
              type="email" name="email"
              defaultValue={member.email ?? ''}
              placeholder="nome@email.com"
              className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#128c7e] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">WhatsApp</label>
            <input
              type="text"
              value={member.whatsapp ?? 'Não informado'}
              disabled
              className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm bg-[#f5f5f5] text-[#6b7280] cursor-not-allowed"
            />
            <p className="text-xs text-[#6b7280] mt-1">Número vinculado ao WhatsApp — não editável</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Função</label>
            <select
              name="role"
              defaultValue={member.role}
              className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#128c7e] bg-white"
            >
              <option value="member">Membro</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-[#e5e7eb] rounded-lg py-2.5 text-sm font-medium text-[#6b7280] hover:bg-[#f5f5f5] transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 bg-[#128c7e] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#39a878] transition-colors disabled:opacity-50">
              {isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Modal de convite ─────────────────────────────── */

type InviteState = { error?: string; success?: boolean; token?: string; sentViaWhatsapp?: boolean; sentViaEmail?: boolean; limitReached?: boolean; plan?: PlanName; upgradeUrl?: string }
const inviteInitial: InviteState = {}

function InviteModal({ onClose }: { onClose: () => void }) {
  const [state, formAction, isPending] = useActionState(inviteMember, inviteInitial)

  // Mostra UpgradeModal quando limite atingido
  if (state?.limitReached && state.plan && state.upgradeUrl) {
    return (
      <UpgradeModal
        currentPlan={state.plan}
        limitType="members"
        upgradeUrl={state.upgradeUrl}
        onClose={onClose}
      />
    )
  }
  const [channel,    setChannel]    = useState<'email' | 'whatsapp' | 'both'>('email')
  const [copied,     setCopied]     = useState(false)
  const [wppNumber,  setWppNumber]  = useState('')

  function copyCode() {
    if (!state?.token) return
    navigator.clipboard.writeText(state.token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (state?.success) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl border border-[#e5e7eb] w-full max-w-md p-6 shadow-lg text-center">
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
            <span className="text-green-600 text-xl">✓</span>
          </div>
          <h2 className="text-lg font-semibold mb-1">Membro convidado!</h2>

          {/* Código de ativação */}
          <p className="text-sm text-[#6b7280] mb-3">
            {state.sentViaWhatsapp && state.sentViaEmail
              ? 'O código foi enviado via WhatsApp e e-mail.'
              : state.sentViaWhatsapp
              ? 'O código foi enviado automaticamente via WhatsApp.'
              : state.sentViaEmail
              ? 'O código foi enviado para o e-mail do membro.'
              : 'Compartilhe o código abaixo com o membro para ele ativar a conta.'}
          </p>
          <div className="bg-[#f9fafb] border border-[#e5e7eb] rounded-xl p-4 mb-2">
            <p className="text-xs text-[#6b7280] mb-1">Código de ativação</p>
            <p className="text-2xl font-mono font-bold tracking-widest text-[#128c7e]">{state.token}</p>
          </div>
          <p className="text-xs text-[#6b7280] mb-4">
            O membro deve enviar este código para o número do TarefaApp no WhatsApp.
          </p>

          <div className="flex gap-2">
            <button
              onClick={copyCode}
              className="flex-1 border border-[#e5e7eb] rounded-lg py-2.5 text-sm font-medium text-[#6b7280] hover:bg-[#f5f5f5] transition-colors"
            >
              {copied ? '✓ Copiado!' : 'Copiar código'}
            </button>
            <button onClick={onClose}
              className="flex-1 bg-[#128c7e] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#39a878] transition-colors">
              Fechar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl border border-[#e5e7eb] w-full max-w-md p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Convidar membro</h2>
          <button onClick={onClose} className="text-[#6b7280] hover:text-black transition-colors">
            <X size={18} />
          </button>
        </div>

        <form action={formAction} className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input type="text" name="name" required autoFocus placeholder="Nome completo"
              className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#128c7e] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Convidar por</label>
            <div className="flex gap-2">
              {(['email', 'whatsapp', 'both'] as const).map(c => (
                <button key={c} type="button" onClick={() => setChannel(c)}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    channel === c
                      ? 'bg-[#128c7e] text-white border-[#128c7e]'
                      : 'border-[#e5e7eb] text-[#6b7280] hover:border-[#128c7e]'
                  }`}>
                  {c === 'email' ? 'E-mail' : c === 'whatsapp' ? 'WhatsApp' : 'Ambos'}
                </button>
              ))}
            </div>
          </div>

          {(channel === 'email' || channel === 'both') && (
            <div>
              <label className="block text-sm font-medium mb-1">E-mail</label>
              <input type="email" name="email" placeholder="nome@email.com"
                required={channel === 'email'}
                className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#128c7e] transition-colors"
              />
            </div>
          )}

          {(channel === 'whatsapp' || channel === 'both') && (
            <div>
              <label className="block text-sm font-medium mb-1">WhatsApp</label>
              <div className="flex rounded-lg border border-[#e5e7eb] overflow-hidden focus-within:border-[#128c7e] transition-colors">
                <div className="flex items-center gap-1.5 px-3 bg-[#f9fafb] border-r border-[#e5e7eb] text-sm text-[#374151] shrink-0 select-none">
                  🇧🇷 +55
                </div>
                <input
                  type="tel"
                  placeholder="(11) 99999-9999"
                  required={channel === 'whatsapp'}
                  value={wppNumber}
                  onChange={e => setWppNumber(e.target.value)}
                  className="flex-1 px-3 py-2.5 text-sm outline-none bg-white"
                />
              </div>
              <input type="hidden" name="whatsapp" value={`55${wppNumber.replace(/\D/g, '')}`} />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Função</label>
            <select name="role"
              className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#128c7e] bg-white">
              <option value="member">Membro</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {state?.error && <p className="text-sm text-red-500">{state.error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-[#e5e7eb] rounded-lg py-2.5 text-sm font-medium text-[#6b7280] hover:bg-[#f5f5f5] transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 bg-[#128c7e] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#39a878] transition-colors disabled:opacity-50">
              {isPending ? 'Enviando...' : 'Enviar convite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
