'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Student = { id: string; first_name: string; last_name: string; photo_url: string | null; active: boolean }
type Badge = { student_id: string; badge_uid: string; badge_type: string; active: boolean }
type Enrollment = { student_id: string; class_id: string; class_name: string; academic_year_name: string | null }
type School = { name: string; logo_url: string | null }

export default function BadgesPage() {
  let supabase: ReturnType<typeof createClient> | null = null
  const getSupabase = () => {
    if (!supabase) supabase = createClient()
    return supabase
  }
  const [students, setStudents] = useState<Student[]>([]); const [badges, setBadges] = useState<Badge[]>([]); const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [school, setSchool] = useState<School | null>(null); const [selectedId, setSelectedId] = useState(''); const [photoSrc, setPhotoSrc] = useState(''); const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true); const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true); setError('')
      const { data: schoolId, error: idError } = await getSupabase().rpc('get_my_school_id')
      if (idError || !schoolId) { setError(idError?.message || 'No school found'); setLoading(false); return }
      const [sr, br, er, sch] = await Promise.all([
        getSupabase().from('students').select('id,first_name,last_name,photo_url,active').eq('active', true).order('last_name').order('first_name'),
        getSupabase().from('student_badges').select('student_id,badge_uid,badge_type,active').eq('active', true),
        getSupabase().from('enrollments').select('student_id,class_id').eq('school_id', schoolId).eq('status', 'active'),
        getSupabase().from('schools').select('name,logo_url').eq('id', schoolId).single(),
      ])
      const enrollmentRows = (er.data || []) as Array<{student_id:string;class_id:string}>
      const classIds = enrollmentRows.map(x => x.class_id)
      const [classResult] = await Promise.all([classIds.length ? getSupabase().from('classes').select('id,name,academic_year_id').in('id', classIds) : Promise.resolve({data:[],error:null})])
      const academicYearIds = ((classResult.data || []) as Array<{id:string;name:string;academic_year_id:string|null}>).map(x => x.academic_year_id).filter((x):x is string => Boolean(x))
      const yearResult = academicYearIds.length ? await getSupabase().from('academic_years').select('id,name').in('id', academicYearIds) : {data:[],error:null}
      const classMap = new Map(((classResult.data || []) as Array<{id:string;name:string;academic_year_id:string|null}>).map(x => [x.id, x]))
      const yearMap = new Map(((yearResult.data || []) as Array<{id:string;name:string}>).map(x => [x.id, x.name]))
      const normalizedEnrollments: Enrollment[] = enrollmentRows.map(x => ({student_id:x.student_id,class_id:x.class_id,class_name:classMap.get(x.class_id)?.name || 'Class',academic_year_name:classMap.get(x.class_id)?.academic_year_id ? (yearMap.get(classMap.get(x.class_id)!.academic_year_id!) || null) : null}))
      const firstError = sr.error || br.error || er.error || sch.error || classResult.error || yearResult.error
      if (firstError) setError(firstError.message)
      setStudents((sr.data || []) as Student[]); setBadges((br.data || []) as Badge[]); setEnrollments(normalizedEnrollments); setSchool((sch.data || null) as School | null)
      const firstStudent = (sr.data || [])[0] as Student | undefined
      if (firstStudent) setSelectedId(firstStudent.id)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => { const q = query.trim().toLowerCase(); return !q ? students : students.filter(s => `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)) }, [students, query])
  const selected = students.find(s => s.id === selectedId) || null
  const badge = badges.find(b => b.student_id === selectedId) || null
  const enrollment = enrollments.find(e => e.student_id === selectedId) || null

  useEffect(() => {
    let cancelled = false
    async function resolvePhoto() {
      setPhotoSrc('')
      const path = selected?.photo_url?.trim()
      if (!path) return
      if (/^https?:\/\//i.test(path)) { setPhotoSrc(path); return }
      const { data, error } = await getSupabase().storage.from('student-photos').createSignedUrl(path, 60 * 60)
      if (!cancelled && !error && data?.signedUrl) setPhotoSrc(data.signedUrl)
    }
    resolvePhoto()
    return () => { cancelled = true }
  }, [selected?.photo_url])

  function printBadge() { window.print() }

  return <main className="min-h-screen bg-slate-50 p-6 md:p-10">
    <div className="mx-auto max-w-6xl print:hidden">
      <a href="/dashboard" className="text-sm font-semibold text-blue-600">← Dashboard</a>
      <header className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="text-sm font-semibold text-blue-600">AtechOS</p><h1 className="text-3xl font-bold text-slate-900">Student Badges</h1><p className="mt-1 text-slate-500">Prepare and print school identification badges. The AtechOS ID and NISU are never printed.</p></div><button onClick={printBadge} disabled={!selected || !badge} className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-40">Print badge</button></header>
      {error && <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <section className="mt-8 grid gap-6 md:grid-cols-[320px_1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search student..." className="w-full rounded-xl border border-slate-300 px-4 py-3"/><div className="mt-4 max-h-[520px] overflow-y-auto">{loading?<p className="py-8 text-center text-slate-500">Loading...</p>:filtered.map(s=><button key={s.id} onClick={()=>setSelectedId(s.id)} className={`mb-2 w-full rounded-xl border p-3 text-left ${selectedId===s.id?'border-blue-500 bg-blue-50':'border-slate-200 bg-white'}`}><p className="font-semibold text-slate-900">{s.first_name} {s.last_name}</p><p className="text-xs text-slate-500">{enrollments.find(e=>e.student_id===s.id)?.class_name || 'No active class'}</p></button>)}</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-semibold text-slate-900">Badge preview</h2><p className="mt-1 text-sm text-slate-500">Only school-facing identification data appears on the printed badge.</p><div className="mt-6 flex justify-center"><BadgeCard school={school} student={selected} badge={badge} enrollment={enrollment} photoSrc={photoSrc}/></div>{selected && !badge && <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">This student does not have an active badge assigned yet.</p>}{selected && !photoSrc && <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">No student photo is available. Upload one before printing the badge.</p>}</div>
      </section>
    </div>
    <div className="hidden print:block"><BadgeCard school={school} student={selected} badge={badge} enrollment={enrollment} photoSrc={photoSrc}/></div>
    <style jsx global>{`@media print { @page { size: 85.6mm 54mm; margin: 0; } body { margin: 0 !important; background: white !important; } .badge-card { width: 85.6mm !important; height: 54mm !important; } }`}</style>
  </main>
}

function BadgeCard({ school, student, badge, enrollment, photoSrc }: { school: School | null; student: Student | null; badge: Badge | null; enrollment: Enrollment | null; photoSrc: string }) {
  return <div className="badge-card relative h-[54mm] w-[85.6mm] overflow-hidden rounded-[4mm] border border-slate-300 bg-white shadow-lg print:rounded-none print:border-0 print:shadow-none">
    <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2"><div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded bg-slate-100">{school?.logo_url ? <img src={school.logo_url} alt="" className="h-full w-full object-contain"/> : <span className="text-[9px] font-black text-blue-700">A</span>}</div><div className="min-w-0"><p className="text-[10px] font-black tracking-wide text-blue-700">AtechOS</p><p className="truncate text-[8px] font-semibold text-slate-600">{school?.name || 'School'}</p></div></div>
    <div className="flex gap-3 px-4 py-3"><div className="h-[22mm] w-[18mm] shrink-0 overflow-hidden rounded border border-slate-200 bg-slate-100">{photoSrc ? <img src={photoSrc} alt="Student" className="h-full w-full object-cover"/> : <div className="flex h-full items-center justify-center text-[8px] text-slate-400">PHOTO</div>}</div><div className="min-w-0 flex-1"><p className="text-[13px] font-black uppercase leading-tight text-slate-900">{student ? `${student.first_name} ${student.last_name}` : 'Student name'}</p><p className="mt-1 text-[10px] font-bold text-blue-700">{enrollment?.class_name || 'Class'}</p><p className="mt-1 text-[8px] text-slate-500">Année scolaire</p><p className="text-[10px] font-semibold text-slate-800">{enrollment?.academic_year_name || '—'}</p></div></div>
    <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-slate-50 px-4 py-2"><p className="text-[7px] uppercase tracking-wide text-slate-500">Badge UID</p><p className="font-mono text-[9px] font-bold text-slate-900">{badge?.badge_uid || 'Not assigned'}</p></div>
  </div>
}
