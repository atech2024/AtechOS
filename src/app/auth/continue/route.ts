import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const destination = request.cookies.has('atechos_invitation') ? '/invitation' : '/onboarding'
  const response = NextResponse.redirect(new URL(destination, request.url))
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

