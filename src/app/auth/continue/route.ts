import { NextRequest, NextResponse } from 'next/server'

function safeInternalPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  return value
}

export async function GET(request: NextRequest) {
  const requestedPath = safeInternalPath(request.nextUrl.searchParams.get('next'))
  const destination = request.cookies.has('atechos_invitation') ? '/invitation' : requestedPath || '/onboarding'
  const response = NextResponse.redirect(new URL(destination, request.url))
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
