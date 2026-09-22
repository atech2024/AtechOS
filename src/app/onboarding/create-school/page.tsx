'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(event.currentTarget)
    try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc('create_school_onboarding', {
      p_school_name: String(form.get('school_name') || ''),
      p_school_code: String(form.get('school_code') || ''),
      p_school_email: String(form.get('school_email') || ''),
      p_school_phone: String(form.get('school_phone') || ''),
      p_school_address: String(form.get('school_address') || ''),
      p_admin_full_name: String(form.get('admin_full_name') || ''),
      p_admin_phone: String(form.get('admin_phone') || ''),
    })

    if (error) {
      setError(error.message.replace('function ', ''))
      setLoading(false)
      return
    }

    if (!data) throw new Error('School setup did not complete. Please try again.')
    router.replace('/dashboard')
    router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to complete the request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-blue-600">AtechOS</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Create your school</h1>
        <p className="mt-2 text-slate-500">Set up the school workspace and make this account the first school administrator.</p>

        <form onSubmit={submit} className="mt-8 space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Field name="school_name" label="School name" placeholder="Example Academy" required />
            <Field name="school_code" label="School identifier" placeholder="ATS-001" required />
            <Field name="school_email" label="School email" type="email" placeholder="admin@school.com" />
            <Field name="school_phone" label="School phone" placeholder="+509 ..." />
          </div>

          <Field name="school_address" label="School address" placeholder="Address" />

          <div className="border-t border-slate-200 pt-6">
            <h2 className="text-lg font-semibold text-slate-900">Administrator</h2>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <Field name="admin_full_name" label="Full name" placeholder="School administrator" />
              <Field name="admin_phone" label="Phone" placeholder="+509 ..." />
            </div>
          </div>

          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          <button disabled={loading} type="submit" className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? 'Creating school...' : 'Create school workspace'}
          </button>
        </form>
      </section>
    </main>
  )
}

function Field({ name, label, placeholder, type = 'text', required = false }: { name: string; label: string; placeholder: string; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input name={name} type={type} required={required} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500" />
    </label>
  )
}
