import { getSettings } from '@/lib/actions/settings'
import { SettingsForm } from '@/components/settings/SettingsForm'

export default async function SettingsPage() {
  const settings = await getSettings()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-[#6b7280] mt-0.5">Relatórios automáticos, lembretes e alertas do agente</p>
      </div>
      <SettingsForm initialSettings={settings} />
    </div>
  )
}
