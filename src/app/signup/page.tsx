'use client'

import { T, useLocale } from '@/components/translation-provider'
import { translate } from '@/lib/translations'
import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthPageShell } from '@/components/auth-page-shell'

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    const form = new FormData(event.currentTarget)

    try {
      const supabase = createClient()
      const email = String(form.get('email') || '')
      const password = String(form.get('password') || '')
      const fullName = String(form.get('full_name') || '')

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (signUpError) {
        setError('We couldn’t create your account. Check your information and try again.')
        return
      }

      if (data.session) {
        router.replace('/auth/continue')
        return
      }

      setMessage('Check your email to confirm your account, then sign in. If you were invited, reopen your invitation link after confirming your email.')
    } catch {
      setError('Unable to complete the request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell kind="signup">
      <div className="auth-heading">
        <span className="auth-heading__eyebrow"><T text="Secure access for your school" /></span>
        <h1><T text="Create your account" /></h1>
        <p><T text="Join your school with an invitation, or start a new school workspace." /></p>
      </div>

      <form onSubmit={submit} className="auth-form auth-form--signup">
        <Field name="full_name" label="Full name" placeholder="Your full name" autoComplete="name" required />
        <Field name="email" label="Email" type="email" placeholder="you@school.com" autoComplete="email" required />
        <Field name="password" label="Password" type="password" placeholder="At least 8 characters" autoComplete="new-password" required minLength={8} />
        {error && <p className="auth-message auth-message--error" role="alert"><T text={error} /></p>}
        {message && <p className="auth-message auth-message--success" role="status" aria-live="polite"><T text={message} /></p>}
        <button disabled={loading} type="submit" className="auth-submit">
          <T text={loading ? 'Creating account…' : 'Create account'} />
          <span aria-hidden="true">→</span>
        </button>
      </form>

      <p className="auth-switch">
        <T text="Already have an account?" />{' '}
        <Link href="/login"><T text="Sign in" /></Link>
      </p>
    </AuthPageShell>
  )
}

function Field({
  name, label, placeholder, type = 'text', autoComplete, required = false, minLength,
}: {
  name: string
  label: string
  placeholder: string
  type?: string
  autoComplete?: string
  required?: boolean
  minLength?: number
}) {
  const locale = useLocale()
  return (
    <label className="auth-field">
      <span><T text={label} /></span>
      <input
        name={name}
        type={type}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={translate(placeholder, locale)}
      />
    </label>
  )
}
