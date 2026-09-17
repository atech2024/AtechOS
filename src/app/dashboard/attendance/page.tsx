'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Student = { id: string; first_name: string; last_name: string }
type ClassRow = { id: string; name: string }
type AttendanceRow = { student_id: string; status: string; late_minutes: number; check_in_at: string | null; check_out_at: string | null; notes: string | null }

const statuses = ['present', 'late', 'absent', 'early_departure']

export default function AttendancePage() {
  const supabase = createClient()
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [records, setRecords] = useState<Record<string, AttendanceRow>>({})
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function loadClasses() {
    const { data, error } = await supabase.from('classes').select('id,name').order('name')
    if (error) setError(error.message)
    const rows = (data || []) as ClassRow[]
    setClasses(rows)
    if (!classId && rows[0]) setClassId(rows[0].id)
  }

  async function loadRoster() {
    if (!classId) return
    setLoading(true); setError('')
    const { data: enrollments, error: ee } = await supabase.from('enrollments').select('student_id,students(id,first_name,last_name)').eq('class_id', classId).eq('status', 'active')
    const { data: attendance, error: ae } = await supabase.from('attendance').select('student_id,status,late_minutes,check_in_at,check_out_at,notes').eq('class_id', classId).eq('attendance_date', date)
    if (ee || ae) setError((ee || ae)?.message || 'Could not load attendance')
    const roster = (enrollments || []).map((e: any) => e.students).filter(Boolean) as Student[]
    const map: Record<string, AttendanceRow> = {}
    ;(attendance || []).forEach((r: AttendanceRow) => { map[r.student_id] = r })
    setStudents(roster); setRecords(map); setLoading(false)
  }

  useEffect(() => { loadClasses() }, [])
  useEffect(() => { loadRoster() }, [classId, date])

  async function save(student: Student, status: string) {
    setSaving(student.id); setError('')
    const current = records[student.id]
    const now = new Date().toISOString()
    const { error } = await supabase.rpc('record_attendance', {
      p_student_id: student.id, p_class_id: classId, p_attendance_date: date, p_status: status,
      p_check_in_at: status === 'present' || status === 'late' ? (current?.check_in_at || now) : current?.check_in_at || null,
      p_check_out_at: current?.check_out_at || null, p_late_minutes: status === 'late' ? (current?.late_minutes || 0) : 0,
      p_notes: current?.notes || null,
    })
    if (error) setError(error.message)
    else setRecords(prev => ({ ...prev, [student.id]: { ...current, student_id: student.id, status, late_minutes: status === 'late' ? (current?.late_minutes || 0) : 0, check_in_at: (status === 'present' || status === 'late') ? (current?.check_in_at || now) : current?.check_in_at || null, check_out_at: current?.check_out_at || null, notes: current?.notes || null } }))
    setSaving(null)
  }

  async function checkout(student: Student) {
    const r = records[student.id]
    if (!r) return
    setSaving(student.id); setError('')
    const now = new Date().toISOString()
    const { error } = await supabase.rpc('update_attendance_checkout', { p_attendance_id: (r as AttendanceRow & { id?: string }).id, p_check_out_at: now })
    if (error) setError(error.message)
    else setRecords(prev => ({ ...prev, [student.id]: { ...r, check_out_at: now } }))
    setSaving(null)
  }

  return <main className="min-h-screen bg-slate-50 p-6 md:p-10"><div className="mx-auto max-w-7xl">
    <header><p className="text-sm font-semibold text-blue-600">AtechOS</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Attendance</h1><p className="mt-1 text-slate-500">Record daily presence, lateness and checkout.</p></header>
    {error && <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Class<select value={classId} onChange={e => setClassId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3">{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="text-sm font-medium">Date<input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"/></label></div></section>
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="font-semibold">Daily roster</h2><p className="mt-1 text-sm text-slate-500">{students.length} student{students.length === 1 ? '' : 's'}</p></div>{loading ? <p className="p-5 text-slate-500">Loading...</p> : students.length === 0 ? <p className="p-5 text-slate-500">No active students are enrolled in this class yet.</p> : <div className="divide-y divide-slate-100">{students.map(student => { const r = records[student.id]; return <div key={student.id} className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold text-slate-900">{student.first_name} {student.last_name}</p><p className="text-xs text-slate-500">{r?.check_in_at ? `Check-in ${new Date(r.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No check-in'}{r?.check_out_at ? ` · Check-out ${new Date(r.check_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</p></div><div className="flex flex-wrap gap-2">{statuses.map(status => <button key={status} disabled={saving === student.id} onClick={() => save(student, status)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${r?.status === status ? 'bg-blue-600 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>{status.replace('_', ' ')}</button>)}{r && !r.check_out_at && <button disabled={saving === student.id} onClick={() => checkout(student)} className="rounded-lg border border-slate-900 px-3 py-2 text-xs font-semibold text-slate-900">Check out</button>}</div></div>})}</div>}</section>
  </div></main>
}
