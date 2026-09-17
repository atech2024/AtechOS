'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Settings = { controls_per_period: number; passing_average: number }

export default function GradingSettingsPage() {
  const supabase = createClient()
  const [controls, setControls] = useState('4')
  const [passing, setPassing] = useState('5')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.rpc('get_grading_settings').then(({ data, error }) => {
      if (error) setError(error.message)
      const row = (data?.[0] || data) as Settings | undefined
      if (row) {
        setControls(String(row.controls_per_period ?? 4))
        setPassing(String(row.passing_average ?? 5))
      }
      setLoading(false)
    })
  }, [])

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true); setError(''); setMessage('')
    const controlCount = Number(controls)
    const passingAverage = Number(passing)
    if (!Number.isInteger(controlCount) || controlCount < 1 || controlCount > 20) {
      setError('Number of controls must be a whole number between 1 and 20.')
      setSaving(false); return
    }
    if (!Number.isFinite(passingAverage) || passingAverage < 0 || passingAverage > 100) {
      setError('Passing average must be between 0 and 100.')
      setSaving(false); return
    }
    const { error } = await supabase.rpc('update_grading_settings', {
      p_controls_per_period: controlCount,
      p_passing_average: passingAverage,
    })
    if (error) setError(error.message)
    else setMessage('Grading settings saved.')
    setSaving(false)
  }

  return <main className="min-h-screen bg-slate-50 p-6 md:p-10"><div className="mx-auto max-w-3xl">
    <header><p className="text-sm font-semibold text-blue-600">AtechOS</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Grading settings</h1><p className="mt-2 text-slate-500">Configure the number of controls allowed in each grading period and the passing average for your school.</p></header>
    {error && <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {message && <p className="mt-6 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}
    <form onSubmit={save} className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-6 md:grid-cols-2">
        <label className="text-sm font-semibold text-slate-800">Controls per grading period<input type="number" min="1" max="20" step="1" value={controls} onChange={e => setControls(e.target.value)} disabled={loading} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base font-normal"/><span className="mt-2 block text-xs font-normal text-slate-500">Default: 4. If your school uses 3 controls, enter 3.</span></label>
        <label className="text-sm font-semibold text-slate-800">Passing average<input type="number" min="0" max="100" step="0.01" value={passing} onChange={e => setPassing(e.target.value)} disabled={loading} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-base font-normal"/><span className="mt-2 block text-xs font-normal text-slate-500">Default: 5. This value is school-configurable.</span></label>
      </div>
      <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><strong>How it works:</strong> teachers enter grades for their assigned subjects. A teacher can see and edit only grades they entered. School administrators and directors can review the school's complete grade records.</div>
      <div className="mt-6 flex justify-end"><button disabled={saving || loading} className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white">{saving ? 'Saving...' : 'Save settings'}</button></div>
    </form>
  </div></main>
