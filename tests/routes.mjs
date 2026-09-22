import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'

const port = 3217
const origin = `http://localhost:${port}`
// This suite intentionally verifies safe behavior without deployment secrets.
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' }
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port), '-H', 'localhost'], { env, stdio: ['ignore', 'pipe', 'pipe'] })
let output = ''
server.stdout.on('data', data => { output += data })
server.stderr.on('data', data => { output += data })
let checks = 0
try {
  let ready = false
  for (let i = 0; i < 90; i++) {
    if (server.exitCode !== null) throw new Error(output)
    try { if ((await fetch(origin)).ok) { ready = true; break } } catch {}
    await delay(500)
  }
  assert.ok(ready, output)
  for (const [path, heading, form] of [['/', 'The Operating System', false], ['/signup', 'Create your account', true], ['/login', 'Sign in', true], ['/auth/error', 'Unable to complete email confirmation', false], ['/invitation', 'School invitation', true]]) {
    const response = await fetch(origin + path)
    assert.equal(response.status, 200, path)
    const html = await response.text()
    assert.ok(html.includes(heading), path)
    assert.equal(html.includes('<form'), form, path)
    checks++
  }
  for (const [path, destination] of [['/signin', '/login'], ['/onboarding', '/login'], ['/dashboard', '/login'], ['/dashboard/students', '/login'], ['/dashboard/assignments', '/login'], ['/auth/callback', '/auth/error'], ['/auth/callback?code=invalid&next=https://example.com', '/auth/error']]) {
    const response = await fetch(origin + path, { redirect: 'manual' })
    assert.equal(response.status, 307, path)
    assert.equal(new URL(response.headers.get('location'), origin).pathname, destination, path)
    assert.equal(new URL(response.headers.get('location'), origin).origin, origin, path)
    checks++
  }
  const token = 'ab'.repeat(32)
  const invite = await fetch(`${origin}/invite?token=${token}`, { redirect: 'manual' })
  assert.equal(invite.status, 307)
  assert.equal(new URL(invite.headers.get('location')).pathname, '/invitation')
  assert.ok(invite.headers.get('set-cookie').includes(`atechos_invitation=${token}`))
  assert.match(invite.headers.get('set-cookie'), /HttpOnly/i)
  assert.match(invite.headers.get('set-cookie'), /SameSite=lax/i)
  assert.equal(invite.headers.get('referrer-policy'), 'no-referrer')
  assert.match(invite.headers.get('cache-control'), /no-store/)
  checks++
  const invalid = await fetch(`${origin}/invite?token=not-a-token`, { redirect: 'manual' })
  assert.match(invalid.headers.get('set-cookie'), /atechos_invitation=;/)
  checks++
  for (const [cookie, destination] of [['', '/onboarding'], [`atechos_invitation=${token}`, '/invitation']]) {
    const response = await fetch(`${origin}/auth/continue?next=https://example.com`, { redirect: 'manual', headers: { cookie } })
    assert.equal(new URL(response.headers.get('location')).pathname, destination)
    assert.equal(new URL(response.headers.get('location')).origin, origin)
    checks++
  }
  console.log(`PASS: ${checks} production HTTP checks (public forms, redirects, missing configuration, invitation cookies, invalid confirmation).`)
} finally {
  server.kill()
  if (server.exitCode === null) await once(server, 'exit')
}


