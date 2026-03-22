import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

function createAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/tasks'

  if (code) {
    const response = NextResponse.redirect(`${origin}${next}`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data?.user) {
      // Se o usuário tem email, verifica se é um membro convidado e vincula automaticamente
      const email = data.user.email
      if (email) {
        const admin = createAdminClient()
        // Procura membro com esse email sem user_id vinculado ainda
        const { data: member } = await admin
          .from('members')
          .select('id, status')
          .eq('email', email)
          .is('user_id', null)
          .in('status', ['invited', 'active'])
          .limit(1)
          .single()

        if (member) {
          // Vincula o user_id e garante que o status é active
          await admin
            .from('members')
            .update({ user_id: data.user.id, status: 'active' })
            .eq('id', member.id)
          console.log(`[auth/callback] membro ${member.id} vinculado ao user ${data.user.id}`)
        }
      }
      return response
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
