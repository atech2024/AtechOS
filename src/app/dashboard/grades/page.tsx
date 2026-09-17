'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ClassItem = { id: string; name: string; grade_levels?: { short_name: string } | null; academic_years?: { name: string } | null }
type Subject = { id: string; name: string; code: string | null }
type Student = { id: string; first_name: string; last_name: string; student_code: string | null }
type Grade = { id: string; student_id: string; subject_id: string; class_id: string; assessment_name: string; score: number; max_score: number; note: string | null; grading_period_id: string | null; graded_at?: string | null }
type Assignment = { subject_id: string; subjects?: Subject | null }
type GradingPeriod = { id: string; name: string; code: string; start_date: string; end_date: string; weight: number; is_active: boolean }

export default function GradesPage() {
  const supabase = createClient()
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [grades, setGrades] = useState<Grade[]>([])
  const [periods, setPeriods] = useState<GradingPeriod[]>([])
  const [classId, setClassId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [periodId, setPeriodId] = useState('')
  const [assessment, setAssessment] = useState('')
  const [maxScore, setMaxScore] = useState('100')
  const [scores, setScores] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadClasses() {
    const { data, error } = await supabase.from('classes').select('id,name,grade_levels(short_name),academic_years(name)').order('name')
    if (error) setError(error.message)
    setClasses((data || []) as ClassItem[])
  }

  async function loadPeriods() {
    const { data, error } = await supabase.rpc('get_grading_periods')
    if (error) setError(error.message)
    const active = ((data || []) as GradingPeriod[]).filter(p => p.is_active)
    setPeriods(active)
    setPeriodId(current => current || active[0]?.id || '')
  }

  async function loadClassData(id: string) {
    setLoading(true); setError(''); setMessage('')
    const [enrollmentResult, assignmentResult] = await Promise.all([
      supabase.from('enrollments').select('student_id,students(id,first_name,last_name,student_code)').eq('class_id', id).eq('status', 'active').order('student_id'),
      supabase.from('class_subjects').select('subject_id,subjects(id,name,code)').eq('class_id', id).order('subject_id')
    ])
    if (enrollmentResult.error || assignmentResult.error) setError((enrollmentResult.error || assignmentResult.error)?.message || 'Could not load class')
    const enrolled = ((enrollmentResult.data || []) as Array<{student_id:string;students:Student|null}>).map(x => x.students).filter(Boolean) as Student[]
    setStudents(enrolled)
    const assigned = (assignmentResult.data || []) as Assignment[]
    setSubjects(assigned.map(x => x.subjects).filter(Boolean) as Subject[])
    setSubjectId(current => assigned.some(x => x.subject_id === current) ? current : '')
    setGrades([]); setScores({}); setNotes({})
    setLoading(false)
  }

  async function loadGrades(id: string, sid: string, pid: string) {
    if (!id || !sid) { setGrades([]); return }
    let query = supabase.from('grades').select('id,student_id,subject_id,class_id,assessment_name,score,max_score,note,grading_period_id,graded_at').eq('class_id', id).eq('subject_id', sid).order('graded_at', { ascending: false })
    if (pid) query = query.eq('grading_period_id', pid)
    const { data, error } = await query
    if (error) setError(error.message)
    setGrades((data || []) as Grade[])
  }

  useEffect(() => { Promise.all([loadClasses(), loadPeriods()]).finally(() => setLoading(false)) }, [])
  useEffect(() => { if (classId) loadClassData(classId) }, [classId])
  useEffect(() => { loadGrades(classId, subjectId, periodId) }, [classId, subjectId, periodId])

  function existing(studentId: string) {
    return grades.find(g => g.student_id === studentId && g.assessment_name.toLowerCase() === assessment.trim().toLowerCase())
  }

  function fillExisting() {
    if (!assessment) return
    const nextScores: Record<string,string> = {}; const nextNotes: Record<string,string> = {}
    students.forEach(s => { const g = existing(s.id); if (g) { nextScores[s.id] = String(g.score); nextNotes[s.id] = g.note || '' } })
    setScores(nextScores); setNotes(nextNotes)
  }

  async function save(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError(''); setMessage('')
    if (!classId || !subjectId || !periodId || !assessment.trim()) { setError('Select a class, subject, grading period and assessment name.'); setSaving(false); return }
    const max = Number(maxScore)
    if (!Number.isFinite(max) || max <= 0) { setError('Max score must be greater than 0.'); setSaving(false); return }
    const entries = students.filter(s => scores[s.id] !== undefined && scores[s.id] !== '').map(s => ({student:s, score:Number(scores[s.id])}))
    for (const entry of entries) {
      if (!Number.isFinite(entry.score) || entry.score < 0 || entry.score > max) { setError(`Invalid score for ${entry.student.first_name} ${entry.student.last_name}.`); setSaving(false); return }
    }
    for (const entry of entries) {
      const old = existing(entry.student.id)
      const result = old
        ? await supabase.rpc('update_grade', { p_grade_id: old.id, p_score: entry.score, p_max_score: max, p_note: notes[entry.student.id] || null, p_assessment_name: assessment.trim(), p_grading_period_id: periodId })
        : await supabase.rpc('create_grade', { p_student_id: entry.student.id, p_subject_id: subjectId, p_class_id: classId, p_assessment_name: assessment.trim(), p_score: entry.score, p_max_score: max, p_note: notes[entry.student.id] || null, p_grading_period_id: periodId })
      if (result.error) { setError(result.error.message); setSaving(false); return }
    }
    await loadGrades(classId, subjectId, periodId)
    setMessage(`${entries.length} grade(s) saved.`)
    setSaving(false)
  }

  const selectedClass = classes.find(c => c.id === classId)
  const selectedSubject = subjects.find(s => s.id === subjectId)
  const selectedPeriod = periods.find(p => p.id === periodId)
  const studentAverages = useMemo(() => students.map(student => {
    const rows = grades.filter(g => g.student_id === student.id)
    const totalMax = rows.reduce((sum, g) => sum + Number(g.max_score), 0)
    const totalScore = rows.reduce((sum, g) => sum + Number(g.score), 0)
    return { ...student, count: rows.length, average: totalMax > 0 ? (totalScore / totalMax) * 100 : null }
  }), [students, grades])
  const classAverage = useMemo(() => {
    const values = studentAverages.map(s => s.average).filter((v): v is number => v !== null)
    return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null
  }, [studentAverages])

  return <main className="min-h-screen bg-slate-50 p-6 md:p-10"><div className="mx-auto max-w-7xl">
    <header><p className="text-sm font-semibold text-blue-600">AtechOS</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Grades</h1><p className="mt-1 text-slate-500">Enter and update assessment grades by class, subject and grading period.</p></header>
    {error && <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {message && <p className="mt-6 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-4 md:grid-cols-3"><label className="text-sm font-medium">Class<select value={classId} onChange={e => setClassId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"><option value="">Select class...</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.grade_levels?.short_name ? ` · ${c.grade_levels.short_name}` : ''}{c.academic_years?.name ? ` · ${c.academic_years.name}` : ''}</option>)}</select></label><label className="text-sm font-medium">Subject<select value={subjectId} onChange={e => setSubjectId(e.target.value)} disabled={!classId} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"><option value="">Select subject...</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}{s.code ? ` · ${s.code}` : ''}</option>)}</select></label><label className="text-sm font-medium">Grading period<select value={periodId} onChange={e => setPeriodId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"><option value="">Select period...</option>{periods.map(p => <option key={p.id} value={p.id}>{p.name} · {p.code} ({p.weight}%)</option>)}</select></label></div><div className="mt-4 grid gap-4 md:grid-cols-3"><label className="text-sm font-medium">Assessment name<input value={assessment} onChange={e => setAssessment(e.target.value)} onBlur={fillExisting} placeholder="Control 1" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"/></label><label className="text-sm font-medium">Max score<input type="number" min="1" step="0.01" value={maxScore} onChange={e => setMaxScore(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"/></label><div className="flex items-end"><button type="button" onClick={fillExisting} disabled={!assessment || !subjectId || !periodId} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold">Load existing scores</button></div></div></section>
    <section className="mt-6 grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Assessments entered</p><p className="mt-1 text-2xl font-bold text-slate-900">{grades.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Class average</p><p className="mt-1 text-2xl font-bold text-slate-900">{classAverage === null ? '—' : `${classAverage.toFixed(2)}%`}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Period</p><p className="mt-1 text-lg font-bold text-slate-900">{selectedPeriod?.name || '—'}</p></div></section>
    <form onSubmit={save} className="mt-6"><div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Student code</th><th className="px-4 py-3 w-40">Score</th><th className="px-4 py-3">Note</th></tr></thead><tbody>{students.map(s => <tr key={s.id} className="border-b border-slate-100 last:border-0"><td className="px-4 py-3 font-medium">{s.first_name} {s.last_name}</td><td className="px-4 py-3 text-slate-500">{s.student_code || '—'}</td><td className="px-4 py-3"><input type="number" min="0" max={maxScore} step="0.01" value={scores[s.id] || ''} onChange={e => setScores(prev => ({...prev,[s.id]:e.target.value}))} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="—"/></td><td className="px-4 py-3"><input value={notes[s.id] || ''} onChange={e => setNotes(prev => ({...prev,[s.id]:e.target.value}))} className="w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Optional note"/></td></tr>)}</tbody></table>{!loading && students.length === 0 && <p className="p-6 text-slate-500">Select a class with enrolled students.</p>}</div><div className="mt-4 flex items-center justify-between"><p className="text-sm text-slate-500">{selectedClass?.name || 'No class'} {selectedSubject ? `· ${selectedSubject.name}` : ''} {selectedPeriod ? `· ${selectedPeriod.name}` : ''}</p><button disabled={saving || !classId || !subjectId || !periodId || students.length === 0} className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white">{saving ? 'Saving...' : 'Save grades'}</button></div></form>
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="text-xl font-bold text-slate-900">Grade history</h2><p className="mt-1 text-sm text-slate-500">Assessment history for the selected class, subject and grading period.</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Assessment</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Percent</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Note</th></tr></thead><tbody>{grades.map(g => { const student = students.find(s => s.id === g.student_id); const percent = Number(g.max_score) > 0 ? (Number(g.score) / Number(g.max_score)) * 100 : 0; return <tr key={g.id} className="border-t border-slate-100"><td className="px-4 py-3 font-medium">{student ? `${student.first_name} ${student.last_name}` : '—'}</td><td className="px-4 py-3">{g.assessment_name}</td><td className="px-4 py-3">{g.score} / {g.max_score}</td><td className="px-4 py-3">{percent.toFixed(2)}%</td><td className="px-4 py-3 text-slate-500">{g.graded_at ? new Date(g.graded_at).toLocaleDateString() : '—'}</td><td className="px-4 py-3 text-slate-500">{g.note || '—'}</td></tr>})}</tbody></table>{grades.length === 0 && <p className="p-6 text-slate-500">No grades recorded for this selection yet.</p>}</div></section>
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="text-xl font-bold text-slate-900">Student averages</h2><p className="mt-1 text-sm text-slate-500">Average is calculated from total points earned divided by total points possible for the selected period and subject.</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Assessments</th><th className="px-4 py-3">Average</th></tr></thead><tbody>{studentAverages.map(s => <tr key={s.id} className="border-t border-slate-100"><td className="px-4 py-3 font-medium">{s.first_name} {s.last_name}</td><td className="px-4 py-3">{s.count}</td><td className="px-4 py-3 font-semibold">{s.average === null ? '—' : `${s.average.toFixed(2)}%`}</td></tr>)}</tbody></table></div></section>
  </div></main>
}
