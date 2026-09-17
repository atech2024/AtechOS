'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Parent = { id: string; relationship: string | null; user_id: string | null }
type Student = { id: string; first_name: string; last_name: string; student_code: string | null }
type LinkRow = { student_id: string; parent_id: string; is_primary: boolean }

export default function ParentsPage() {
  const supabase = createClient()
  const [parents, setParents] = useState<Parent[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [links, setLinks] = useState<LinkRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true); setError('')
    const [p, s, l] = await Promise.all([
      supabase.from('parents').select('id,relationship,user_id').order('relationship'),
      supabase.from('students').select('id,first_name,last_name,student_code').eq('active', true).order('last_name').order('first_name'),
      supabase.from('student_parents').select('student_id,parent_id,is_primary'),
    ])
    if (p.error || s.error || l.error) setError((p.error || s.error || l.error)?.message || 'Could not load parent data.')
    setParents((p.data || []) as Parent[]); setStudents((s.data || []) as Student[]); setLinks((l.data || []) as LinkRow[]); setLoading(false)
  }
  useEffect(() => { load() }, [])

  return <main className="min-h-screen bg-slate-50 p-6 md:p-10"><div className="mx-auto max-w-7xl">
    <a href="/dashboard" className="text-sm font-semibold text-blue-600">← Dashboard</a>
    <h1 className="mt-2 text-3xl font-bold text-slate-900">Parents</h1>
    <p className="mt-1 text-slate-500">Review parent accounts and their linked students. Account creation and relationship writes will use the secured parent workflow.</p>
    {error && <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {loading ? <p className="mt-8 text-slate-500">Loading parents...</p> : <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5"><h2 className="font-semibold">Family relationships</h2><p className="mt-1 text-sm text-slate-500">{parents.length} parent account(s) · {students.length} active student(s)</p></div>
      <div className="divide-y divide-slate-100">{students.map(student => { const rows = links.filter(x => x.student_id === student.id); const names = rows.map(x => { const p = parents.find(y => y.id === x.parent_id); return p ? `${p.relationship || 'Parent'}${x.is_primary ? ' · Primary' : ''}` : 'Parent'; }); return <div key={student.id} className="flex flex-col gap-2 p-5 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold text-slate-900">{student.first_name} {student.last_name}</p><p className="text-xs text-slate-500">{student.student_code || 'No student code'}</p></div><p className="text-sm text-slate-600">{names.length ? names.join(', ') : 'No parent linked yet'}</p></div> })}</div>
      {!students.length && <p className="p-6 text-slate-500">No active students found.</p>}
    </section>}
  </div></main>
}
