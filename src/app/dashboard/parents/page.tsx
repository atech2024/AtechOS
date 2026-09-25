'use client'
import { T } from '@/components/translation-provider'

import { useEffect, useState } from 'react'
import ParentInvite from '@/components/parent-invite'
import { createClient } from '@/lib/supabase/client'

type Parent = { id: string; full_name: string | null; email: string | null; relationship: string | null; user_id: string | null }
type Student = { id: string; first_name: string; last_name: string; student_code: string | null }
type LinkRow = { student_id: string; parent_id: string; is_primary: boolean }
type UserRow = { id: string; full_name: string | null; email: string | null }

export default function ParentsPage() {
  let supabase: ReturnType<typeof createClient> | null = null
  const getSupabase = () => {
    if (!supabase) supabase = createClient()
    return supabase
  }
  const [parents, setParents] = useState<Parent[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [links, setLinks] = useState<LinkRow[]>([])
  const [studentId, setStudentId] = useState('')
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

  async function linkParent() {
    if (!studentId || !parentId || !relationship.trim()) { setError('Student, parent and relationship are required.'); return }
    setSaving(true); setError(''); setMessage('')
    const { error: rpcError } = await getSupabase().rpc('link_student_parent', { p_student_id: studentId, p_parent_id: parentId, p_relationship: relationship.trim(), p_is_primary: primary })
    if (rpcError) setError(rpcError.message)
    else { setMessage('Parent linked successfully.'); setStudentId(''); setParentId(''); setPrimary(false); await load() }
    setSaving(false)
  }

  function parentLabel(parent: Parent) {
    const user = users.find(u => u.id === parent.user_id)
    return parent.full_name || user?.full_name || parent.email || user?.email || parent.relationship || 'Parent'
  }

  return <main className="min-h-screen bg-slate-50 p-6 md:p-10"><div className="mx-auto max-w-7xl">
    <a href="/dashboard" className="text-sm font-semibold text-blue-600"><T text="← Dashboard"/></a>
    <h1 className="mt-2 text-3xl font-bold text-slate-900"><T text="Parents"/></h1>
    <p className="mt-1 text-slate-500">Manage family relationships. Only authorized school administration can create or change links.</p>
    {error && <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {message && <p className="mt-6 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}

    <section className="mt-6"><label>Select student to invite a parent<select value={studentId} onChange={e=>setStudentId(e.target.value)} className="m-3 rounded border p-3"><option value=""><T text="Select student"/></option>{students.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}</select></label>{studentId && <ParentInvite key={studentId} studentId={studentId} />}</section>
    {!loading && parents.length > 0 && students.length > 0 && <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Link a parent to a student</h2><div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm font-medium"><T text="Student"/><select value={studentId} onChange={e=>setStudentId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"><option value=""><T text="Select student"/></option>{students.map(s=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}{s.student_code ? ` · ${s.student_code}` : ''}</option>)}</select></label>
      <label className="text-sm font-medium">Parent<select value={parentId} onChange={e=>setParentId(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"><option value="">Select parent</option>{parents.map(p=><option key={p.id} value={p.id}>{parentLabel(p)}</option>)}</select></label>
      <label className="text-sm font-medium">Relationship<input value={relationship} onChange={e=>setRelationship(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3" placeholder="Parent, Mother, Father..." /></label>
      <div className="flex items-end gap-3"><label className="flex items-center gap-2 pb-3 text-sm"><input type="checkbox" checked={primary} onChange={e=>setPrimary(e.target.checked)} /> Primary</label><button onClick={linkParent} disabled={saving} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving?'Saving...':'Link parent'}</button></div>
    </div></section>}

    {loading ? <p className="mt-8 text-slate-500">Loading parents...</p> : <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="font-semibold">Family relationships</h2><p className="mt-1 text-sm text-slate-500">{parents.length} parent account(s) · {students.length} active student(s)</p></div><div className="divide-y divide-slate-100">{students.map(student => { const rows = links.filter(x => x.student_id === student.id); return <div key={student.id} className="flex flex-col gap-2 p-5 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold text-slate-900">{student.first_name} {student.last_name}</p><p className="text-xs text-slate-500">{student.student_code || 'No student code'}</p></div><p className="text-sm text-slate-600">{rows.length ? rows.map(x => { const p=parents.find(y=>y.id===x.parent_id); return `${p?parentLabel(p):'Parent'} · ${p?.relationship||'Parent'}${x.is_primary?' · Primary':''}` }).join(', ') : 'No parent linked yet'}</p></div> })}</div>{!students.length && <p className="p-6 text-slate-500">No active students found.</p>}</section>}
  </div></main>
}
