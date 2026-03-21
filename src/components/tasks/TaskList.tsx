'use client'

import { useState, useTransition } from 'react'
import { Plus, Pencil, Trash2, Search, X, FileDown, Send, CheckCircle2, MessageSquare, Mail, Bell } from 'lucide-react'
import { createTask, updateTask, deleteTask, updateTaskStatus } from '@/lib/actions/tasks'
import { sendReport } from '@/lib/actions/reports'
import type { TaskStatus } from '@/types/database'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

type Task = {
  id: string
  task_id: string
  title: string
  description: string | null
  status: TaskStatus
  due_date: string | null
  assignee: { id: string; name: string } | null
  group: { id: string; name: string } | null
}

type Member = { id: string; name: string; email: string | null; whatsapp: string | null; role: string }
type Group  = { id: string; name: string }

const STATUS_LABEL: Record<TaskStatus, string> = {
  open: 'Aberta',
  in_progress: 'Andamento',
  done: 'Concluída',
}

const STATUS_STYLE: Record<TaskStatus, string> = {
  open: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-yellow-50 text-yellow-700',
  done: 'bg-green-50 text-green-700',
}

function getDuePriority(due_date: string | null): number {
  if (!due_date) return 3
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(due_date); d.setHours(0,0,0,0)
  if (d < today) return 0
  if (d.getTime() === today.getTime()) return 1
  return 2
}

function getRowStyle(due_date: string | null, status: TaskStatus): string {
  if (status === 'done') return ''
  const p = getDuePriority(due_date)
  if (p === 0) return 'bg-red-50 hover:bg-red-100'
  if (p === 1) return 'bg-yellow-50 hover:bg-yellow-100'
  return 'hover:bg-[#f9fafb]'
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const pa = getDuePriority(a.due_date)
    const pb = getDuePriority(b.due_date)
    if (pa !== pb) return pa - pb
    if (!a.due_date && !b.due_date) return 0
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })
}

function isWithinRange(dateStr: string | null, from: string, to: string) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (from && d < new Date(from)) return false
  if (to && d > new Date(to + 'T23:59:59')) return false
  return true
}

function buildFilterParts(
  search: string,
  statusFilter: TaskStatus | 'all',
  groupFilter: string,
  groups: Group[],
  dateFrom: string,
  dateTo: string
): string[] {
  const parts: string[] = []
  if (search) parts.push(`Busca: "${search}"`)
  if (statusFilter !== 'all') parts.push(`Status: ${STATUS_LABEL[statusFilter]}`)
  if (groupFilter !== 'all') {
    const g = groups.find(g => g.id === groupFilter)
    if (g) parts.push(`Grupo: ${g.name}`)
  }
  if (dateFrom || dateTo) {
    const from = dateFrom ? new Date(dateFrom).toLocaleDateString('pt-BR') : '...'
    const to   = dateTo   ? new Date(dateTo).toLocaleDateString('pt-BR')   : '...'
    parts.push(`Prazo: ${from} até ${to}`)
  }
  return parts
}

