'use client'

import { T } from '@/components/translation-provider'
import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthPageShell } from '@/components/auth-page-shell'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        setError('We couldn’t sign you in. Check your email and password, then try again.')
        return
      }

      router.replace('/auth/continue')
      router.refresh()
    } catch {
      setError('Unable to complete the request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell kind="login">
      <div className="auth-heading">
        <span className="auth-heading__eyebrow"><T text="Secure access for your school" /></span>
        <h1><T text="Sign in" /></h1>
        <p><T text="Access your school workspace securely." /></p>
      </div>

      <Link href="/student/login" className="auth-student-link">
        <span className="auth-student-link__icon" aria-hidden="true">ID</span>
        <span><T text="Student login with AtechOS ID" /></span>
        <span className="auth-student-link__arrow" aria-hidden="true">↗</span>
      </Link>

      <form onSubmit={handleSubmit} className="auth-form">
        <label className="auth-field">
          <span><T text="Email" /></span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@school.com"
          />
        </label>
        <label className="auth-field">
          <span><T text="Password" /></span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />
        </label>
        <div className="auth-recovery-row">
          <Link href="/forgot-password"><T text="Forgot password?" /></Link>
        </div>
        {error && <p className="auth-message auth-message--error" role="alert"><T text={error} /></p>}
        <button disabled={loading} type="submit" className="auth-submit">
          <T text={loading ? 'Signing in…' : 'Continue'} />
          <span aria-hidden="true">→</span>
        </button>
      </form>

      <p className="auth-switch">
        <T text="Need an account?" />{' '}
        <Link href="/signup"><T text="Create account" /></Link>
      </p>
    </AuthPageShell>
  )
}
