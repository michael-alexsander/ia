'use client'

import { useState, useTransition, useActionState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, Users, CheckCircle2, Clock, Copy } from 'lucide-react'
import { createGroup, updateGroup, deleteGroup } from '@/lib/actions/groups'
import { UpgradeModal } from '@/components/billing/UpgradeModal'
import Image from 'next/image'
import type { PlanName } from '@/lib/plans'

type Member = { id: string; name: string; avatar_url: string | null }
type Group  = {
  id: string
  name: string
  description: string | null
  whatsapp_group: string | null
  link_code: string | null
  linked_at: string | null
  created_at: string
  members: Member[]
}

function MemberAvatar({ m }: { m: Member }) {
  if (m.avatar_url) {
    return <Image src={m.avatar_url} alt={m.name} width={24} height={24} className="rounded-full object-cover border-2" style={{ width: 24, height: 24, borderColor: 'var(--muted)' }} />
  }
  return (
    <div className="w-6 h-6 rounded-full bg-[#128c7e]/10 border-2 flex items-center justify-center" style={{ borderColor: 'var(--muted)' }}>
      <span className="text-[#128c7e] font-semibold text-xs">{m.name.charAt(0).toUpperCase()}</span>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy} title="Copiar código"
      className="p-1 text-[#6b7280] hover:text-[#128c7e] transition-colors">
      {copied ? <CheckCircle2 size={13} className="text-green-500" /> : <Copy size={13} />}
    </button>
  )
}

