import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || ''
  const response = NextResponse.redirect(new URL('/invitation', request.url))
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  if (/^[a-f0-9]{64}$/.test(token)) {
    response.cookies.set('atechos_invitation', token, {
      httpOnly: true, secure: request.nextUrl.protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 7 * 24 * 3600,
    })
  } else {
    response.cookies.delete('atechos_invitation')
  }
  return response
}

