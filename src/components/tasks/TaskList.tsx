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
  due_time: string | null
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
  assigneeFilter: string,
  members: Member[],
  groupFilter: string,
  groups: Group[],
  dateFrom: string,
  dateTo: string
): string[] {
  const parts: string[] = []
  if (search) parts.push(`Busca: "${search}"`)
  // Responsável — mais importante, aparece primeiro
  if (assigneeFilter !== 'all') {
    const m = members.find(m => m.id === assigneeFilter)
    if (m) parts.push(`Responsável: ${m.name}`)
  }
  if (groupFilter !== 'all') {
    const g = groups.find(g => g.id === groupFilter)
    if (g) parts.push(`Grupo: ${g.name}`)
  }
  if (dateFrom || dateTo) {
    const from = dateFrom ? new Date(dateFrom).toLocaleDateString('pt-BR') : '...'
    const to   = dateTo   ? new Date(dateTo).toLocaleDateString('pt-BR')   : '...'
    parts.push(`Prazo: ${from} até ${to}`)
  }
  if (statusFilter !== 'all') parts.push(`Status: ${STATUS_LABEL[statusFilter]}`)
  return parts
}

interface ImageInfo { dataUrl: string; w: number; h: number }

async function loadImageBase64(url: string): Promise<ImageInfo> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d')!.drawImage(img, 0, 0)
      resolve({ dataUrl: canvas.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight })
    }
    img.onerror = reject
    img.src = url
  })
}

