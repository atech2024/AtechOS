'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
     },
  })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (data.session) {
      router.replace('/onboarding')
      return
    }

    setMessage('Account created. Check your email to confirm your account, then sign in and continue school setup.')
    setLoading(false)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to complete the request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-10">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-slate-200">
        <p className="text-sm font-semibold text-blue-600">AtechOS</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Create admin account</h1>
        <p className="mt-2 text-slate-500">Start a new school workspace.</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <Field name="full_name" label="Full name" placeholder="Your full name" required />
          <Field name="email" label="Email" type="email" placeholder="you@school.com" required />
          <Field name="password" label="Password" type="password" placeholder="At least 8 characters" required minLength={8} />
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {message && <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</p>}
          <button disabled={loading} type="submit" className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">Already have an account? <Link href="/login" className="font-semibold text-blue-600 hover:underline">Sign in</Link></p>
      </section>
    </main>
  )
}

function Field({ name, label, placeholder, type = 'text', required = false, minLength }: { name: string; label: string; placeholder: string; type?: string; required?: boolean; minLength?: number }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input name={name} type={type} required={required} minLength={minLength} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500" />
    </label>
  )
}
