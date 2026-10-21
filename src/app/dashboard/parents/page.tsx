'use client'
import { T, useLocale } from '@/components/translation-provider'
import { translate } from '@/lib/translations'

import { useEffect, useState } from 'react'
import ParentInvite from '@/components/parent-invite'
import { createClient } from '@/lib/supabase/client'

type Parent = { id: string; full_name: string | null; email: string | null; relationship: string | null; user_id: string | null }
type Student = { id: string; first_name: string; last_name: string; student_code: string | null }
type LinkRow = { student_id: string; parent_id: string; is_primary: boolean }
type UserRow = { id: string; full_name: string | null; email: string | null }

export default function ParentsPage() {
  const locale = useLocale()
  let supabase: ReturnType<typeof createClient> | null = null
  const getSupabase = () => {
    if (!supabase) supabase = createClient()
    return supabase
  }
  const [parents, setParents] = useState<Parent[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [links, setLinks] = useState<LinkRow[]>([])
  const [inviteStudentId, setInviteStudentId] = useState('')
  const [prefilledStudentApplied, setPrefilledStudentApplied] = useState(false)
  const [linkStudentId, setLinkStudentId] = useState('')
  const [inviteStudentQuery, setInviteStudentQuery] = useState('')
  const [linkStudentQuery, setLinkStudentQuery] = useState('')
  const [parentQuery, setParentQuery] = useState('')
  const [parentId, setParentId] = useState('')
  const [relationship, setRelationship] = useState('Parent')
  const [primary, setPrimary] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    setLoading(true); setError('')
    const [p, s, l] = await Promise.all([
      getSupabase().from('parents').select('id,relationship,user_id,full_name,email').order('relationship'),
      getSupabase().from('students').select('id,first_name,last_name').eq('active', true).order('last_name').order('first_name'),
      getSupabase().from('student_parents').select('student_id,parent_id,is_primary'),
    ])
    if (p.error || s.error || l.error) setError((p.error || s.error || l.error)?.message || 'Could not load parent data.')
    const parentRows = (p.data || []) as Parent[]
    setParents(parentRows); setStudents((s.data || []) as Student[]); setLinks((l.data || []) as LinkRow[])
    const userIds = parentRows.map(x => x.user_id).filter(Boolean) as string[]
    if (userIds.length) {
      const u = await getSupabase().from('users').select('id,full_name,email').in('id', userIds)
      if (u.error) setError(u.error.message); else setUsers((u.data || []) as UserRow[])
    } else setUsers([])
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    if (loading || prefilledStudentApplied) return
    setPrefilledStudentApplied(true)
    const requestedStudentId = new URLSearchParams(window.location.search).get('studentId')
    if (requestedStudentId && students.some(student => student.id === requestedStudentId)) setInviteStudentId(requestedStudentId)
  }, [loading, prefilledStudentApplied, students])

  const filterStudents = (query: string) => {
    const term = query.trim().toLowerCase()
    return students.filter(student => !term || (student.first_name + ' ' + student.last_name).toLowerCase().includes(term))
  }
  const matchingInviteStudents = filterStudents(inviteStudentQuery)
  const matchingLinkStudents = filterStudents(linkStudentQuery)
  const matchingParents = parents.filter(parent => {
    const term = parentQuery.trim().toLowerCase()
    const user = users.find(item => item.id === parent.user_id)
    return !term || [parent.full_name, user?.full_name, parent.email, user?.email, parent.relationship].some(value => value?.toLowerCase().includes(term))
  })

  async function linkParent() {
    if (!linkStudentId || !parentId || !relationship.trim()) { setError('Student, parent and relationship are required.'); return }
    setSaving(true); setError(''); setMessage('')
    const { error: rpcError } = await getSupabase().rpc('link_student_parent', { p_student_id: linkStudentId, p_parent_id: parentId, p_relationship: relationship.trim(), p_is_primary: primary })
    if (rpcError) setError(rpcError.message)
    else { setMessage('Parent linked successfully.'); setLinkStudentId(''); setParentId(''); setPrimary(false); await load() }
    setSaving(false)
  }

  function parentLabel(parent: Parent) {
    const user = users.find(u => u.id === parent.user_id)
    return parent.full_name || user?.full_name || parent.email || user?.email || parent.relationship || 'Parent'
  }

  return <main className="p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-7xl">
    <header className="mb-6"><h1 className="text-3xl font-bold tracking-tight text-slate-950"><T text="Parents"/></h1>
    <p className="mt-1 text-slate-600"><T text="Manage family relationships. Only authorized school administration can create or change links."/></p></header>
    {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><T text={error}/></p>}
    {message && <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><T text={message}/></p>}

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="font-semibold text-slate-900"><T text="Select student to invite a parent"/></h2><div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><input type="search" aria-label={translate('Search students by name',locale)} placeholder={translate('Search students by name',locale)} value={inviteStudentQuery} onChange={e=>setInviteStudentQuery(e.target.value)} className="min-h-11 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /><select value={inviteStudentId} onChange={e=>setInviteStudentId(e.target.value)} className="min-h-11 rounded-xl border border-slate-300 px-4 py-3"><option value=""><T text="Select student"/></option>{matchingInviteStudents.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}</select></div>{inviteStudentId && <div className="mt-4 border-t border-slate-100 pt-4"><ParentInvite key={inviteStudentId} studentId={inviteStudentId} /></div>}</section>
    {!loading && parents.length > 0 && students.length > 0 && <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="font-semibold text-slate-900"><T text="Link a parent to a student"/></h2><div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm font-medium"><T text="Student"/><input type="search" aria-label={translate('Search students by name',locale)} placeholder={translate('Search students by name',locale)} value={linkStudentQuery} onChange={e=>setLinkStudentQuery(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3" /><select value={linkStudentId} onChange={e=>setLinkStudentId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"><option value=""><T text="Select student"/></option>{matchingLinkStudents.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}</select></label>
      <label className="text-sm font-medium"><T text="Parent"/><input type="search" aria-label={translate('Search parents by name or email',locale)} placeholder={translate('Search parents by name or email',locale)} value={parentQuery} onChange={e=>setParentQuery(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3" /><select value={parentId} onChange={e=>setParentId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"><option value=""><T text="Select parent"/></option>{matchingParents.map(p=><option key={p.id} value={p.id}>{parentLabel(p)}</option>)}</select></label>
      <label className="text-sm font-medium"><T text="Relationship"/><input value={relationship} onChange={e=>setRelationship(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3" placeholder={translate('Parent, Mother, Father...',locale)} /></label>
      <div className="flex items-end gap-3"><label className="flex items-center gap-2 pb-3 text-sm"><input type="checkbox" checked={primary} onChange={e=>setPrimary(e.target.checked)} /><T text="Primary"/></label><button onClick={linkParent} disabled={saving} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving?<T text="Saving…"/>:<T text="Link parent"/>}</button></div>
    </div></section>}

    {loading ? <p className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-slate-500"><T text="Loading parents…"/></p> : <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="font-semibold text-slate-900"><T text="Family relationships"/></h2><p className="mt-1 text-sm text-slate-500"><T text="Parent accounts"/>: {parents.length} · <T text="Active students"/>: {students.length}</p></div><div className="divide-y divide-slate-100">{students.map(student => { const rows = links.filter(x => x.student_id === student.id); return <div key={student.id} className="flex flex-col gap-2 p-5 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold text-slate-900">{student.first_name} {student.last_name}</p><p className="text-xs text-slate-500">{student.student_code || <T text="No student code"/>}</p></div><p className="text-sm text-slate-600">{rows.length ? rows.map(x => { const p=parents.find(y=>y.id===x.parent_id); return [p?parentLabel(p):translate('Parent',locale),p?.relationship||translate('Parent',locale),x.is_primary?translate('Primary',locale):''].filter(Boolean).join(' · ') }).join(', ') : <T text="No parent linked yet"/>}</p></div> })}</div>{!students.length && <p className="p-6 text-slate-500"><T text="No active students found."/></p>}</section>}
  </div></main>
}
