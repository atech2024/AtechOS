'use client'

import { FormEvent, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

type Subject = { id: string; name: string; code: string | null }
type Teacher = { id: string; full_name: string }
type ClassItem = { id: string; name: string }
type Assignment = { id: string; class_id: string; subject_id: string; teacher_id: string | null }

export default function SubjectsPage() {
  let supabase: ReturnType<typeof createClient> | null = null
  const getSupabase = () => {
    if (!supabase) supabase = createClient()
    return supabase
  }
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [subjectOpen, setSubjectOpen] = useState(false)
  const [assignmentOpen, setAssignmentOpen] = useState(false)

  async function load() {
    setLoading(true); setError('')
    const [s, c, t, a] = await Promise.all([
      getSupabase().from('subjects').select('id,name,code').order('name'),
      getSupabase().from('classes').select('id,name').order('name'),
      getSupabase().from('school_members').select('user_id').eq('role', 'teacher'),
      getSupabase().from('class_subjects').select('id,class_id,subject_id,teacher_id').order('id')
    ])
    const firstError = s.error || c.error || t.error || a.error
    if (firstError) setError(firstError.message)
    setSubjects((s.data || []) as Subject[])
    setClasses((c.data || []) as ClassItem[])
    const teacherIds = ((t.data || []) as Array<{user_id:string}>).map(x => x.user_id)
    if (teacherIds.length) {
      const { data: teacherUsers, error: teacherError } = await getSupabase().from('users').select('id,full_name').in('id', teacherIds)
      if (teacherError) setError(teacherError.message)
      setTeachers(((teacherUsers || []) as Array<{id:string;full_name:string}>).map(x => ({ id: x.id, full_name: x.full_name || 'Teacher' })))
    } else {
      setTeachers([])
    }
    setAssignments((a.data || []) as Assignment[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function createSubject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError('')
    const f = new FormData(e.currentTarget)
    const { error } = await getSupabase().rpc('create_subject', { p_name: String(f.get('name') || ''), p_code: String(f.get('code') || '') })
    if (error) setError(error.message); else { setSubjectOpen(false); e.currentTarget.reset(); await load() }
    setSaving(false)
  }

  async function assign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError('')
    const f = new FormData(e.currentTarget)
    const { error } = await getSupabase().rpc('assign_subject_to_class', { p_class_id: String(f.get('class_id')), p_subject_id: String(f.get('subject_id')), p_teacher_id: String(f.get('teacher_id') || '') || null })
    if (error) setError(error.message); else { setAssignmentOpen(false); e.currentTarget.reset(); await load() }
    setSaving(false)
  }

  async function changeTeacher(id: string, teacherId: string) {
    setError('')
    const { error } = await getSupabase().rpc('update_class_subject_teacher', { p_class_subject_id: id, p_teacher_id: teacherId || null })
    if (error) setError(error.message); else await load()
  }

  return <main className="min-h-screen bg-slate-50 p-6 md:p-10"><div className="mx-auto max-w-7xl">
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><p className="text-sm font-semibold text-blue-600">AtechOS</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Subjects & Teachers</h1><p className="mt-1 text-slate-500">Create subjects and assign them to classes and teachers.</p></div>
      <div className="flex gap-2"><button onClick={() => setSubjectOpen(true)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">+ Subject</button><button onClick={() => setAssignmentOpen(true)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">+ Assign subject</button></div>
    </header>
    {error && <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{subjects.map(s => <article key={s.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">{s.name}</h2><p className="mt-2 text-xs text-slate-500">{s.code || 'No code'}</p></article>)}{!loading && subjects.length === 0 && <p className="text-slate-500">No subjects yet.</p>}</section>
    <section className="mt-8"><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-bold text-slate-900">Class subject assignments</h2><span className="text-sm text-slate-500">{assignments.length} assignment{assignments.length === 1 ? '' : 's'}</span></div>{loading ? <p className="text-slate-500">Loading...</p> : <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50"><tr><th className="px-4 py-3">Class</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Teacher</th></tr></thead><tbody>{assignments.map(a => <tr key={a.id} className="border-b border-slate-100 last:border-0"><td className="px-4 py-3 font-medium">{classes.find(c => c.id === a.class_id)?.name || 'Class'}</td><td className="px-4 py-3">{subjects.find(s => s.id === a.subject_id)?.name || 'Subject'}{subjects.find(s => s.id === a.subject_id)?.code ? <span className="ml-2 text-xs text-slate-400">{subjects.find(s => s.id === a.subject_id)?.code}</span> : null}</td><td className="px-4 py-3"><select value={a.teacher_id || ''} onChange={e => changeTeacher(a.id, e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2"><option value="">Unassigned</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select></td></tr>)}</tbody></table>{assignments.length === 0 && <p className="p-6 text-slate-500">No class subjects assigned yet.</p>}</div>}</section>
    {subjectOpen && <Modal title="Create subject" onClose={() => setSubjectOpen(false)}><form onSubmit={createSubject} className="space-y-4"><Input name="name" label="Subject name" placeholder="Mathematics" required/><Input name="code" label="Code" placeholder="MATH"/><button disabled={saving} className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white">{saving ? 'Saving...' : 'Create subject'}</button></form></Modal>}
    {assignmentOpen && <Modal title="Assign subject" onClose={() => setAssignmentOpen(false)}><form onSubmit={assign} className="space-y-4"><Select name="class_id" label="Class" options={classes.map(c => ({value:c.id,label:c.name}))}/><Select name="subject_id" label="Subject" options={subjects.map(s => ({value:s.id,label:s.code ? `${s.name} · ${s.code}` : s.name}))}/><Select name="teacher_id" label="Teacher (optional)" options={teachers.map(t => ({value:t.id,label:t.full_name}))} optional/><button disabled={saving} className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white">{saving ? 'Saving...' : 'Assign subject'}</button></form></Modal>}
  </div></main>
}

function Input({name,label,placeholder,required=false}:{name:string;label:string;placeholder:string;required?:boolean}) { return <label className="block text-sm font-medium">{label}<input name={name} placeholder={placeholder} required={required} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-blue-500"/></label> }
function Select({name,label,options,optional=false}:{name:string;label:string;options:Array<{value:string;label:string}>;optional?:boolean}) { return <label className="block text-sm font-medium">{label}<select name={name} required={!optional} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"><option value="">{optional ? 'Unassigned' : 'Select...'}</option>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label> }
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"><div className="flex justify-between"><h2 className="text-xl font-bold">{title}</h2><button onClick={onClose} className="text-slate-500">✕</button></div><div className="mt-5">{children}</div></div></div> }