async function generateAndDownloadPDF(tasks: Task[], filterParts: string[]): Promise<{ filename: string; base64: string }> {
  const doc = new jsPDF()

  // Tenta carregar o logo; em caso de erro usa apenas texto
  let logoInfo: ImageInfo | null = null
  try { logoInfo = await loadImageBase64('/logo.png') } catch { /* sem logo */ }

  // Header band
  const headerH = 30
  doc.setFillColor(18, 140, 126)
  doc.rect(0, 0, 210, headerH, 'F')

  // Esquerda: título + data
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Relatório de Tarefas', 14, 12)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 22)

  // Direita: logo sem distorção, alinhada à direita
  if (logoInfo) {
    const maxW = 54, maxH = 20
    const aspect = logoInfo.w / logoInfo.h
    let lw = maxW, lh = lw / aspect
    if (lh > maxH) { lh = maxH; lw = lh * aspect }
    const lx = 196 - lw
    const ly = (headerH - lh) / 2
    doc.addImage(logoInfo.dataUrl, 'PNG', lx, ly, lw, lh)
  }

  let startY = headerH + 6

  if (filterParts.length > 0) {
    doc.setTextColor(30, 30, 30)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(`Filtros: ${filterParts.join('  ·  ')}`, 14, startY)
    doc.setFont('helvetica', 'normal')
    startY += 9
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
  const base64 = doc.output('datauristring').split(',')[1]
  doc.save(filename)
  return { filename, base64 }
}

/* ── TaskList ────────────────────────────────────────── */

const PAGE_SIZE = 10

export function TaskList({ initialTasks, members, groups, currentMemberId }: {
  initialTasks: Task[]
  members: Member[]
  groups: Group[]
  currentMemberId: string | null
}) {
  const [search,          setSearch]          = useState('')
  const [statusFilter,    setStatusFilter]    = useState<TaskStatus | 'all'>('all')
  const [assigneeFilter,  setAssigneeFilter]  = useState(currentMemberId ?? 'all')
  const [groupFilter,     setGroupFilter]     = useState('all')
  const [dateFrom,        setDateFrom]        = useState('')
  const [dateTo,          setDateTo]          = useState('')
  const [page,            setPage]            = useState(1)
  const [editingTask,     setEditingTask]     = useState<Task | null>(null)
  const [showCreate,      setShowCreate]      = useState(false)
  const [reportFile,      setReportFile]      = useState<{ filename: string; base64: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const hasDateFilter    = dateFrom || dateTo
  const hasActiveFilters = search || statusFilter !== 'all' || assigneeFilter !== 'all' || groupFilter !== 'all' || hasDateFilter

  // Resetar página ao mudar qualquer filtro
  function resetPage() { setPage(1) }

  const filtered = sortTasks(initialTasks.filter(task => {
    const matchSearch   = task.title.toLowerCase().includes(search.toLowerCase()) ||
                          task.task_id.toLowerCase().includes(search.toLowerCase()) ||
                          (task.assignee?.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus   = statusFilter   === 'all' || task.status           === statusFilter
    const matchAssignee = assigneeFilter === 'all' || task.assignee?.id     === assigneeFilter
    const matchGroup    = groupFilter    === 'all' || task.group?.id         === groupFilter
    const matchDate     = !hasDateFilter || isWithinRange(task.due_date, dateFrom, dateTo)
    return matchSearch && matchStatus && matchAssignee && matchGroup && matchDate
  }))

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleDelete(taskId: string) {
    if (!confirm('Excluir esta tarefa?')) return
    startTransition(async () => { await deleteTask(taskId) })
  }

  function clearFilters() {
    setSearch(''); setStatusFilter('all'); setAssigneeFilter('all')
    setGroupFilter('all'); setDateFrom(''); setDateTo(''); resetPage()
  }

  function handleGenerateReport() {
    const filterParts = buildFilterParts(search, statusFilter, assigneeFilter, members, groupFilter, groups, dateFrom, dateTo)
    generateAndDownloadPDF(filtered, filterParts).then(result => setReportFile(result))
  }

  return (
    <div className="bg-white rounded-xl border border-[#e5e7eb]">

      {/* Linha 1: botões de ação */}
      <div className="flex items-center justify-end gap-2 px-4 pt-4 pb-2">
        <button
          onClick={handleGenerateReport}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 border border-[#128c7e] text-[#128c7e] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#128c7e]/5 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FileDown size={15} /> Relatório PDF
        </button>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#128c7e] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#39a878] transition-colors shrink-0"
        >
          <Plus size={15} /> Nova Tarefa
        </button>
      </div>

      {/* Linha 2: filtros */}
      <div className="flex items-center gap-2 px-4 pb-4 border-b border-[#e5e7eb] flex-wrap">
        {/* Busca */}
        <div className="relative min-w-[150px] flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]" />
          <input
            type="text"
            placeholder="ID ou título..."
            value={search}
            onChange={e => { setSearch(e.target.value); resetPage() }}
            className="w-full pl-8 pr-3 py-2 text-sm border border-[#e5e7eb] rounded-lg outline-none focus:border-[#128c7e] transition-colors"
          />
        </div>

        {/* Membro (Responsável) */}
        <select
          value={assigneeFilter}
          onChange={e => { setAssigneeFilter(e.target.value); resetPage() }}
          className="text-sm border border-[#e5e7eb] rounded-lg px-3 py-2 outline-none focus:border-[#128c7e] bg-white text-[#6b7280] shrink-0"
        >
          <option value="all">Todos os membros</option>
          {members.map(m => (
            <option key={m.id} value={m.id}>
              {m.id === currentMemberId ? `${m.name} (eu)` : m.name}
            </option>
          ))}
        </select>

        {/* Grupo */}
        <select
          value={groupFilter}
          onChange={e => { setGroupFilter(e.target.value); resetPage() }}
          className="text-sm border border-[#e5e7eb] rounded-lg px-3 py-2 outline-none focus:border-[#128c7e] bg-white text-[#6b7280] shrink-0"
        >
          <option value="all">Todos os grupos</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        {/* Prazo */}
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); resetPage() }}
            className="border border-[#e5e7eb] rounded-lg px-2 py-2 text-xs outline-none focus:border-[#128c7e] transition-colors"
            title="Prazo: de"
          />
          <span className="text-xs text-[#6b7280]">–</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            onChange={e => { setDateTo(e.target.value); resetPage() }}
            className="border border-[#e5e7eb] rounded-lg px-2 py-2 text-xs outline-none focus:border-[#128c7e] transition-colors"
            title="Prazo: até"
          />
        </div>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value as TaskStatus | 'all'); resetPage() }}
          className="text-sm border border-[#e5e7eb] rounded-lg px-3 py-2 outline-none focus:border-[#128c7e] bg-white text-[#6b7280] shrink-0"
        >
          <option value="all">Todos os status</option>
          <option value="open">Aberta</option>
          <option value="in_progress">Andamento</option>
          <option value="done">Concluída</option>
        </select>

        {hasActiveFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-[#6b7280] hover:text-red-500 transition-colors shrink-0">
            <X size={13} /> Limpar
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
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
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-[#6b7280]">
                  {initialTasks.length === 0
                    ? 'Nenhuma tarefa criada ainda. Crie a primeira!'
                    : 'Nenhuma tarefa encontrada para os filtros aplicados.'}
                </td>
              </tr>
            ) : (
              paginated.map(task => (
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
                    {task.due_date
                      ? new Date(task.due_date.split('T')[0] + 'T12:00:00').toLocaleDateString('pt-BR') +
                        (task.due_time ? ` às ${task.due_time.slice(0,5)}` : '')
                      : '—'}
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

      {/* Footer: contagem + paginação */}
      <div className="px-4 py-3 border-t border-[#e5e7eb] flex items-center justify-between gap-4 flex-wrap">
        <span className="text-xs text-[#6b7280]">
          {filtered.length === 0 ? '0 tarefas' : (
            <>
              {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} de {filtered.length} tarefa{filtered.length !== 1 ? 's' : ''}
              {hasActiveFilters && initialTasks.length !== filtered.length && ` (filtrado de ${initialTasks.length})`}
            </>
          )}
        </span>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-2.5 py-1 text-xs border border-[#e5e7eb] rounded-lg text-[#6b7280] hover:bg-[#f5f5f5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ‹ Anterior
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce<(number | '...')[]>((acc, p, i, arr) => {
                if (i > 0 && typeof arr[i - 1] === 'number' && (p as number) - (arr[i - 1] as number) > 1) acc.push('...')
                acc.push(p)
                return acc
              }, [])
              .map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-xs text-[#6b7280]">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className={`px-2.5 py-1 text-xs border rounded-lg transition-colors ${
                      safePage === p
                        ? 'bg-[#128c7e] text-white border-[#128c7e]'
                        : 'border-[#e5e7eb] text-[#6b7280] hover:bg-[#f5f5f5]'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-2.5 py-1 text-xs border border-[#e5e7eb] rounded-lg text-[#6b7280] hover:bg-[#f5f5f5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Próxima ›
            </button>
          </div>
        )}
      </div>

      {reportFile && (
        <ReportModal
          filename={reportFile.filename}
          pdfBase64={reportFile.base64}
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

function ReportModal({ filename, pdfBase64, members, onClose }: {
  filename: string
  pdfBase64: string
  members: Member[]
  onClose: () => void
}) {
  const [channel,     setChannel]     = useState<'whatsapp' | 'email' | 'both'>('whatsapp')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isPending,   startTransition] = useTransition()
  const [result,      setResult]      = useState<{ error?: string; success?: boolean; sent?: number } | null>(null)

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
        pdfBase64,
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
            Relatório enviado para {result.sent} destinatário{result.sent !== 1 ? 's' : ''}!
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
            <div className="flex gap-2">
              <input type="date" name="due_date"
                defaultValue={task?.due_date ? task.due_date.split('T')[0] : ''}
                className="flex-1 border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#128c7e]"
              />
              <input type="time" name="due_time"
                defaultValue={task?.due_time ? task.due_time.slice(0,5) : ''}
                className="w-28 border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#128c7e]"
              />
            </div>
            <p className="text-xs text-[#6b7280] mt-1">Horário opcional — necessário para lembretes de prazo</p>
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