function generateAndDownloadPDF(tasks: Task[], filterParts: string[]): string {
  const doc = new jsPDF()

  // Header band
  doc.setFillColor(18, 140, 126)
  doc.rect(0, 0, 210, 26, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('Relatório de Tarefas', 14, 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 21)

  let startY = 34

  if (filterParts.length > 0) {
    doc.setTextColor(107, 114, 128)
    doc.setFontSize(8)
    doc.text(`Filtros: ${filterParts.join('  ·  ')}`, 14, startY)
    startY += 7
  }

  autoTable(doc, {
    startY,
    head: [['ID', 'Título', 'Responsável', 'Grupo', 'Prazo', 'Status']],
    body: tasks.map(t => [
      t.task_id,
      t.title,
      t.assignee?.name ?? '—',
      t.group?.name ?? '—',
      t.due_date ? new Date(t.due_date.split('T')[0] + 'T12:00:00').toLocaleDateString('pt-BR') : '—',
      STATUS_LABEL[t.status],
    ]),
    headStyles: { fillColor: [18, 140, 126], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    styles: { fontSize: 8.5, cellPadding: 3.5, textColor: [30, 30, 30] },
    columnStyles: {
      0: { cellWidth: 20, fontStyle: 'bold', textColor: [18, 140, 126] },
      1: { cellWidth: 60 },
      5: { cellWidth: 26 },
    },
  })

  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7.5)
    doc.setTextColor(156, 163, 175)
    doc.text(
      `${tasks.length} tarefa${tasks.length !== 1 ? 's' : ''}  ·  Página ${i} de ${pageCount}`,
      14,
      doc.internal.pageSize.height - 8
    )
  }

  const filename = `relatorio-tarefas-${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
  return filename
}

/* ── TaskList ────────────────────────────────────────── */

export function TaskList({ initialTasks, members, groups }: {
  initialTasks: Task[]
  members: Member[]
  groups: Group[]
}) {
  const [search,        setSearch]        = useState('')
  const [statusFilter,  setStatusFilter]  = useState<TaskStatus | 'all'>('all')
  const [groupFilter,   setGroupFilter]   = useState('all')
  const [dateFrom,      setDateFrom]      = useState('')
  const [dateTo,        setDateTo]        = useState('')
  const [editingTask,   setEditingTask]   = useState<Task | null>(null)
  const [showCreate,    setShowCreate]    = useState(false)
  const [reportFile,    setReportFile]    = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const hasDateFilter = dateFrom || dateTo
  const hasActiveFilters = search || statusFilter !== 'all' || groupFilter !== 'all' || hasDateFilter

  const filtered = sortTasks(initialTasks.filter(task => {
    const matchSearch =
      task.title.toLowerCase().includes(search.toLowerCase()) ||
      task.task_id.toLowerCase().includes(search.toLowerCase()) ||
      (task.assignee?.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || task.status === statusFilter
    const matchGroup  = groupFilter === 'all' || task.group?.id === groupFilter
    const matchDate   = !hasDateFilter || isWithinRange(task.due_date, dateFrom, dateTo)
    return matchSearch && matchStatus && matchGroup && matchDate
  }))

  function handleDelete(taskId: string) {
    if (!confirm('Excluir esta tarefa?')) return
    startTransition(async () => { await deleteTask(taskId) })
  }

  function clearFilters() {
    setSearch(''); setStatusFilter('all'); setGroupFilter('all')
    setDateFrom(''); setDateTo('')
  }

  function handleGenerateReport() {
    const filterParts = buildFilterParts(search, statusFilter, groupFilter, groups, dateFrom, dateTo)
    const filename = generateAndDownloadPDF(filtered, filterParts)
    setReportFile(filename)
  }

  return (
    <div className="bg-white rounded-xl border border-[#e5e7eb]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-4 border-b border-[#e5e7eb] flex-wrap">
        {/* Busca */}
        <div className="relative min-w-[180px] flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]" />
          <input
            type="text"
            placeholder="ID, título ou membro..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-[#e5e7eb] rounded-lg outline-none focus:border-[#128c7e] transition-colors"
          />
        </div>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as TaskStatus | 'all')}
          className="text-sm border border-[#e5e7eb] rounded-lg px-3 py-2 outline-none focus:border-[#128c7e] bg-white text-[#6b7280] shrink-0"
        >
          <option value="all">Todos os status</option>
          <option value="open">Aberta</option>
          <option value="in_progress">Andamento</option>
          <option value="done">Concluída</option>
        </select>

        {/* Grupo */}
        <select
          value={groupFilter}
          onChange={e => setGroupFilter(e.target.value)}
          className="text-sm border border-[#e5e7eb] rounded-lg px-3 py-2 outline-none focus:border-[#128c7e] bg-white text-[#6b7280] shrink-0"
        >
          <option value="all">Todos os grupos</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        {/* Prazo */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-[#6b7280] whitespace-nowrap">Prazo:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="border border-[#e5e7eb] rounded-lg px-2 py-2 text-xs outline-none focus:border-[#128c7e] transition-colors"
          />
          <span className="text-xs text-[#6b7280]">até</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            onChange={e => setDateTo(e.target.value)}
            className="border border-[#e5e7eb] rounded-lg px-2 py-2 text-xs outline-none focus:border-[#128c7e] transition-colors"
          />
        </div>

        {hasActiveFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-[#6b7280] hover:text-red-500 transition-colors shrink-0">
            <X size={13} /> Limpar
          </button>
        )}

        {/* Relatório PDF */}
        <button
          onClick={handleGenerateReport}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 border border-[#128c7e] text-[#128c7e] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#128c7e]/5 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FileDown size={15} /> Relatório PDF
        </button>

        {/* Nova tarefa */}
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#128c7e] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#39a878] transition-colors shrink-0"
        >
          <Plus size={15} /> Nova Tarefa
        </button>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
              <th className="text-left px-4 py-3 font-medium text-[#6b7280]">ID</th>
              <th className="text-left px-4 py-3 font-medium text-[#6b7280]">Título</th>
              <th className="text-left px-4 py-3 font-medium text-[#6b7280]">Responsável</th>
              <th className="text-left px-4 py-3 font-medium text-[#6b7280]">Grupo</th>
              <th className="text-left px-4 py-3 font-medium text-[#6b7280]">Prazo</th>
              <th className="text-left px-4 py-3 font-medium text-[#6b7280]">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-[#6b7280]">
                  {initialTasks.length === 0
                    ? 'Nenhuma tarefa criada ainda. Crie a primeira!'
                    : 'Nenhuma tarefa encontrada para os filtros aplicados.'}
                </td>
              </tr>
            ) : (
              filtered.map(task => (
                <tr
                  key={task.id}
                  className={`border-b border-[#e5e7eb] last:border-0 transition-colors ${getRowStyle(task.due_date, task.status)}`}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-white/70 px-2 py-1 rounded font-medium text-[#128c7e] border border-[#e5e7eb]">
                      {task.task_id}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">{task.title}</td>
                  <td className="px-4 py-3 text-[#6b7280]">{task.assignee?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-[#6b7280]">{task.group?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-[#6b7280]">
                    {task.due_date ? new Date(task.due_date.split('T')[0] + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      defaultValue={task.status}
                      onChange={e => {
                        const v = e.target.value
                        startTransition(async () => { await updateTaskStatus(task.id, v) })
                      }}
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 outline-none cursor-pointer ${STATUS_STYLE[task.status]}`}
                    >
                      <option value="open">Aberta</option>
                      <option value="in_progress">Andamento</option>
                      <option value="done">Concluída</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setEditingTask(task)}
                        className="p-1.5 text-[#6b7280] hover:text-[#128c7e] hover:bg-white/80 rounded transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(task.id)}
                        disabled={isPending}
                        className="p-1.5 text-[#6b7280] hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-[#e5e7eb] text-xs text-[#6b7280]">
        {filtered.length} tarefa{filtered.length !== 1 ? 's' : ''}
        {hasActiveFilters && initialTasks.length !== filtered.length && ` (filtrado de ${initialTasks.length})`}
      </div>

      {reportFile && (
        <ReportModal
          filename={reportFile}
          members={members}
          onClose={() => setReportFile(null)}
        />
      )}
      {showCreate && (
        <TaskModal members={members} groups={groups} onClose={() => setShowCreate(false)} />
      )}
      {editingTask && (
        <TaskModal
          task={editingTask}
          members={members}
          groups={groups}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  )
}

/* ── ReportModal ─────────────────────────────────────── */

function ReportModal({ filename, members, onClose }: {
  filename: string
  members: Member[]
  onClose: () => void
}) {
  const [channel,     setChannel]     = useState<'whatsapp' | 'email' | 'both'>('whatsapp')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isPending,   startTransition] = useTransition()
  const [result,      setResult]      = useState<{ error?: string; success?: boolean } | null>(null)

  function toggleMember(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set(members.map(m => m.id)))
  }

  function handleSend() {
    if (selectedIds.size === 0) return
    startTransition(async () => {
      const res = await sendReport({
        memberIds: Array.from(selectedIds),
        channel,
        filename,
      })
      setResult(res)
    })
  }

  const channelOptions = [
    { value: 'whatsapp', label: 'WhatsApp', Icon: MessageSquare },
    { value: 'email',    label: 'E-mail',   Icon: Mail },
    { value: 'both',     label: 'Ambos',    Icon: Bell },
  ] as const

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl border border-[#e5e7eb] w-full max-w-md p-6 shadow-lg">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Enviar Relatório PDF</h2>
          <button onClick={onClose} className="text-[#6b7280] hover:text-black transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Download confirmado */}
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 mb-5 text-sm text-green-700">
          <CheckCircle2 size={15} className="shrink-0" />
          <span>PDF baixado: <span className="font-mono text-xs">{filename}</span></span>
        </div>

        {/* Canal */}
        <p className="text-sm font-medium mb-2">Enviar também por</p>
        <div className="flex gap-2 mb-4">
          {channelOptions.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setChannel(value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border flex-1 justify-center text-sm font-medium transition-colors ${
                channel === value
                  ? 'border-[#128c7e] bg-[#128c7e]/5 text-[#128c7e]'
                  : 'border-[#e5e7eb] text-[#6b7280] hover:border-[#128c7e]/50'
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Destinatários */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">Destinatários</p>
          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-[#128c7e] hover:underline"
          >
            Selecionar todos
          </button>
        </div>
        <div className="border border-[#e5e7eb] rounded-lg overflow-hidden max-h-44 overflow-y-auto mb-4">
          {members.length === 0 ? (
            <p className="text-xs text-[#6b7280] p-3">Nenhum membro cadastrado</p>
          ) : members.map(m => {
            const hasWpp   = !!m.whatsapp
            const hasEmail = !!m.email
            const unavailable =
              (channel === 'whatsapp' && !hasWpp) ||
              (channel === 'email' && !hasEmail)
            return (
              <label
                key={m.id}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#f9fafb] cursor-pointer border-b border-[#e5e7eb] last:border-0"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(m.id)}
                  onChange={() => toggleMember(m.id)}
                  className="accent-[#128c7e] w-4 h-4"
                />
                <span className={`text-sm flex-1 ${unavailable ? 'text-[#9ca3af]' : ''}`}>
                  {m.name}
                </span>
                <span className="flex items-center gap-1">
                  {hasWpp   && <MessageSquare size={11} className="text-[#128c7e]" />}
                  {hasEmail && <Mail size={11} className="text-[#6b7280]" />}
                  {unavailable && (
                    <span className="text-[10px] text-[#9ca3af]">sem contato</span>
                  )}
                </span>
              </label>
            )
          })}
        </div>

        {/* Feedback */}
        {result?.error && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            {result.error}
          </p>
        )}
        {result?.success && (
          <p className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3">
            Relatório enviado com sucesso!
          </p>
        )}

        {/* Ações */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-[#e5e7eb] rounded-lg py-2.5 text-sm font-medium text-[#6b7280] hover:bg-[#f5f5f5] transition-colors"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isPending || selectedIds.size === 0}
            className="flex-1 bg-[#128c7e] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#39a878] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send size={14} />
            {isPending ? 'Enviando...' : `Enviar${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── TaskModal ───────────────────────────────────────── */

function TaskModal({ task, members, groups, onClose }: {
  task?: Task
  members: Member[]
  groups: Group[]
  onClose: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const isEdit = !!task

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = isEdit
        ? await updateTask(task.id, formData)
        : await createTask(formData)
      if (result?.error) setError(result.error)
      else onClose()
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl border border-[#e5e7eb] w-full max-w-md p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">{isEdit ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">

          <div>
            <label className="block text-sm font-medium mb-1">Título</label>
            <input
              type="text" name="title" required autoFocus
              defaultValue={task?.title ?? ''}
              placeholder="Descreva a tarefa..."
              className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#128c7e] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Responsável</label>
            <select name="assignee_id" defaultValue={task?.assignee?.id ?? ''}
              className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#128c7e] bg-white">
              <option value="">Sem responsável</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Grupo</label>
            <select name="group_id" defaultValue={task?.group?.id ?? ''}
              className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#128c7e] bg-white">
              <option value="">Sem grupo</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>

          {isEdit && (
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select name="status" defaultValue={task.status}
                className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#128c7e] bg-white">
                <option value="open">Aberta</option>
                <option value="in_progress">Andamento</option>
                <option value="done">Concluída</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Prazo</label>
            <input type="date" name="due_date"
              defaultValue={task?.due_date ? task.due_date.split('T')[0] : ''}
              className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#128c7e]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Descrição <span className="text-[#6b7280] font-normal">(opcional)</span>
            </label>
            <textarea name="description" rows={3}
              defaultValue={task?.description ?? ''}
              placeholder="Detalhes adicionais..."
              className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#128c7e] resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-[#e5e7eb] rounded-lg py-2.5 text-sm font-medium text-[#6b7280] hover:bg-[#f5f5f5] transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 bg-[#128c7e] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#39a878] transition-colors disabled:opacity-50">
              {isPending ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar Tarefa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
