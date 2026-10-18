'use client'

import { T } from '@/components/translation-provider'
import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AuthPageShell } from '@/components/auth-page-shell'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (password !== confirmation) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError('The link is invalid or expired. Request a new reset link.')
        return
      }
      setSaved(true)
    } catch {
      setError('The link is invalid or expired. Request a new reset link.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell kind="recovery">
      <div className="auth-heading">
        <span className="auth-heading__eyebrow"><T text="Account recovery" /></span>
        <h1><T text="Choose a new password" /></h1>
        <p><T text="Enter a new password of at least 8 characters." /></p>
      </div>

      {saved ? (
        <div className="auth-message auth-message--success" role="status" aria-live="polite">
          <T text="Password updated. You can sign in with your new password." />{' '}
          <Link href="/login"><T text="Back to sign in" /></Link>
        </div>
      ) : (
        <form onSubmit={submit} className="auth-form">
          <label className="auth-field">
            <span><T text="New password" /></span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              placeholder="At least 8 characters"
            />
          </label>
          <label className="auth-field">
            <span><T text="Confirm password" /></span>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              name="password_confirmation"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              placeholder="At least 8 characters"
            />
          </label>
          {error && <p className="auth-message auth-message--error" role="alert"><T text={error} /></p>}
          <button disabled={loading} type="submit" className="auth-submit">
            <T text={loading ? 'Saving…' : 'Save new password'} />
            <span aria-hidden="true">→</span>
          </button>
        </form>
      )}

      {!saved && <p className="auth-switch"><Link href="/forgot-password"><T text="Request another reset link" /></Link></p>}
    </AuthPageShell>
  )
}
