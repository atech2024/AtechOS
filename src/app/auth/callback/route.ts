import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (code) {
    try {
      const supabase = await createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) return NextResponse.redirect(new URL('/auth/continue', request.url))
    } catch {
      // Show a recoverable error without exposing tokens or internal details.
    }
  }
  return NextResponse.redirect(new URL('/auth/error', request.url))
}


