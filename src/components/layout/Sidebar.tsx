'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { CheckSquare, Users, FolderOpen, Settings, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/tasks',    label: 'Tarefas',       icon: CheckSquare },
  { href: '/members',  label: 'Membros',        icon: Users },
  { href: '/groups',   label: 'Grupos',         icon: FolderOpen },
  { href: '/settings', label: 'Configurações',  icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-56 min-h-screen bg-white border-r border-[#e5e7eb] flex flex-col">
      {/* Logo */}
      <div className="bg-[#128c7e] px-4 py-3">
        <Image
          src="/logo.png"
          alt="TarefaApp"
          width={160}
          height={40}
          className="w-full h-auto object-contain"
          priority
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-colors ${
                active
                  ? 'bg-[#128c7e] text-white'
                  : 'text-[#6b7280] hover:bg-[#f5f5f5] hover:text-[#128c7e]'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-[#e5e7eb]">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-sm font-medium text-[#6b7280] hover:bg-[#f5f5f5] hover:text-red-500 transition-colors"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  )
}
