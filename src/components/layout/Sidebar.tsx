'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CheckSquare, Users, FolderOpen, Settings, ChevronLeft, ChevronRight, X } from 'lucide-react'

const navItems = [
  { href: '/tasks',    label: 'Tarefas',      icon: CheckSquare },
  { href: '/members',  label: 'Membros',       icon: Users },
  { href: '/groups',   label: 'Grupos',        icon: FolderOpen },
  { href: '/settings', label: 'Configurações', icon: Settings },
]

type SidebarProps = {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="12" fill="white" />
      <path
        d="M15 21l-5-5 1.414-1.414L15 18.172l7.586-7.586L24 12l-9 9z"
        fill="#128c7e"
      />
    </svg>
  )
}

function Logo({ collapsed, isMobile }: { collapsed: boolean; isMobile: boolean }) {
  const isCollapsed = collapsed && !isMobile
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: '#128c7e' }}
      >
        <CheckIcon />
      </div>
      {!isCollapsed && (
        <span className="font-bold text-sm truncate" style={{ color: 'var(--sidebar-text)' }}>TarefaApp</span>
      )}
    </div>
  )
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname()

  const sidebarContent = (isMobile = false) => {
    const isCollapsed = collapsed && !isMobile
    return (
      <aside
        className={`flex flex-col h-full transition-all duration-200 ${isCollapsed ? 'w-16' : isMobile ? 'w-64' : 'w-60'}`}
        style={{
          backgroundColor: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--sidebar-border)',
        }}
      >
        {/* Logo + toggle */}
        <div
          className={`shrink-0 flex items-center ${isCollapsed ? 'flex-col gap-2 py-3 px-2' : 'px-3 py-2 h-14'}`}
          style={{ backgroundColor: 'var(--sidebar-bg)', borderBottom: '1px solid var(--sidebar-border)' }}
        >
          {isCollapsed ? (
            <>
              <Logo collapsed={true} isMobile={false} />
              <button
                onClick={onToggleCollapse}
                title="Expandir menu"
                className="transition-colors"
                style={{ color: 'var(--sidebar-text)' }}
              >
                <ChevronRight size={16} />
              </button>
            </>
          ) : (
            <div className="flex items-center justify-between w-full gap-1">
              <Logo collapsed={false} isMobile={isMobile} />
              {isMobile ? (
                <button onClick={onMobileClose} className="shrink-0 ml-1" style={{ color: 'var(--sidebar-text)' }}>
                  <X size={18} />
                </button>
              ) : (
                <button
                  onClick={onToggleCollapse}
                  title="Recolher menu"
                  className="shrink-0 ml-1 transition-colors"
                  style={{ color: 'var(--sidebar-text)' }}
                >
                  <ChevronLeft size={16} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                onClick={isMobile ? onMobileClose : undefined}
                title={isCollapsed ? label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-colors ${isCollapsed ? 'justify-center' : ''}`}
                style={{
                  backgroundColor: active ? 'rgba(18,140,126,0.15)' : 'transparent',
                  color: active ? 'var(--primary)' : 'var(--sidebar-text)',
                  borderLeft: !isCollapsed && active ? '2px solid var(--primary)' : '2px solid transparent',
                }}
              >
                <Icon size={16} className="shrink-0" />
                {!isCollapsed && <span className="truncate">{label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Rodapé: versão */}
        <div className="px-4 py-3" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
          {!isCollapsed && (
            <span className="text-xs" style={{ color: 'var(--sidebar-text)', opacity: 0.6 }}>
              TarefaApp v2.1
            </span>
          )}
        </div>
      </aside>
    )
  }

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-screen sticky top-0 shrink-0">
        {sidebarContent(false)}
      </div>

      {/* Mobile drawer */}
      <div
        className={`lg:hidden fixed inset-y-0 left-0 z-50 flex transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {sidebarContent(true)}
      </div>
    </>
  )
}
