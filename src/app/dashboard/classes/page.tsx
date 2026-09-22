'use client'

import { FormEvent, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

type Year = { id: string; name: string; start_date: string; end_date: string; is_current: boolean }
type GradeLevel = { id: string; code: string; name: string; short_name: string; education_level: string; cycle_code: string; sort_order: number }
type SchoolClass = { id: string; name: string; grade_level_id: string | null; room: string | null; academic_year_id: string }

export default function ClassesPage() {
  let supabase: ReturnType<typeof createClient> | null = null
  const getSupabase = () => {
    if (!supabase) supabase = createClient()
    return supabase
  }
  const [years, setYears] = useState<Year[]>([])
  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [yearId, setYearId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [yearOpen, setYearOpen] = useState(false)
  const [classOpen, setClassOpen] = useState(false)

  async function load() {
    setLoading(true); setError('')
    const [y, g, c] = await Promise.all([
      getSupabase().from('academic_years').select('id,name,start_date,end_date,is_current').order('start_date', { ascending: false }),
      getSupabase().rpc('get_grade_levels'),
      getSupabase().from('classes').select('id,name,grade_level_id,room,academic_year_id').order('name')
    ])
    const firstError = y.error || g.error || c.error
    if (firstError) setError(firstError.message)
    setYears((y.data || []) as Year[])
    setGrades((g.data || []) as GradeLevel[])
    const normalizedClasses: SchoolClass[] = (c.data || []).map((item) => ({
      id: item.id,
      name: item.name,
      grade_level_id: item.grade_level_id,
      room: item.room,
      academic_year_id: item.academic_year_id,
    }))
    setClasses(normalizedClasses)
    const current = (y.data || []).find((item: Year) => item.is_current)
    if (current) setYearId(current.id)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function createYear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError('')
    const f = new FormData(e.currentTarget)
    const { error } = await getSupabase().rpc('create_academic_year', { p_name: String(f.get('name') || ''), p_start_date: String(f.get('start_date') || ''), p_end_date: String(f.get('end_date') || ''), p_is_current: f.get('is_current') === 'on' })
    if (error) setError(error.message); else { setYearOpen(false); e.currentTarget.reset(); await load() }
    setSaving(false)
  }

  async function createClass(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError('')
    const f = new FormData(e.currentTarget)
    const { error } = await getSupabase().rpc('create_class', { p_academic_year_id: String(f.get('academic_year_id') || ''), p_name: String(f.get('name') || ''), p_grade_level: String(f.get('grade_level') || ''), p_room: String(f.get('room') || '') })
    if (error) setError(error.message); else { setClassOpen(false); e.currentTarget.reset(); await load() }
    setSaving(false)
  }

  const visible = yearId ? classes.filter(c => c.academic_year_id === yearId) : classes
  const grouped = [
    ['preschool', 'PRÉSCOLAIRE'], ['fundamental_1', '1er cycle — 1ère à 4ème AF'], ['fundamental_2', '2ème cycle — 5ème à 6ème AF'], ['fundamental_3', '3ème cycle — 7ème à 9ème AF'], ['secondary', 'Nouveau Secondaire — NS1 à NS4']
  ]

  return <main className="min-h-screen bg-slate-50 p-6 md:p-10"><div className="mx-auto max-w-7xl">
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-sm font-semibold text-blue-600">AtechOS</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Classes & Academic Years</h1><p className="mt-1 text-slate-500">Manage official grade levels, cycles, classes and school years.</p></div><div className="flex gap-2"><button onClick={() => setYearOpen(true)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">+ Academic year</button><button onClick={() => setClassOpen(true)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">+ Class</button></div></header>
    {error && <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="font-semibold text-slate-900">Academic years</h2><p className="text-sm text-slate-500">{grades.length} configured grade levels</p></div><select value={yearId} onChange={e => setYearId(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">All years</option>{years.map(y => <option key={y.id} value={y.id}>{y.name}{y.is_current ? ' · Current' : ''}</option>)}</select></div><div className="mt-4 grid gap-3 md:grid-cols-3">{years.map(y => <div key={y.id} className="rounded-xl border border-slate-200 p-4"><p className="font-semibold">{y.name} {y.is_current && <span className="text-xs text-blue-600">CURRENT</span>}</p><p className="mt-1 text-sm text-slate-500">{y.start_date} → {y.end_date}</p></div>)}</div></section>
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-xl font-bold text-slate-900">Grade structure</h2><p className="mt-1 text-sm text-slate-500">Préscolaire → Fondamental (3 cycles) → Nouveau Secondaire.</p><div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{grouped.map(([code, label]) => <div key={code} className="rounded-xl border border-slate-200 p-4"><p className="font-semibold text-slate-900">{label}</p><div className="mt-3 flex flex-wrap gap-2">{grades.filter(g => g.cycle_code === code).map(g => <span key={g.id} title={g.name} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium">{g.short_name}</span>)}</div></div>)}</div></section>
    <section className="mt-6"><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-bold text-slate-900">Classes</h2><span className="text-sm text-slate-500">{visible.length} class{visible.length === 1 ? '' : 'es'}</span></div>{loading ? <p className="text-slate-500">Loading...</p> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map(c => <article key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><h3 className="text-lg font-semibold">{c.name}</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{c.room || 'No room'}</span></div><p className="mt-2 text-sm text-slate-500">{grades.find(g => g.id === c.grade_level_id)?.name || 'Grade level not set'}</p><p className="mt-1 text-xs font-semibold text-blue-600">{grades.find(g => g.id === c.grade_level_id)?.short_name || ''}</p><p className="mt-3 text-xs font-medium text-slate-500">{years.find(y => y.id === c.academic_year_id)?.name || 'Academic year'}</p></article>)}</div>}</section>
    {yearOpen && <Modal title="Create academic year" onClose={() => setYearOpen(false)}><form onSubmit={createYear} className="space-y-4"><Input name="name" label="Name" placeholder="2026-2027" required/><div className="grid grid-cols-2 gap-3"><Input name="start_date" label="Start date" type="date" required/><Input name="end_date" label="End date" type="date" required/></div><label className="flex gap-2 text-sm"><input name="is_current" type="checkbox"/> Set as current academic year</label><button disabled={saving} className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white">{saving ? 'Saving...' : 'Create year'}</button></form></Modal>}
    {classOpen && <Modal title="Create class" onClose={() => setClassOpen(false)}><form onSubmit={createClass} className="space-y-4"><label className="block text-sm font-medium">Academic year<select name="academic_year_id" required value={yearId} onChange={e => setYearId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3">{years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}</select></label><label className="block text-sm font-medium">Grade level<select name="grade_level" required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"><option value="">Select grade level...</option>{grouped.map(([code, label]) => <optgroup key={code} label={label}>{grades.filter(g => g.cycle_code === code).map(g => <option key={g.code} value={g.code}>{g.short_name} — {g.name}</option>)}</optgroup>)}</select></label><Input name="name" label="Class name" placeholder="6ème AF - A" required/><Input name="room" label="Room" placeholder="Room 12"/><button disabled={saving} className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white">{saving ? 'Saving...' : 'Create class'}</button></form></Modal>}
  </div></main>
}

function Input({ name, label, placeholder = '', type = 'text', required = false }: { name: string; label: string; placeholder?: string; type?: string; required?: boolean }) { return <label className="block text-sm font-medium">{label}<input name={name} type={type} placeholder={placeholder} required={required} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-blue-500"/></label> }
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"><div className="flex justify-between"><h2 className="text-xl font-bold">{title}</h2><button onClick={onClose} className="text-slate-500">✕</button></div><div className="mt-5">{children}</div></div></div> }
