'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
      setError(signInError.message)
      setLoading(false)
      return
    }

    router.replace('/auth/continue')
    router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to complete the request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-slate-200">
        <div className="mb-8">
          <Link href="/" className="text-sm font-semibold text-blue-600">AtechOS</Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Sign in</h1>
          <p className="mt-2 text-slate-500">Access your school workspace securely.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} name="email" type="email" autoComplete="email" required className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500" placeholder="you@school.com" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input value={password} onChange={(e) => setPassword(e.target.value)} name="password" type="password" autoComplete="current-password" required className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500" placeholder="••••••••" />
          </label>
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button disabled={loading} type="submit" className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? 'Signing in…' : 'Continue'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500"><Link href="/" className="text-blue-600 hover:underline">Back to AtechOS</Link></p>
      </section>
    </main>
  )
}

