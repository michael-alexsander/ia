'use client'

import { useState, useEffect } from 'react'
import { Menu, Sun, Moon, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { SuspendedOverlay } from '@/components/billing/SuspendedOverlay'
import { useTheme } from '@/components/ThemeProvider'
import { createClient } from '@/lib/supabase/client'
import type { PlanName } from '@/lib/plans'

interface DashboardShellProps {
  children: React.ReactNode
  workspaceName: string
  workspacePlan: PlanName
  workspaceStatus: 'active' | 'inactive' | 'suspended'
  userRole: 'admin' | 'member'
  adminEmail: string | null
  userName?: string
  userAvatar?: string
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="12" fill="white" />
      <path
        d="M15 21l-5-5 1.414-1.414L15 18.172l7.586-7.586L24 12l-9 9z"
        fill="#128c7e"
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
  userName,
  userAvatar,
}: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()

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

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      {workspaceStatus === 'suspended' && (
        <SuspendedOverlay
          workspaceName={workspaceName}
          plan={workspacePlan}
          isAdmin={userRole === 'admin'}
          adminEmail={adminEmail ?? undefined}
        />
      )}

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

        {/* ── Mobile top bar ────────────────────────────── */}
        <header
          className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-2.5 shrink-0"
          style={{ backgroundColor: 'var(--muted)', borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              style={{ color: 'var(--muted-foreground)' }}
              className="p-1"
              aria-label="Abrir menu"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: '#128c7e' }}
              >
                <CheckIcon size={15} />
              </div>
              <span className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>TarefaApp</span>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </header>

        {/* ── Desktop top bar ───────────────────────────── */}
        <header
          className="hidden lg:flex items-center justify-end gap-2.5 px-6 shrink-0"
          style={{
            height: '52px',
            backgroundColor: 'var(--muted)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {/* Toggle dark/light */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg transition-all"
            style={{
              backgroundColor: 'var(--background)',
              color: 'var(--muted-foreground)',
              border: '1px solid var(--border)',
            }}
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Avatar + nome */}
          {userName && (
            <div className="flex items-center gap-2">
              {userAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={userAvatar} alt={userName} className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: '#128c7e' }}
                >
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                {userName}
              </span>
            </div>
          )}

          {/* Sair */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-all cursor-pointer"
            style={{
              backgroundColor: 'rgba(239,68,68,0.08)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            <LogOut size={13} />
            <span>Sair</span>
          </button>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
