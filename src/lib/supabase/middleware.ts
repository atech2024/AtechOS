import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const protectedRoute = request.nextUrl.pathname === '/onboarding' || request.nextUrl.pathname.startsWith('/onboarding/') || request.nextUrl.pathname === '/dashboard' || request.nextUrl.pathname.startsWith('/dashboard/')
  let response = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  // Do not crash the entire Next.js middleware when the Vercel environment
  // variables are missing from a preview/first deployment. The application
  // pages that require Supabase will still surface their own configuration
  // requirements, but public routing remains available.
  if (!supabaseUrl || !supabaseKey) {
    return protectedRoute ? NextResponse.redirect(new URL('/login', request.url)) : response
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (protectedRoute && !user) {
      const redirect = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie))
      redirect.headers.set('Cache-Control', 'private, no-store')
      return redirect
    }
  } catch {
    if (protectedRoute) return NextResponse.redirect(new URL('/login', request.url))
    // Never turn a Supabase session-refresh failure into a 500 middleware
    // invocation. The request can continue and the route can handle auth.
  }

  return response
}
