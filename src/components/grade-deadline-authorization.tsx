'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { T } from '@/components/translation-provider'
import { createClient } from '@/lib/supabase/client'

type Teacher = { id: string; full_name: string }

export default function GradeDeadlineAuthorization({ classId, subjectId, periodId }: { classId: string; subjectId: string; periodId: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [canManage, setCanManage] = useState(false)
  const [teacherId, setTeacherId] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(''); setMessage(''); setTeacherId(''); setTeachers([])
      const { data: context, error: contextError } = await supabase.rpc('school_context')
      if (contextError) { if (!cancelled) setError(contextError.message); return }
      const allowed = Boolean(context?.roles?.some((role: string) => ['school_admin', 'director', 'censeur'].includes(role)))
      if (!cancelled) setCanManage(allowed)
      if (!allowed) return
      const { data: assignments, error: assignmentError } = await supabase.from('class_subjects').select('teacher_id').eq('class_id', classId).eq('subject_id', subjectId).not('teacher_id', 'is', null)
      if (assignmentError) { if (!cancelled) setError(assignmentError.message); return }
      const assignedIds = Array.from(new Set((assignments || []).map(row => row.teacher_id).filter((id): id is string => Boolean(id))))
      if (!assignedIds.length) return
      const { data: members, error: memberError } = await supabase.from('school_members').select('user_id').eq('role', 'teacher').eq('enabled', true).in('user_id', assignedIds)
      if (memberError) { if (!cancelled) setError(memberError.message); return }
      const memberIds = (members || []).map(row => row.user_id)
      if (!memberIds.length) return
      const { data: users, error: usersError } = await supabase.from('users').select('id,full_name').in('id', memberIds).order('full_name')
      if (cancelled) return
      if (usersError) setError(usersError.message)
      setTeachers((users || []).map(user => ({ id: user.id, full_name: user.full_name || '—' })))
    }
    void load()
    return () => { cancelled = true }
  }, [supabase, classId, subjectId])

  async function grant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    if (!teacherId || !expiresAt || reason.trim().length < 3) {
      setError('Choose a teacher, expiry date and reason.')
      setBusy(false); return
    }
    const { error: grantError } = await supabase.rpc('grant_grade_deadline_exception', {
      p_teacher: teacherId, p_class: classId, p_subject: subjectId, p_period: periodId,
      p_expires_at: new Date(expiresAt).toISOString(), p_reason: reason.trim()
    })
    if (grantError) setError(grantError.message)
    else { setMessage('Temporary grade access was granted.'); setTeacherId(''); setExpiresAt(''); setReason('') }
    setBusy(false)
  }

  if (!canManage) return null
  return <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
    <h2 className="text-lg font-semibold text-amber-950"><T text="Authorize temporary grade entry"/></h2>
    <p className="mt-1 text-sm text-amber-900"><T text="If a teacher's grade deadline has passed, Direction can grant access for this class, subject and period until an expiry time it chooses."/></p>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700"><T text={error}/></p>}
    {message && <p role="status" className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800"><T text={message}/></p>}
    <form onSubmit={grant} className="mt-4 grid gap-3 md:grid-cols-4">
      <label className="text-sm font-medium"><T text="Teacher"/><select required value={teacherId} onChange={event => setTeacherId(event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"><option value=""><T text="Choose a teacher"/></option>{teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}</select></label>
      <label className="text-sm font-medium"><T text="Expires at"/><input required type="datetime-local" value={expiresAt} onChange={event => setExpiresAt(event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"/></label>
      <label className="text-sm font-medium md:col-span-2"><T text="Reason for temporary access"/><input required minLength={3} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"/></label>
      <button disabled={busy || !teachers.length} className="rounded-lg bg-amber-700 px-4 py-2 font-semibold text-white disabled:opacity-50"><T text={busy ? 'Saving...' : 'Grant temporary access'}/></button>
    </form>
    {!teachers.length && <p className="mt-2 text-sm text-amber-900"><T text="No teacher is assigned to this class and subject."/></p>}
  </section>
}
