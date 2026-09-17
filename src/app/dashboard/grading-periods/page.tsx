'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Period = {
  id: string
  name: string
  code: string
  start_date: string
  end_date: string
  weight: number
  is_active: boolean
}

export default function GradingPeriodsPage() {
  const supabase = createClient()
  const [periods, setPeriods] = useState<Period[]>([])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [weight, setWeight] = useState('100')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadPeriods() {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_grading_periods')
    if (error) setError(error.message)
    setPeriods((data || []) as Period[])
    setLoading(false)
  }

  useEffect(() => {
    loadPeriods()
  }, [])

  async function createPeriod(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    const cleanName = name.trim()
    const cleanCode = code.trim()
    const numericWeight = Number(weight)

    if (!cleanName || !cleanCode || !startDate || !endDate) {
      setError('Name, code, start date and end date are required.')
      setSaving(false)
      return
    }
    if (endDate < startDate) {
      setError('End date cannot be before start date.')
      setSaving(false)
      return
    }
    if (!Number.isFinite(numericWeight) || numericWeight <= 0) {
      setError('Weight must be greater than 0.')
      setSaving(false)
      return
    }

    const { error } = await supabase.rpc('create_grading_period', {
      p_name: cleanName,
      p_code: cleanCode,
      p_start_date: startDate,
      p_end_date: endDate,
      p_weight: numericWeight,
    })

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    setName('')
    setCode('')
    setStartDate('')
    setEndDate('')
    setWeight('100')
    setMessage('Grading period created.')
    await loadPeriods()
    setSaving(false)
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <header>
          <p className="text-sm font-semibold text-blue-600">AtechOS</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Grading periods</h1>
          <p className="mt-2 text-slate-500">Define the periods used by Grades and student bulletins.</p>
        </header>

        {error && <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {message && <p className="mt-6 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}

        <form onSubmit={createPeriod} className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Create a grading period</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">Name<input value={name} onChange={e => setName(e.target.value)} placeholder="First Period" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3" /></label>
            <label className="text-sm font-medium">Code<input value={code} onChange={e => setCode(e.target.value)} placeholder="P1" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3" /></label>
            <label className="text-sm font-medium">Start date<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3" /></label>
            <label className="text-sm font-medium">End date<input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3" /></label>
            <label className="text-sm font-medium">Bulletin weight (%)<input type="number" min="0.01" step="0.01" value={weight} onChange={e => setWeight(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3" /><span className="mt-1 block text-xs text-slate-500">Used when combining period averages into the final subject average.</span></label>
          </div>
          <div className="mt-5 flex justify-end"><button disabled={saving} className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white">{saving ? 'Saving...' : 'Create period'}</button></div>
        </form>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5"><h2 className="text-lg font-semibold text-slate-900">School grading periods</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50"><tr><th className="px-5 py-3">Period</th><th className="px-5 py-3">Code</th><th className="px-5 py-3">Dates</th><th className="px-5 py-3">Weight</th><th className="px-5 py-3">Status</th></tr></thead>
              <tbody>
                {periods.map(period => <tr key={period.id} className="border-t border-slate-100"><td className="px-5 py-4 font-medium">{period.name}</td><td className="px-5 py-4">{period.code}</td><td className="px-5 py-4 text-slate-500">{period.start_date} → {period.end_date}</td><td className="px-5 py-4">{period.weight}%</td><td className="px-5 py-4">{period.is_active ? 'Active' : 'Inactive'}</td></tr>)}
              </tbody>
            </table>
            {!loading && !periods.length && <p className="p-6 text-slate-500">No grading periods created yet.</p>}
          </div>
        </section>
      </div>
    </main>
  )
}
