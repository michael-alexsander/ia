'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { CheckSquare, Users, FolderOpen, Settings, LogOut, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/tasks',    label: 'Tarefas',       icon: CheckSquare },
  { href: '/members',  label: 'Membros',        icon: Users },
  { href: '/groups',   label: 'Grupos',         icon: FolderOpen },
  { href: '/settings', label: 'Configurações',  icon: Settings },
]

type SidebarProps = {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const sidebarContent = (isMobile = false) => (
    <aside className={`
      flex flex-col h-full bg-white border-r border-[#e5e7eb]
      transition-all duration-200
      ${!isMobile && (collapsed ? 'w-16' : 'w-56')}
      ${isMobile ? 'w-64' : ''}
    `}>
      {/* Logo */}
      <div className={`bg-[#128c7e] flex items-center shrink-0 ${collapsed && !isMobile ? 'p-3 justify-center' : 'px-4 py-3'}`}>
        {collapsed && !isMobile ? (
          <Image src="/favicon.png" alt="T" width={32} height={32} className="w-8 h-8 object-contain" priority />
        ) : (
          <div className="flex items-center justify-between w-full">
            <Image src="/logo.png" alt="TarefaApp" width={150} height={38} className="h-8 w-auto object-contain" priority />
            {isMobile && (
              <button onClick={onMobileClose} className="text-white/80 hover:text-white ml-2">
                <X size={18} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              onClick={isMobile ? onMobileClose : undefined}
              title={collapsed && !isMobile ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-colors
                ${collapsed && !isMobile ? 'justify-center' : ''}
                ${active ? 'bg-[#128c7e] text-white' : 'text-[#6b7280] hover:bg-[#f5f5f5] hover:text-[#128c7e]'}
              `}
            >
              <Icon size={16} className="shrink-0" />
              {(!collapsed || isMobile) && <span className="truncate">{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: Logout + Collapse toggle */}
      <div className="px-2 py-3 border-t border-[#e5e7eb] flex flex-col gap-1">
        <button
          onClick={handleLogout}
          title={collapsed && !isMobile ? 'Sair' : undefined}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-sm font-medium text-[#6b7280] hover:bg-[#f5f5f5] hover:text-red-500 transition-colors
            ${collapsed && !isMobile ? 'justify-center' : ''}
          `}
        >
          <LogOut size={16} className="shrink-0" />
          {(!collapsed || isMobile) && 'Sair'}
        </button>

        {/* Collapse toggle — desktop only */}
        {!isMobile && (
          <button
            onClick={onToggleCollapse}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg w-full text-xs text-[#6b7280] hover:bg-[#f5f5f5] transition-colors
              ${collapsed ? 'justify-center' : ''}
            `}
          >
            {collapsed ? <ChevronRight size={15} /> : <><ChevronLeft size={15} /><span>Recolher menu</span></>}
          </button>
        )}
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-screen sticky top-0 shrink-0">
        {sidebarContent(false)}
      </div>

      {/* Mobile drawer */}
      <div className={`
        lg:hidden fixed inset-y-0 left-0 z-50 flex
        transition-transform duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {sidebarContent(true)}
      </div>
    </>
  )
}
