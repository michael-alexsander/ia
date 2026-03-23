'use client'

import { useState, useEffect } from 'react'
import { Menu, Sun, Moon } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { SuspendedOverlay } from '@/components/billing/SuspendedOverlay'
import { useTheme } from '@/components/ThemeProvider'
import type { PlanName } from '@/lib/plans'

interface DashboardShellProps {
  children: React.ReactNode
  workspaceName: string
  workspacePlan: PlanName
  workspaceStatus: 'active' | 'inactive' | 'suspended'
  userRole: 'admin' | 'member'
  adminEmail: string | null
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <polyline
        points="20 6 9 17 4 12"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function DashboardShell({
  children,
  workspaceName,
  workspacePlan,
  workspaceStatus,
  userRole,
  adminEmail,
}: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored === 'true') setCollapsed(true)
  }, [])

  function toggleCollapsed() {
    setCollapsed(v => {
      localStorage.setItem('sidebar-collapsed', String(!v))
      return !v
    })
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      {/* Overlay de workspace suspenso */}
      {workspaceStatus === 'suspended' && (
        <SuspendedOverlay
          workspaceName={workspaceName}
          plan={workspacePlan}
          isAdmin={userRole === 'admin'}
          adminEmail={adminEmail ?? undefined}
        />
      )}

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header
          className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-2.5 shadow-sm"
          style={{ backgroundColor: '#128c7e' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="text-white p-1"
              aria-label="Abrir menu"
            >
              <Menu size={22} />
            </button>
            {/* Fake-logo mobile */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/20">
                <CheckIcon />
              </div>
              <span className="font-bold text-sm text-white">TarefaApp</span>
            </div>
          </div>

          {/* Toggle dark/light no mobile */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-white/80 hover:text-white transition-colors"
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </header>

        {/* Desktop: botão de tema flutuante no canto */}
        <div className="hidden lg:flex absolute top-3 right-4 z-10">
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg transition-all"
            style={{
              backgroundColor: 'var(--muted)',
              color: 'var(--muted-foreground)',
              border: '1px solid var(--border)',
            }}
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>

        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
