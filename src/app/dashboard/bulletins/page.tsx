'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ClassItem = { id: string; name: string; grade_levels?: { short_name: string }[] | null; academic_years?: { name: string }[] | null }
type Student = { id: string; first_name: string; last_name: string; student_code: string | null }
type Subject = { id: string; name: string; code: string | null }
type Period = { id: string; name: string; code: string; weight: number; start_date: string; end_date: string; is_active: boolean }
type Grade = { student_id: string; subject_id: string; grading_period_id: string | null; score: number; max_score: number; assessment_weight: number | null }
type School = { name: string; code: string; email: string | null; phone: string | null; address: string | null; logo_url: string | null }
type GradingSettings = { controls_per_period: number; passing_average: number }

export default function BulletinsPage() {
  const supabase = createClient()
  const [school, setSchool] = useState<School | null>(null)
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [settings, setSettings] = useState<GradingSettings>({ controls_per_period: 4, passing_average: 5 })
  const [classId, setClassId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const schoolId = (await supabase.rpc('get_my_school_id')).data
      const [schoolResult, classResult, periodResult, settingsResult] = await Promise.all([
        schoolId ? supabase.from('schools').select('name,code,email,phone,address,logo_url').eq('id', schoolId).single() : Promise.resolve({ data: null, error: null }),
        supabase.from('classes').select('id,name,grade_levels(short_name),academic_years(name)').order('name'),
        supabase.rpc('get_grading_periods'),
        supabase.rpc('get_grading_settings')
      ])
      if (schoolResult.error || classResult.error || periodResult.error || settingsResult.error) setError((schoolResult.error || classResult.error || periodResult.error || settingsResult.error)?.message || 'Could not load bulletin data.')
      setSchool(schoolResult.data as School | null)
      setClasses((classResult.data || []) as ClassItem[])
      setPeriods(((periodResult.data || []) as Period[]).filter(p => p.is_active))
      const settingRow = (Array.isArray(settingsResult.data) ? settingsResult.data[0] : settingsResult.data) as GradingSettings | undefined
      if (settingRow) setSettings({ controls_per_period: Number(settingRow.controls_per_period) || 4, passing_average: Number(settingRow.passing_average) || 5 })
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    async function loadClass() {
      if (!classId) { setStudents([]); setSubjects([]); setGrades([]); return }
      const [enrollmentResult, subjectResult] = await Promise.all([
        supabase.from('enrollments').select('student_id,students(id,first_name,last_name,student_code)').eq('class_id', classId).eq('status', 'active').order('student_id'),
        supabase.from('class_subjects').select('subject_id,subjects(id,name,code)').eq('class_id', classId).order('subject_id')
      ])
      setStudents(((enrollmentResult.data || []) as Array<{students:Student|null}>).map(x => x.students).filter(Boolean) as Student[])
      setSubjects(((subjectResult.data || []) as Array<{subjects:Subject|null}>).map(x => x.subjects).filter(Boolean) as Subject[])
      setStudentId('')
      const { data, error } = await supabase.from('grades').select('student_id,subject_id,grading_period_id,score,max_score,assessment_weight').eq('class_id', classId)
      if (error) setError(error.message)
      setGrades((data || []) as Grade[])
    }
    loadClass()
  }, [classId])

  const student = students.find(s => s.id === studentId)
  const selectedClass = classes.find(c => c.id === classId)
  const gradeLevelName = selectedClass?.grade_levels?.[0]?.short_name || ''
  const academicYearName = selectedClass?.academic_years?.[0]?.name || ''

  const rows = useMemo(() => subjects.map(subject => {
    const periodRows = periods.map(period => {
      const gs = grades.filter(g => g.student_id === studentId && g.subject_id === subject.id && g.grading_period_id === period.id)
      const weightedMax = gs.reduce((sum, g) => sum + Number(g.max_score) * Number(g.assessment_weight || 100), 0)
      const weightedScore = gs.reduce((sum, g) => sum + Number(g.score) * Number(g.assessment_weight || 100), 0)
      return { period, average: weightedMax ? (weightedScore / weightedMax) * 10 : null }
    })
    const available = periodRows.filter(r => r.average !== null)
    const periodWeightTotal = available.reduce((sum, r) => sum + Number(r.period.weight || 100), 0)
    const finalAverage = periodWeightTotal ? available.reduce((sum, r) => sum + Number(r.average) * Number(r.period.weight || 100), 0) / periodWeightTotal : null
    return { subject, periodRows, finalAverage }
  }), [subjects, periods, grades, studentId])

  const overall = useMemo(() => {
    const values = rows.map(r => r.finalAverage).filter((v): v is number => v !== null)
    return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null
  }, [rows])

  return <main className="min-h-screen bg-slate-50 p-6 md:p-10 print:bg-white print:p-0"><div className="mx-auto max-w-6xl">
    <header className="mb-8 print:hidden"><p className="text-sm font-semibold text-blue-600">AtechOS</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Bulletins</h1><p className="mt-1 text-slate-500">Generate a student bulletin with grading-period averages, final averages and school passing threshold.</p></header>
    {error && <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">{error}</p>}
    <section className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 print:hidden">
      <label className="text-sm font-medium">Class<select value={classId} onChange={e => setClassId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"><option value="">Select class...</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.grade_levels?.[0]?.short_name ? ` · ${c.grade_levels[0].short_name}` : ''}{c.academic_years?.[0]?.name ? ` · ${c.academic_years[0].name}` : ''}</option>)}</select></label>
      <label className="text-sm font-medium">Student<select value={studentId} onChange={e => setStudentId(e.target.value)} disabled={!classId} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"><option value="">Select student...</option>{students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}{s.student_code ? ` · ${s.student_code}` : ''}</option>)}</select></label>
      <div className="md:col-span-2"><button type="button" onClick={() => window.print()} disabled={!studentId} className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white disabled:opacity-50">Print / Save PDF</button></div>
    </section>

    {student && <article className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <div className="flex items-start justify-between gap-6 border-b-2 border-slate-900 pb-5"><div>{school?.logo_url && <img src={school.logo_url} alt="School logo" className="mb-3 h-16 w-16 object-contain"/>}<h2 className="text-2xl font-bold text-slate-900">{school?.name || 'School'}</h2><p className="text-sm text-slate-500">{school?.code}{school?.address ? ` · ${school.address}` : ''}</p><p className="text-sm text-slate-500">{school?.phone || ''}{school?.email ? ` · ${school.email}` : ''}</p></div><div className="text-right"><h3 className="text-2xl font-bold text-slate-900">BULLETIN SCOLAIRE</h3><p className="mt-1 text-sm text-slate-500">{selectedClass?.name || ''}</p><p className="text-sm text-slate-500">{gradeLevelName}</p><p className="text-sm text-slate-500">{academicYearName}</p></div></div>
      <div className="mt-5 grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-4"><div><p className="text-xs uppercase tracking-wide text-slate-500">Élève</p><p className="font-semibold text-slate-900">{student.first_name} {student.last_name}</p></div><div><p className="text-xs uppercase tracking-wide text-slate-500">Code élève</p><p className="font-semibold text-slate-900">{student.student_code || '—'}</p></div><div><p className="text-xs uppercase tracking-wide text-slate-500">Périodes</p><p className="font-semibold text-slate-900">{periods.length}</p></div><div><p className="text-xs uppercase tracking-wide text-slate-500">Seuil de réussite</p><p className="font-semibold text-slate-900">{settings.passing_average.toFixed(2)} / 10</p></div></div>
      <div className="mt-6 overflow-x-auto"><table className="w-full border-collapse text-sm"><thead><tr className="border-y-2 border-slate-900"><th className="px-3 py-3 text-left">Matière</th>{periods.map(p => <th key={p.id} className="px-3 py-3 text-right">{p.name}<span className="block text-xs font-normal text-slate-500">/10</span></th>)}<th className="px-3 py-3 text-right">Moyenne finale<span className="block text-xs font-normal text-slate-500">/10</span></th><th className="px-3 py-3 text-center">Statut</th></tr></thead><tbody>{rows.map(r => {const passed = r.finalAverage !== null && r.finalAverage >= settings.passing_average;return <tr key={r.subject.id} className="border-b border-slate-200"><td className="px-3 py-3 font-medium">{r.subject.name}</td>{r.periodRows.map(pr => <td key={pr.period.id} className="px-3 py-3 text-right">{pr.average === null ? '—' : pr.average.toFixed(2)}</td>)}<td className="px-3 py-3 text-right font-bold">{r.finalAverage === null ? '—' : r.finalAverage.toFixed(2)}</td><td className="px-3 py-3 text-center text-xs font-semibold">{r.finalAverage === null ? '—' : passed ? 'Réussi' : 'À améliorer'}</td></tr>})}</tbody></table></div>
      <div className="mt-6 grid gap-4 md:grid-cols-3"><div className="rounded-xl border-2 border-slate-900 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Moyenne générale</p><p className="mt-1 text-3xl font-bold text-slate-900">{overall === null ? '—' : `${overall.toFixed(2)} / 10`}</p></div><div className="rounded-xl border border-slate-200 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Seuil de réussite</p><p className="mt-1 text-xl font-bold text-slate-900">{settings.passing_average.toFixed(2)} / 10</p></div><div className="rounded-xl border border-slate-200 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Statut général</p><p className="mt-1 text-xl font-bold text-slate-900">{overall === null ? '—' : overall >= settings.passing_average ? 'Réussi' : 'À améliorer'}</p></div></div>
      <div className="mt-12 grid grid-cols-2 gap-12 text-center text-sm"><div className="border-t border-slate-400 pt-2">Parent / Tuteur</div><div className="border-t border-slate-400 pt-2">Direction de l’école</div></div>
      <p className="mt-8 text-center text-xs text-slate-400">Document généré par AtechOS · Les moyennes sont calculées selon les périodes et pondérations configurées par l’école.</p>
    </article>}
    {!loading && !student && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 print:hidden">Select a class and student to generate the bulletin.</div>}
  </div></main>
}
