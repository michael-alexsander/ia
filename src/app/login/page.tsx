'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

type Mode = 'options' | 'email_password' | 'magic_link'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('options')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const supabase = createClient()

  async function handleGoogle() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleEmailPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('E-mail ou senha incorretos.')
    setLoading(false)
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setError(error.message)
    } else {
      setMessage('Link enviado! Verifique seu e-mail.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
      <div className="bg-white rounded-xl shadow-sm border border-[#e5e7eb] w-full max-w-sm p-8">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#128c7e] flex items-center justify-center">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <span className="font-bold text-lg text-[#128c7e]">TarefaApp</span>
          </div>
        </div>

        {/* Opções iniciais */}
        {mode === 'options' && (
          <>
            <h1 className="text-xl font-semibold text-center mb-1">Entrar na sua conta</h1>
            <p className="text-sm text-[#6b7280] text-center mb-6">Escolha como deseja acessar</p>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleGoogle}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 border border-[#e5e7eb] rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[#f5f5f5] transition-colors disabled:opacity-50"
              >
                <GoogleIcon />
                Entrar com Google
              </button>

              <button
                onClick={() => setMode('email_password')}
                className="w-full flex items-center justify-center gap-3 bg-[#128c7e] text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[#39a878] transition-colors"
              >
                Entrar com e-mail e senha
              </button>

              <button
                onClick={() => setMode('magic_link')}
                className="w-full flex items-center justify-center gap-3 border border-[#e5e7eb] rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[#f5f5f5] transition-colors"
              >
                Receber link mágico por e-mail
              </button>
            </div>
          </>
        )}

        {/* E-mail + Senha */}
        {mode === 'email_password' && (
          <>
            <button onClick={() => { setMode('options'); setError('') }} className="text-sm text-[#6b7280] hover:text-[#128c7e] mb-4 flex items-center gap-1">
              ← Voltar
            </button>
            <h1 className="text-xl font-semibold mb-5">Entrar com e-mail</h1>
            <form onSubmit={handleEmailPassword} className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#128c7e] transition-colors"
              />
              <input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#128c7e] transition-colors"
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#128c7e] text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[#39a878] transition-colors disabled:opacity-50 mt-1"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
            <button
              onClick={() => setMode('magic_link')}
              className="w-full text-center text-sm text-[#6b7280] hover:text-[#128c7e] mt-4"
            >
              Prefere receber um link por e-mail?
            </button>
          </>
        )}

        {/* Magic Link */}
        {mode === 'magic_link' && (
          <>
            <button onClick={() => { setMode('options'); setError(''); setMessage('') }} className="text-sm text-[#6b7280] hover:text-[#128c7e] mb-4 flex items-center gap-1">
              ← Voltar
            </button>
            <h1 className="text-xl font-semibold mb-1">Link mágico</h1>
            <p className="text-sm text-[#6b7280] mb-5">Enviaremos um link de acesso para seu e-mail. Sem senha necessária.</p>
            {message ? (
              <div className="bg-[#f0fdf9] border border-[#00baa5] rounded-lg p-4 text-sm text-[#128c7e] text-center">
                {message}
              </div>
            ) : (
              <form onSubmit={handleMagicLink} className="flex flex-col gap-3">
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#128c7e] transition-colors"
                />
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#128c7e] text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[#39a878] transition-colors disabled:opacity-50"
                >
                  {loading ? 'Enviando...' : 'Enviar link'}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
      <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
      <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
    </svg>
  )
}