export function GroupList({ initialGroups, allMembers }: { initialGroups: Group[]; allMembers: Member[] }) {
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [showCreate,   setShowCreate]   = useState(false)
  const [isPending,    startTransition] = useTransition()

  function handleDelete(group: Group) {
    if (!confirm(`Excluir o grupo "${group.name}"?`)) return
    startTransition(async () => { await deleteGroup(group.id) })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-[#e5e7eb] p-4 flex items-center justify-between">
        <span className="text-sm text-[#6b7280]">
          <strong style={{ color: 'var(--foreground)' }}>{initialGroups.length}</strong> grupo{initialGroups.length !== 1 ? 's' : ''}
          {initialGroups.filter(g => g.linked_at).length > 0 && (
            <span className="ml-3 text-green-600">
              <strong>{initialGroups.filter(g => g.linked_at).length}</strong> vinculado{initialGroups.filter(g => g.linked_at).length !== 1 ? 's' : ''} ao WhatsApp
            </span>
          )}
        </span>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#128c7e] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#39a878] transition-colors">
          <Plus size={15} /> Novo grupo
        </button>
      </div>

      {/* Grid */}
      {initialGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#e5e7eb] p-16 text-center text-[#6b7280] text-sm">
          <Users size={32} className="mx-auto mb-3 text-[#e5e7eb]" />
          <p className="font-medium mb-1">Nenhum grupo criado</p>
          <p className="text-xs">Crie um grupo e vincule ao seu grupo do WhatsApp</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {initialGroups.map(group => (
            <div key={group.id} className={`bg-white rounded-xl border p-5 flex flex-col gap-3 transition-colors ${
              group.linked_at ? 'border-[#128c7e]/30' : 'border-[#e5e7eb]'
            }`}>
              {/* Nome e ações */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{group.name}</h3>
                  {group.description && (
                    <p className="text-xs text-[#6b7280] mt-0.5">{group.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setEditingGroup(group)} disabled={isPending}
                    className="p-1.5 text-[#6b7280] hover:text-[#128c7e] hover:bg-[#f5f5f5] rounded transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(group)} disabled={isPending}
                    className="p-1.5 text-[#6b7280] hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Status de vinculação */}
              {group.linked_at ? (
                <div className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2">
                  <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                  <span className="text-xs text-green-700 font-medium">Vinculado ao WhatsApp</span>
                </div>
              ) : (
                <div className="bg-[#f5f5f5] rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Clock size={12} className="text-[#6b7280]" />
                    <span className="text-xs text-[#6b7280] font-medium">Aguardando vinculação</span>
                  </div>
                  <p className="text-xs text-[#6b7280] mb-2">
                    Adicione o bot no seu grupo do WhatsApp e envie o código:
                  </p>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-sm font-bold text-[#128c7e] bg-white px-2.5 py-1 rounded border border-[#e5e7eb]">
                      {group.link_code}
                    </span>
                    {group.link_code && <CopyButton text={group.link_code} />}
                  </div>
                </div>
              )}

              {/* Membros */}
              <div className="flex items-center gap-2">
                <Users size={13} className="text-[#6b7280] shrink-0" />
                {group.members.length === 0 ? (
                  <span className="text-xs text-[#6b7280] italic">Sem membros</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1.5">
                      {group.members.slice(0, 5).map(m => (
                        <div key={m.id} title={m.name}><MemberAvatar m={m} /></div>
                      ))}
                    </div>
                    <span className="text-xs text-[#6b7280]">
                      {group.members.length} membro{group.members.length !== 1 ? 's' : ''}
                      {group.members.length > 5 && ` (+${group.members.length - 5})`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate   && <GroupModal allMembers={allMembers} onClose={() => setShowCreate(false)} />}
      {editingGroup && <GroupModal group={editingGroup} allMembers={allMembers} onClose={() => setEditingGroup(null)} />}
    </div>
  )
}

/* ── Modal ─────────────────────────────────────────── */

type CreateState = { error?: string; success?: boolean; limitReached?: boolean; plan?: PlanName; upgradeUrl?: string }
const createInitial: CreateState = {}

function GroupModal({ group, allMembers, onClose }: {
  group?: Group
  allMembers: Member[]
  onClose: () => void
}) {
  const isEdit = !!group
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(group?.members.map(m => m.id) ?? [])
  )
  const [createState, createAction, createPending] = useActionState(createGroup, createInitial)
  const [isPending, startTransition] = useTransition()
  const [editError, setEditError]   = useState('')

  useEffect(() => {
    if (createState?.success) onClose()
  }, [createState?.success])

  // Mostra UpgradeModal quando limite atingido
  if (createState?.limitReached && createState.plan && createState.upgradeUrl) {
    return (
      <UpgradeModal
        currentPlan={createState.plan}
        limitType="groups"
        upgradeUrl={createState.upgradeUrl}
        onClose={onClose}
      />
    )
  }

  function toggleMember(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setEditError('')
    const formData = new FormData(e.currentTarget)
    selectedIds.forEach(id => formData.append('member_ids', id))
    startTransition(async () => {
      const result = await updateGroup(group!.id, formData)
      if (result?.error) setEditError(result.error)
      else onClose()
    })
  }

  const error   = isEdit ? editError : createState?.error
  const pending = isEdit ? isPending : createPending

  const fields = (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-sm font-medium mb-1">Nome do grupo</label>
        <input type="text" name="name" required autoFocus
          defaultValue={group?.name ?? ''}
          placeholder="Ex: Equipe de Vendas"
          className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#128c7e] transition-colors"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">
          Descrição <span className="font-normal text-[#6b7280]">(opcional)</span>
        </label>
        <input type="text" name="description"
          defaultValue={group?.description ?? ''}
          placeholder="Finalidade do grupo..."
          className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#128c7e] transition-colors"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-2">Membros</label>
        <div className="border border-[#e5e7eb] rounded-lg overflow-hidden max-h-44 overflow-y-auto">
          {allMembers.length === 0 ? (
            <p className="text-xs text-[#6b7280] p-3">Nenhum membro cadastrado</p>
          ) : allMembers.map(m => (
            <label key={m.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#f9fafb] cursor-pointer border-b border-[#e5e7eb] last:border-0">
              <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggleMember(m.id)} className="accent-[#128c7e] w-4 h-4" />
              <MemberAvatar m={m} />
              <span className="text-sm">{m.name}</span>
            </label>
          ))}
        </div>
        {selectedIds.size > 0 && (
          <p className="text-xs text-[#6b7280] mt-1">{selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}</p>
        )}
      </div>

      {!isEdit && (
        <div className="bg-[#f0fdf9] border border-[#00baa5]/30 rounded-lg p-3 text-xs text-[#128c7e]">
          Após criar, você receberá um código para vincular ao grupo do WhatsApp.
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 border border-[#e5e7eb] rounded-lg py-2.5 text-sm font-medium text-[#6b7280] hover:bg-[#f5f5f5] transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={pending}
          className="flex-1 bg-[#128c7e] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#39a878] transition-colors disabled:opacity-50">
          {pending ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar grupo'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl border border-[#e5e7eb] w-full max-w-md p-6 shadow-lg">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">{isEdit ? 'Editar grupo' : 'Novo grupo'}</h2>
          <button onClick={onClose} className="text-[#6b7280] hover:text-black transition-colors"><X size={18} /></button>
        </div>
        {isEdit ? (
          <form onSubmit={handleEditSubmit}>{fields}</form>
        ) : (
          <form action={(fd) => { selectedIds.forEach(id => fd.append('member_ids', id)); return createAction(fd) }}>{fields}</form>
        )}
      </div>
    </div>
  )
}
