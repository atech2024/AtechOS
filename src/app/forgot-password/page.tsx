'use client'

import { T } from '@/components/translation-provider'
import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AuthPageShell } from '@/components/auth-page-shell'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSent(false)

    try {
      const supabase = createClient()
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      })

      if (recoveryError) {
        setError('We couldn’t send the request. Please try again later.')
        return
      }

      setSent(true)
    } catch {
      setError('We couldn’t send the request. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell kind="recovery">
      <div className="auth-heading">
        <span className="auth-heading__eyebrow"><T text="Account recovery" /></span>
        <h1><T text="Password recovery" /></h1>
        <p><T text="Enter the email used for your AtechOS account. If an account matches, we’ll send a reset link." /></p>
      </div>

      {sent ? (
        <div className="auth-message auth-message--success" role="status" aria-live="polite">
          <T text="If an account matches this address, a reset link has been sent. Check your inbox and follow it in this same browser." />
        </div>
      ) : (
        <form onSubmit={submit} className="auth-form">
          <label className="auth-field">
            <span><T text="Email" /></span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              placeholder="you@school.com"
            />
          </label>
          {error && <p className="auth-message auth-message--error" role="alert"><T text={error} /></p>}
          <button disabled={loading} type="submit" className="auth-submit">
            <T text={loading ? 'Sending…' : 'Send reset link'} />
            <span aria-hidden="true">→</span>
          </button>
        </form>
      )}

      <p className="auth-switch">
        <Link href="/login"><T text="Back to sign in" /></Link>
      </p>
    </AuthPageShell>
  )
}
