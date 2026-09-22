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
  for (const [path, heading, form] of [['/', 'The Operating System', false], ['/signup', 'Create admin account', true], ['/login', 'Sign in', true], ['/auth/error', 'Unable to complete email confirmation', false]]) {
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
  console.log(`PASS: ${checks} production HTTP checks (public forms, redirects, missing configuration, invalid confirmation).`)
} finally {
  server.kill()
  if (server.exitCode === null) await once(server, 'exit')
}

