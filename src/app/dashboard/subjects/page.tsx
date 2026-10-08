'use client'
import { T } from '@/components/translation-provider'
import { subjectPresets } from '@/lib/school-catalog'
import Link from 'next/link'

import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAcademicYear } from '@/components/academic-year-context'

type Subject = { id: string; name: string; code: string | null; default_max_score: number | null }
type Teacher = { id: string; full_name: string }
type ClassItem = { id: string; name: string; academic_year_id: string; enabled: boolean }
type Assignment = { id: string; class_id: string; subject_id: string; teacher_id: string | null }

export default function SubjectsPage() {
  const academicYear = useAcademicYear()
  const supabase = useMemo(() => createClient(), [])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [canManage, setCanManage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [preset, setPreset] = useState('FR')
  const [subjectOpen, setSubjectOpen] = useState(false)
  const [assignmentOpen, setAssignmentOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const [context, s, c, t, a] = await Promise.all([
      supabase.rpc('school_context'),
      supabase.from('subjects').select('id,name,code,default_max_score').order('name'),
      supabase.from('classes').select('id,name,academic_year_id,enabled').order('name'),
      supabase.from('school_members').select('user_id').eq('role', 'teacher').eq('enabled', true),
      supabase.from('class_subjects').select('id,class_id,subject_id,teacher_id').order('id')
    ])
    const firstError = context.error || s.error || c.error || t.error || a.error
    if (firstError) setError(firstError.message)
    setCanManage(Boolean(context.data?.owner || context.data?.roles?.some((role: string) => ['school_admin', 'director'].includes(role))))
    setSubjects((s.data || []) as Subject[])
    setClasses((c.data || []) as ClassItem[])
    const teacherIds = ((t.data || []) as Array<{user_id:string}>).map(x => x.user_id)
    if (teacherIds.length) {
      const { data: teacherUsers, error: teacherError } = await supabase.from('users').select('id,full_name').in('id', teacherIds)
      if (teacherError) setError(teacherError.message)
      setTeachers(((teacherUsers || []) as Array<{id:string;full_name:string}>).map(x => ({ id: x.id, full_name: x.full_name || 'Teacher' })))
    } else {
      setTeachers([])
    }
    setAssignments((a.data || []) as Assignment[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const yearClasses = classes.filter(c => c.academic_year_id === academicYear.yearId)
  const assignableClasses = yearClasses.filter(c => c.enabled)
  const yearClassIds = new Set(yearClasses.map(c => c.id))
  const visibleAssignments = assignments.filter(a => yearClassIds.has(a.class_id))

  async function createSubject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError('')
    const formElement = e.currentTarget; const f = new FormData(formElement)
    const { error } = await supabase.rpc('create_subject_with_max_score', { p_name: preset === 'custom' ? String(f.get('name') || '') : subjectPresets.find(s => s[0] === preset)![1], p_code: preset === 'custom' ? String(f.get('code') || '') : preset, p_max_score: Number(f.get('max_score')) })
    if (error) setError(error.message); else { setSubjectOpen(false); formElement.reset(); await load() }
    setSaving(false)
  }

  async function saveSubjectMaxScore(e: FormEvent<HTMLFormElement>, subjectId: string) {
    e.preventDefault(); setSaving(true); setError('')
    const formElement = e.currentTarget; const f = new FormData(formElement)
    const { error } = await supabase.rpc('set_subject_default_max_score', { p_subject: subjectId, p_max_score: Number(f.get('max_score')) })
    if (error) setError(error.message); else await load()
    setSaving(false)
  }

  async function assign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setSaving(true); setError('')
    const formElement = e.currentTarget; const f = new FormData(formElement)
    const { error } = await supabase.rpc('assign_subject_to_class', { p_class_id: String(f.get('class_id')), p_subject_id: String(f.get('subject_id')), p_teacher_id: String(f.get('teacher_id') || '') || null })
    if (error) setError(error.message); else { setAssignmentOpen(false); formElement.reset(); await load() }
    setSaving(false)
  }

  async function changeTeacher(id: string, teacherId: string) {
    setError('')
    const { error } = await supabase.rpc('update_class_subject_teacher', { p_class_subject_id: id, p_teacher_id: teacherId || null })
    if (error) setError(error.message); else await load()
  }

  return <main className="min-h-screen bg-slate-50 p-6 md:p-10"><div className="mx-auto max-w-7xl">
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><Link href="/onboarding" className="text-sm font-semibold text-blue-600">AtechOS</Link><h1 className="mt-1 text-3xl font-bold text-slate-900"><T text="Subjects & Teachers"/></h1><p className="mt-1 text-slate-500">Create subjects and assign them to classes and teachers.</p></div>
      {canManage && <div className="flex gap-2"><button onClick={() => setSubjectOpen(true)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold"><T text="+ Subject"/></button><button onClick={() => setAssignmentOpen(true)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"><T text="+ Assign subject"/></button></div>}
    </header>
    {error && <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {!canManage && !loading && <p role="status" className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><T text="You can view assigned subjects and teachers here. Only a school administrator or director can change assignments."/></p>}
    <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{subjects.map(s => <article key={s.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">{s.name}</h2><p className="mt-2 text-xs text-slate-500">{s.code || 'No code'}</p>{canManage ? <form onSubmit={e => saveSubjectMaxScore(e, s.id)} className="mt-4 flex items-end gap-2"><label className="flex-1 text-sm"><T text="Max score"/><input name="max_score" type="number" min="0.01" step="0.01" defaultValue={s.default_max_score ?? ''} required className="mt-1 w-full rounded-lg border px-3 py-2"/></label><button disabled={saving} className="rounded-lg border px-3 py-2 text-sm"><T text="Save"/></button></form> : <p className="mt-3 text-sm text-slate-600"><T text="Max score"/>: {s.default_max_score ?? <T text="Not configured"/>}</p>}</article>)}{!loading && subjects.length === 0 && <p className="text-slate-500">No subjects yet.</p>}</section>
    <section className="mt-8"><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-bold text-slate-900"><T text="Class subject assignments"/></h2><span className="text-sm text-slate-500">{visibleAssignments.length} assignment{visibleAssignments.length === 1 ? '' : 's'}</span></div>{loading ? <p className="text-slate-500"><T text="Loading..."/></p> : !visibleAssignments.length ? <p role="status" className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600"><T text="No class subject assignments for this academic year."/></p> : <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50"><tr><th className="px-4 py-3"><T text="Class"/></th><th className="px-4 py-3"><T text="Subject"/></th><th className="px-4 py-3"><T text="Teacher"/></th></tr></thead><tbody>{visibleAssignments.map(a => <tr key={a.id} className="border-b border-slate-100 last:border-0"><td className="px-4 py-3 font-medium">{classes.find(c => c.id === a.class_id)?.name || 'Class'}</td><td className="px-4 py-3">{subjects.find(s => s.id === a.subject_id)?.name || 'Subject'}{subjects.find(s => s.id === a.subject_id)?.code ? <span className="ml-2 text-xs text-slate-400">{subjects.find(s => s.id === a.subject_id)?.code}</span> : null}</td><td className="px-4 py-3">{canManage ? <select value={a.teacher_id || ''} onChange={e => changeTeacher(a.id, e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2"><option value=""><T text="Unassigned"/></option>{teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select> : teachers.find(t => t.id === a.teacher_id)?.full_name || <T text="Unassigned"/>}</td></tr>)}</tbody></table></div>}</section>
    {subjectOpen && <Modal title="Create subject" onClose={() => setSubjectOpen(false)}><form onSubmit={createSubject} className="space-y-4"><label className="block"><T text="Subject"/><select value={preset} onChange={e=>setPreset(e.target.value)} className="mt-2 w-full rounded border p-3">{subjectPresets.map(([code,name])=><option key={code} value={code}>{name}</option>)}<option value="custom"><T text="Other — add a subject"/></option></select></label>{preset === 'custom' && <><Input name="name" label="Subject name" placeholder="Subject" required/><Input name="code" label="Code" placeholder="Code"/></>}<label className="block"><T text="Max score"/><input name="max_score" type="number" min="0.01" step="0.01" defaultValue="10" required className="mt-2 w-full rounded border p-3"/></label><button disabled={saving} className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white">{saving ? 'Saving...' : 'Create subject'}</button></form></Modal>}
    {assignmentOpen && <Modal title="Assign subject" onClose={() => setAssignmentOpen(false)}><form onSubmit={assign} className="space-y-4"><Select name="class_id" label="Class" options={assignableClasses.map(c => ({value:c.id,label:c.name}))}/>{!assignableClasses.length && <p role="status" className="rounded bg-amber-50 p-3 text-sm"><T text="No enabled classes are configured for this academic year."/></p>}<Select name="subject_id" label="Subject" options={subjects.map(s => ({value:s.id,label:s.code ? `${s.name} · ${s.code}` : s.name}))}/><Select name="teacher_id" label="Teacher (optional)" options={teachers.map(t => ({value:t.id,label:t.full_name}))} optional/><button disabled={saving || !assignableClasses.length} className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Assign subject'}</button></form></Modal>}
  </div></main>
}

function Input({name,label,placeholder,required=false}:{name:string;label:string;placeholder:string;required?:boolean}) { return <label className="block text-sm font-medium"><T text={label}/><input name={name} placeholder={placeholder} required={required} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-blue-500"/></label> }
function Select({name,label,options,optional=false}:{name:string;label:string;options:Array<{value:string;label:string}>;optional?:boolean}) { return <label className="block text-sm font-medium"><T text={label}/><select name={name} required={!optional} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"><option value="">{optional ? 'Unassigned' : 'Select...'}</option>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label> }
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"><div className="flex justify-between"><h2 className="text-xl font-bold">{title}</h2><button onClick={onClose} className="text-slate-500">✕</button></div><div className="mt-5">{children}</div></div></div> }

