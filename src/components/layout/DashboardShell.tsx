'use client'

import { useState, useEffect } from 'react'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { SuspendedOverlay } from '@/components/billing/SuspendedOverlay'
import Image from 'next/image'
import type { PlanName } from '@/lib/plans'

interface DashboardShellProps {
  children: React.ReactNode
  workspaceName: string
  workspacePlan: PlanName
  workspaceStatus: 'active' | 'inactive' | 'suspended'
  userRole: 'admin' | 'member'
  adminEmail: string | null
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
    <div className="flex min-h-screen bg-[#f5f5f5]">
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
        <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 bg-[#128c7e] px-4 py-3 shadow-sm">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-white p-1"
            aria-label="Abrir menu"
          >
            <Menu size={22} />
          </button>
          <Image src="/logo.png" alt="TarefaApp" width={130} height={32} className="h-7 w-auto" priority />
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
