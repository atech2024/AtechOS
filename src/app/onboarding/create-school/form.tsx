'use client'
import Image from 'next/image'
import { schoolPlanIds } from '@/lib/subscription-pricing'
import { translate } from '@/lib/translations'
import { T, useLocale } from '@/components/translation-provider'
import Link from 'next/link'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function CreateSchoolForm({ trialEnabled }: { trialEnabled: boolean }) {
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
      ...(trialEnabled ? { p_trial_plan: String(form.get('trial_plan') || 'attendance') } : {}),
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
        <Link href="/onboarding" aria-label="AtechOS" className="inline-flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
          <Image src="/landing/atechos-logo-mark.webp" alt="" width={46} height={46} priority className="h-11 w-12 object-contain"/>
          <Image src="/landing/atechos-logo-wordmark.webp" alt="" width={150} height={42} priority className="h-auto w-32 object-contain"/>
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-slate-900"><T text="Create your school"/></h1>
        <p className="mt-2 text-slate-500"><T text="Set up the school workspace and make this account the first school administrator."/></p>

        <form onSubmit={submit} className="mt-8 space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <Field name="school_name" label="School name" placeholder="Example Academy" required />
            <Field name="school_code" label="School identifier" placeholder="ATS-001" required />
            <Field name="school_email" label="School email" type="email" placeholder="admin@school.com" />
            <Field name="school_phone" label="School phone" placeholder="+509 ..." />
          </div>

          <Field name="school_address" label="School address" placeholder="Address" />

          <div className="border-t border-slate-200 pt-6">
            <h2 className="text-lg font-semibold text-slate-900"><T text="Administrator"/></h2>
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <Field name="admin_full_name" label="Full name" placeholder="School administrator" />
              <Field name="admin_phone" label="Phone" placeholder="+509 ..." />
            </div>
          </div>

          {trialEnabled && <label className="grid gap-2 border-t border-slate-200 pt-6 text-sm font-medium text-slate-800">
            <T text="Trial plan"/>
            <select name="trial_plan" defaultValue="attendance" disabled={loading} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
              {schoolPlanIds.map(plan => <option key={plan} value={plan}><T text={plan === 'attendance' ? 'Attendance plan' : plan === 'school' ? 'School plan' : 'School + Finance plan'}/></option>)}
            </select>
            <span className="font-normal leading-6 text-slate-600"><T text="The 30-day trial starts when you create your school. Changing plans keeps the same end date."/></span>
          </label>}

          {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"><T text={error}/></p>}

          <button disabled={loading} type="submit" className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            <T text={loading ? 'Creating school...' : 'Create school workspace'}/>
          </button>
        </form>
      </section>
    </main>
  )
}

function Field({ name, label, placeholder, type = 'text', required = false }: { name: string; label: string; placeholder: string; type?: string; required?: boolean }) {
  const locale = useLocale()
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700"><T text={label}/></span>
      <input name={name} type={type} required={required} placeholder={translate(placeholder, locale)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500" />
    </label>
  )
}
