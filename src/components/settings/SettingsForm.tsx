'use client'

import { useState, useTransition } from 'react'
import { Bell, Clock, CheckCircle2, Mail, MessageSquare, BarChart3 } from 'lucide-react'
import { saveSettings } from '@/lib/actions/settings'

type Settings = {
  report_daily: boolean
  report_weekly: boolean
  report_monthly: boolean
  report_channel: string
  report_morning_time: string
  report_evening_time: string
  reminder_1day: boolean
  reminder_1hour: boolean
  reminder_same_day: boolean
  alert_overdue_next_day: boolean
}

function Toggle({ name, checked, onChange, label, description }: {
  name: string
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-[#6b7280] mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative shrink-0 mt-0.5 w-10 h-6 rounded-full overflow-hidden transition-colors focus:outline-none focus:ring-2 focus:ring-[#128c7e] focus:ring-offset-2"
        style={{ backgroundColor: checked ? '#128c7e' : '#e5e7eb' }}
      >
        <span
          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-[left] duration-150"
          style={{ left: checked ? '20px' : '4px' }}
        />
      </button>
      {/* input hidden para o FormData */}
      {checked && <input type="hidden" name={name} value="on" />}
    </div>
  )
}

function Section({ icon: Icon, title, children }: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-[#e5e7eb] overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#e5e7eb] bg-[#f9fafb]">
        <Icon size={16} className="text-[#128c7e]" />
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      <div className="px-5 divide-y divide-[#e5e7eb]">
        {children}
      </div>
    </div>
  )
}

function formatTime(t: string) {
  const [h, m] = t.split(':')
  return m === '00' ? `${parseInt(h)}h` : `${parseInt(h)}h${m}`
}

export function SettingsForm({ initialSettings }: { initialSettings: Settings | null }) {
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [cfg, setCfg] = useState<Settings>(() => initialSettings ?? {
    report_daily: true,
    report_weekly: true,
    report_monthly: true,
    report_channel: 'whatsapp',
    report_morning_time: '08:00',
    report_evening_time: '18:00',
    reminder_1day: true,
    reminder_1hour: false,
    reminder_same_day: true,
    alert_overdue_next_day: true,
  })

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSaved(false)
    setCfg(prev => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaved(false)
    setError('')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await saveSettings(formData)
      if (result?.error) setError(result.error)
      else setSaved(true)
    })
  }

  if (!initialSettings) {
    return (
      <div className="bg-white rounded-xl border border-[#e5e7eb] p-8 text-center text-sm text-[#6b7280]">
        Configurações não encontradas. Verifique se o workspace foi criado corretamente.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">

      {/* Relatórios */}
      <Section icon={BarChart3} title="Relatórios automáticos">
        <Toggle name="report_daily"   checked={cfg.report_daily}   onChange={v => set('report_daily', v)}
          label="Relatório diário"   description={`Tarefas abertas às ${formatTime(cfg.report_morning_time)} e concluídas às ${formatTime(cfg.report_evening_time)}`} />
        <Toggle name="report_weekly"  checked={cfg.report_weekly}  onChange={v => set('report_weekly', v)}
          label="Relatório semanal"  description={`Resumo de produtividade toda segunda-feira às ${formatTime(cfg.report_morning_time)}`} />
        <Toggle name="report_monthly" checked={cfg.report_monthly} onChange={v => set('report_monthly', v)}
          label="Relatório mensal"   description={`Resumo de produtividade todo dia 1 às ${formatTime(cfg.report_morning_time)}`} />

        {/* Canal */}
        <div className="py-3">
          <p className="text-sm font-medium mb-3">Canal de entrega</p>
          <div className="flex gap-3">
            {[
              { value: 'whatsapp', label: 'WhatsApp', Icon: MessageSquare },
              { value: 'email',    label: 'E-mail',   Icon: Mail },
              { value: 'both',     label: 'Ambos',    Icon: Bell },
            ].map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => set('report_channel', value)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border flex-1 justify-center text-sm font-medium transition-colors ${
                  cfg.report_channel === value
                    ? 'border-[#128c7e] bg-[#128c7e]/5 text-[#128c7e]'
                    : 'border-[#e5e7eb] text-[#6b7280] hover:border-[#128c7e]/50'
                }`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
          <input type="hidden" name="report_channel" value={cfg.report_channel} />
        </div>

        {/* Horários */}
        <div className="py-3 flex items-center gap-6">
          <div>
            <label className="block text-xs font-medium text-[#6b7280] mb-1.5">Relatório manhã</label>
            <input type="time" name="report_morning_time"
              value={cfg.report_morning_time}
              onChange={e => set('report_morning_time', e.target.value)}
              className="border border-[#e5e7eb] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#128c7e] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6b7280] mb-1.5">Relatório noite</label>
            <input type="time" name="report_evening_time"
              value={cfg.report_evening_time}
              onChange={e => set('report_evening_time', e.target.value)}
              className="border border-[#e5e7eb] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#128c7e] transition-colors"
            />
          </div>
        </div>
      </Section>

      {/* Lembretes */}
      <Section icon={Clock} title="Lembretes de prazo">
        <Toggle name="reminder_1day"     checked={cfg.reminder_1day}     onChange={v => set('reminder_1day', v)}
          label="1 dia antes do vencimento"  description="Avisa o responsável e o admin na véspera" />
        <Toggle name="reminder_1hour"    checked={cfg.reminder_1hour}    onChange={v => set('reminder_1hour', v)}
          label="1 hora antes do vencimento" description="Aviso de última hora para tarefas urgentes" />
        <Toggle name="reminder_same_day" checked={cfg.reminder_same_day} onChange={v => set('reminder_same_day', v)}
          label="No dia do vencimento"       description="Aviso logo pela manhã no dia que vence" />
      </Section>

      {/* Alertas */}
      <Section icon={Bell} title="Alertas de atraso">
        <Toggle name="alert_overdue_next_day" checked={cfg.alert_overdue_next_day} onChange={v => set('alert_overdue_next_day', v)}
          label="Alertar tarefas vencidas"
          description="Notifica admin e responsável no dia seguinte ao vencimento se a tarefa não foi concluída" />
      </Section>

      {/* Salvar */}
      <div className="flex items-center gap-4 pt-1">
        <button type="submit" disabled={isPending}
          className="bg-[#128c7e] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#39a878] transition-colors disabled:opacity-50">
          {isPending ? 'Salvando...' : 'Salvar configurações'}
        </button>
        {saved && (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle2 size={16} /> Configurações salvas
          </div>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </form>
  )
}
