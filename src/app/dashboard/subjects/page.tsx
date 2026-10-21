'use client'
import { T, useLocale } from '@/components/translation-provider'
import { translate } from '@/lib/translations'
import { BookPlus, ListPlus, X } from 'lucide-react'
import { subjectPresets } from '@/lib/school-catalog'

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

  return <main className="p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-7xl">
    <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><h1 className="text-3xl font-bold tracking-tight text-slate-950"><T text="Subjects & Teachers"/></h1><p className="mt-2 max-w-3xl text-slate-600"><T text="Create subjects and assign them to classes and teachers."/></p></div>
      {canManage && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setSubjectOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><BookPlus aria-hidden="true" size={18}/><T text="+ Subject"/></button><button type="button" onClick={() => setAssignmentOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"><ListPlus aria-hidden="true" size={18}/><T text="+ Assign subject"/></button></div>}
    </header>
    {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    {!canManage && !loading && <p role="status" className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><T text="You can view assigned subjects and teachers here. Only a school administrator or director can change assignments."/></p>}
    <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{subjects.map(s => <article key={s.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">{s.name}</h2><p className="mt-2 text-xs text-slate-500">{s.code || 'No code'}</p>{canManage ? <form onSubmit={e => saveSubjectMaxScore(e, s.id)} className="mt-4 flex items-end gap-2"><label className="flex-1 text-sm"><T text="Max score"/><input name="max_score" type="number" min="0.01" step="0.01" defaultValue={s.default_max_score ?? ''} required className="mt-1 w-full rounded-lg border px-3 py-2"/></label><button disabled={saving} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50"><T text="Save"/></button></form> : <p className="mt-3 text-sm text-slate-600"><T text="Max score"/>: {s.default_max_score ?? <T text="Not configured"/>}</p>}</article>)}{!loading && subjects.length === 0 && <p className="text-slate-500">No subjects yet.</p>}</section>
    <section className="mt-8"><div className="mb-3 flex flex-wrap items-end justify-between gap-2"><h2 className="text-xl font-semibold tracking-tight text-slate-950"><T text="Class subject assignments"/></h2><span className="text-sm tabular-nums text-slate-600">{visibleAssignments.length} <T text={visibleAssignments.length === 1 ? 'assignment' : 'assignments'}/></span></div>{loading ? <p className="text-slate-500"><T text="Loading..."/></p> : !visibleAssignments.length ? <p role="status" className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600"><T text="No class subject assignments for this academic year."/></p> : <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50"><tr><th className="px-4 py-3"><T text="Class"/></th><th className="px-4 py-3"><T text="Subject"/></th><th className="px-4 py-3"><T text="Teacher"/></th></tr></thead><tbody>{visibleAssignments.map(a => <tr key={a.id} className="border-b border-slate-100 last:border-0"><td className="px-4 py-3 font-medium">{classes.find(c => c.id === a.class_id)?.name || 'Class'}</td><td className="px-4 py-3">{subjects.find(s => s.id === a.subject_id)?.name || 'Subject'}{subjects.find(s => s.id === a.subject_id)?.code ? <span className="ml-2 text-xs text-slate-400">{subjects.find(s => s.id === a.subject_id)?.code}</span> : null}</td><td className="px-4 py-3">{canManage ? <select value={a.teacher_id || ''} onChange={e => changeTeacher(a.id, e.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-100"><option value=""><T text="Unassigned"/></option>{teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select> : teachers.find(t => t.id === a.teacher_id)?.full_name || <T text="Unassigned"/>}</td></tr>)}</tbody></table></div>}</section>
    {subjectOpen && <Modal title="Create subject" onClose={() => setSubjectOpen(false)}><form onSubmit={createSubject} className="space-y-4"><label className="block"><T text="Subject"/><select value={preset} onChange={e=>setPreset(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-100">{subjectPresets.map(([code,name])=><option key={code} value={code}>{name}</option>)}<option value="custom"><T text="Other — add a subject"/></option></select></label>{preset === 'custom' && <><Input name="name" label="Subject name" placeholder="Subject" required/><Input name="code" label="Code" placeholder="Code"/></>}<label className="block"><T text="Max score"/><input name="max_score" type="number" min="0.01" step="0.01" defaultValue="10" required className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-100"/></label><button disabled={saving} className="min-h-11 w-full rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <T text="Saving..."/> : <T text="Create subject"/>}</button></form></Modal>}
    {assignmentOpen && <Modal title="Assign subject" onClose={() => setAssignmentOpen(false)}><form onSubmit={assign} className="space-y-4"><Select name="class_id" label="Class" options={assignableClasses.map(c => ({value:c.id,label:c.name}))}/>{!assignableClasses.length && <p role="status" className="rounded bg-amber-50 p-3 text-sm"><T text="No enabled classes are configured for this academic year."/></p>}<Select name="subject_id" label="Subject" options={subjects.map(s => ({value:s.id,label:s.code ? `${s.name} · ${s.code}` : s.name}))}/><Select name="teacher_id" label="Teacher (optional)" options={teachers.map(t => ({value:t.id,label:t.full_name}))} optional/><button disabled={saving || !assignableClasses.length} className="min-h-11 w-full rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <T text="Saving..."/> : <T text="Assign subject"/>}</button></form></Modal>}
  </div></main>
}

function Input({name,label,placeholder,required=false}:{name:string;label:string;placeholder:string;required?:boolean}) { const locale=useLocale(); return <label className="block text-sm font-medium"><T text={label}/><input name={name} placeholder={translate(placeholder,locale)} required={required} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-blue-500"/></label> }
function Select({name,label,options,optional=false}:{name:string;label:string;options:Array<{value:string;label:string}>;optional?:boolean}) { return <label className="block text-sm font-medium"><T text={label}/><select name={name} required={!optional} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-100"><option value=""><T text={optional ? 'Unassigned' : 'Select...'}/></option>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label> }
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) { const locale=useLocale(); return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 sm:p-6"><div role="dialog" aria-modal="true" aria-labelledby="subject-dialog-title" onKeyDown={e=>{if(e.key==='Escape')onClose()}} className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6"><div className="flex items-center justify-between gap-4"><h2 id="subject-dialog-title" className="text-xl font-semibold tracking-tight text-slate-950"><T text={title}/></h2><button type="button" aria-label={translate('Close',locale)} onClick={onClose} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><X aria-hidden="true" size={18}/></button></div><div className="mt-5">{children}</div></div></div> }

