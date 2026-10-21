import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (code) {
    try {
      const supabase = await createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        const next = request.nextUrl.searchParams.get('next')
        const destination = next === '/reset-password' ? '/reset-password' : '/auth/continue'
        return NextResponse.redirect(new URL(destination, request.url))
      }
    } catch {
      // Show a recoverable error without exposing tokens or internal details.
    }
  }
  return NextResponse.redirect(new URL('/auth/error', request.url))
}


