'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Student = {
  id: string; atechos_id: string; nis: string | null; student_code: string; first_name: string; last_name: string; photo_url: string | null
  date_of_birth: string | null; sex: string | null; phone: string | null; email: string | null; address: string | null
  emergency_contact_name: string | null; emergency_contact_phone: string | null; active: boolean
}
type Badge = { student_id: string; badge_uid: string; badge_type: string; active: boolean }

const emptyForm = { nis: '', student_code: '', first_name: '', last_name: '', date_of_birth: '', sex: '', phone: '', email: '', address: '', emergency_contact_name: '', emergency_contact_phone: '', badge_uid: '', badge_type: 'rfid', active: true }

export default function StudentsPage() {
  const supabase = createClient()
  const [students, setStudents] = useState<Student[]>([]); const [badges, setBadges] = useState<Badge[]>([]); const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<Student | null>(null); const [form, setForm] = useState(emptyForm); const [photoFile, setPhotoFile] = useState<File | null>(null)

  async function loadStudents() {
    setLoading(true); setError('')
    const [sr, br] = await Promise.all([
      supabase.from('students').select('id,atechos_id,nis,student_code,first_name,last_name,photo_url,date_of_birth,sex,phone,email,address,emergency_contact_name,emergency_contact_phone,active').order('last_name').order('first_name'),
      supabase.from('student_badges').select('student_id,badge_uid,badge_type,active').eq('active', true),
    ])
    if (sr.error || br.error) setError((sr.error || br.error)?.message || 'Could not load students')
    setStudents((sr.data || []) as Student[]); setBadges((br.data || []) as Badge[]); setLoading(false)
  }
  useEffect(() => { loadStudents() }, [])
  const filtered = useMemo(() => { const q = query.trim().toLowerCase(); if (!q) return students; return students.filter(s => [s.atechos_id,s.first_name,s.last_name,s.nis,s.student_code,s.email,s.phone].some(v => v?.toLowerCase().includes(q))) }, [students, query])
  function badgeFor(studentId: string) { return badges.find(b => b.student_id === studentId) }
  function openCreate() { setEditing(null); setForm(emptyForm); setPhotoFile(null); setError(''); setShowForm(true) }
  function openEdit(student: Student) { const b = badgeFor(student.id); setEditing(student); setPhotoFile(null); setForm({ nis: student.nis ?? '', student_code: student.student_code, first_name: student.first_name, last_name: student.last_name, date_of_birth: student.date_of_birth ?? '', sex: student.sex ?? '', phone: student.phone ?? '', email: student.email ?? '', address: student.address ?? '', emergency_contact_name: student.emergency_contact_name ?? '', emergency_contact_phone: student.emergency_contact_phone ?? '', badge_uid: b?.badge_uid ?? '', badge_type: b?.badge_type ?? 'rfid', active: student.active }); setError(''); setShowForm(true) }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('')
    const args = { p_nis: form.nis || null, p_student_code: form.student_code || null, p_first_name: form.first_name, p_last_name: form.last_name, p_date_of_birth: form.date_of_birth || null, p_sex: form.sex || null, p_phone: form.phone || null, p_email: form.email || null, p_address: form.address || null, p_emergency_contact_name: form.emergency_contact_name || null, p_emergency_contact_phone: form.emergency_contact_phone || null }
    const result = editing ? await supabase.rpc('update_student', { p_student_id: editing.id, ...args, p_active: form.active }) : await supabase.rpc('create_student', args)
    if (result.error) { setError(result.error.message.replace('student_code_already_exists','Student code already exists').replace('nis_already_exists','NISU already exists').replace('first_name_required','First name is required').replace('last_name_required','Last name is required').replace('not_authorized','Only school administration can manage students')); setSaving(false); return }
    const studentId = editing?.id || result.data
    if (photoFile) {
      if (!['image/jpeg','image/png','image/webp'].includes(photoFile.type)) { setError('Photo must be JPG, PNG or WebP.'); setSaving(false); return }
      if (photoFile.size > 5 * 1024 * 1024) { setError('Photo must be 5 MB or smaller.'); setSaving(false); return }
      const { data: schoolId, error: schoolError } = await supabase.rpc('get_my_school_id')
      if (schoolError || !schoolId) { setError(schoolError?.message || 'Could not determine school.'); setSaving(false); return }
      const ext = photoFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${schoolId}/${studentId}-${Date.now()}.${ext}`
      const upload = await supabase.storage.from('student-photos').upload(path, photoFile, { contentType: photoFile.type, upsert: false })
      if (upload.error) { setError(upload.error.message); setSaving(false); return }
      const photoResult = await supabase.rpc('update_student_photo_url', { p_student_id: studentId, p_photo_url: path })
      if (photoResult.error) { setError(photoResult.error.message.replace('not_authorized','Only school administration can manage student photos')); setSaving(false); return }
    }
    if (form.badge_uid.trim()) {
      const badgeResult = await supabase.rpc('assign_student_badge', { p_student_id: studentId, p_badge_uid: form.badge_uid.trim(), p_badge_type: form.badge_type })
      if (badgeResult.error) { setError(badgeResult.error.message.replace('badge_already_assigned','This badge is already assigned to another student').replace('badge_uid_required','Badge UID is required').replace('not_authorized','Only school administration can manage badges')); setSaving(false); return }
    }
    setShowForm(false); setSaving(false); await loadStudents()
  }

  return <main className="min-h-screen bg-slate-50 p-6 md:p-10"><div className="mx-auto max-w-7xl">
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><a href="/dashboard" className="text-sm font-semibold text-blue-600">← Dashboard</a><h1 className="mt-2 text-3xl font-bold text-slate-900">Students</h1><p className="mt-1 text-slate-500">Manage NISU, AtechOS ID, photo and student badges.</p></div><button onClick={openCreate} className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white">+ Add student</button></header>
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search AtechOS ID, name, NISU, code..." className="w-full rounded-xl border border-slate-300 px-4 py-3 md:max-w-lg"/><span className="text-sm text-slate-500">{filtered.length} student{filtered.length===1?'':'s'}</span></div>
      {error&&!showForm&&<p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {loading?<p className="py-12 text-center text-slate-500">Loading students...</p>:filtered.length===0?<p className="py-12 text-center text-slate-500">No students found.</p>:<div className="mt-5 overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="px-3 py-3">Student / AtechOS ID</th><th className="px-3 py-3">NISU</th><th className="px-3 py-3">Badge</th><th className="px-3 py-3">Photo</th><th className="px-3 py-3">Status</th><th className="px-3 py-3"/></tr></thead><tbody>{filtered.map(s=>{const b=badgeFor(s.id);return <tr key={s.id} className="border-b border-slate-100"><td className="px-3 py-4"><p className="font-semibold">{s.first_name} {s.last_name}</p><p className="text-xs font-mono text-blue-700">{s.atechos_id}</p></td><td className="px-3 py-4 text-slate-600">{s.nis||'—'}</td><td className="px-3 py-4">{b?<><span className="font-mono text-xs">{b.badge_uid}</span><span className="ml-2 rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">{b.badge_type.toUpperCase()}</span></>:<span className="text-slate-400">Not assigned</span>}</td><td className="px-3 py-4">{s.photo_url?<span className="text-emerald-700">Ready</span>:<span className="text-slate-400">Missing</span>}</td><td className="px-3 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{s.active?'Active':'Inactive'}</span></td><td className="px-3 py-4 text-right"><button onClick={()=>openEdit(s)} className="font-semibold text-blue-600">Edit</button></td></tr>})}</tbody></table></div>}
    </section>
    {showForm&&<div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-4 md:p-10"><section className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-xl md:p-8"><div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold">{editing?'Edit student':'Add student'}</h2><p className="mt-1 text-sm text-slate-500">NISU is the Ministry identifier. AtechOS generates its own private ID automatically.</p></div><button onClick={()=>setShowForm(false)} className="text-slate-500">✕</button></div>
      {editing&&<div className="mt-5 rounded-xl bg-blue-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Private AtechOS ID</p><p className="mt-1 font-mono text-lg font-bold text-blue-900">{editing.atechos_id}</p><p className="mt-1 text-xs text-blue-700">This ID is internal to AtechOS and is never printed on the student badge.</p></div>}
      <form onSubmit={submit} className="mt-6 grid gap-4 md:grid-cols-2"><Field label="First name" value={form.first_name} required onChange={v=>setForm({...form,first_name:v})}/><Field label="Last name" value={form.last_name} required onChange={v=>setForm({...form,last_name:v})}/><Field label="NISU (Ministère)" value={form.nis} onChange={v=>setForm({...form,nis:v})}/><Field label="School student code (optional)" value={form.student_code} onChange={v=>setForm({...form,student_code:v})}/><div className="md:col-span-2 rounded-xl border border-slate-200 p-4"><p className="font-semibold text-slate-800">Student photo</p><p className="mt-1 text-xs text-slate-500">Upload an approved JPG, PNG or WebP photo (max 5 MB). Photos are stored privately per school.</p>{editing?.photo_url&&<p className="mt-2 text-xs font-medium text-emerald-700">A photo is already saved. Upload another one to replace it.</p>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setPhotoFile(e.target.files?.[0] || null)} className="mt-3 block w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"/></div><div className="md:col-span-2 rounded-xl border border-slate-200 p-4"><p className="font-semibold text-slate-800">Badge d'accès</p><p className="mt-1 text-xs text-slate-500">For RFID/NFC readers. The badge UID is what the kiosk will scan for check-in/check-out.</p><div className="mt-3 grid gap-4 md:grid-cols-2"><Field label="Badge UID" value={form.badge_uid} onChange={v=>setForm({...form,badge_uid:v})}/><label className="block"><span className="text-sm font-medium">Type</span><select value={form.badge_type} onChange={e=>setForm({...form,badge_type:e.target.value})} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"><option value="rfid">RFID</option><option value="nfc">NFC</option><option value="qr">QR</option></select></label></div></div><Field label="Date of birth" type="date" value={form.date_of_birth} onChange={v=>setForm({...form,date_of_birth:v})}/><label className="block"><span className="text-sm font-medium">Sex</span><select value={form.sex} onChange={e=>setForm({...form,sex:e.target.value})} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"><option value="">Select</option><option value="M">Male</option><option value="F">Female</option><option value="Other">Other</option></select></label><Field label="Phone" value={form.phone} onChange={v=>setForm({...form,phone:v})}/><Field label="Email" type="email" value={form.email} onChange={v=>setForm({...form,email:v})}/><div className="md:col-span-2"><Field label="Address" value={form.address} onChange={v=>setForm({...form,address:v})}/></div><Field label="Emergency contact" value={form.emergency_contact_name} onChange={v=>setForm({...form,emergency_contact_name:v})}/><Field label="Emergency phone" value={form.emergency_contact_phone} onChange={v=>setForm({...form,emergency_contact_phone:v})}/>{editing&&<label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/> Student is active</label>}{error&&<p className="md:col-span-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}<div className="flex gap-3 md:col-span-2 md:justify-end"><button type="button" onClick={()=>setShowForm(false)} className="rounded-xl border border-slate-300 px-5 py-3 font-semibold">Cancel</button><button disabled={saving} type="submit" className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white">{saving?'Saving...':editing?'Save changes':'Create student'}</button></div></form>
    </section></div>}
  </div></main>
}
function Field({label,value,onChange,type='text',required=false}:{label:string;value:string;onChange:(value:string)=>void;type?:string;required?:boolean}){return <label className="block"><span className="text-sm font-medium text-slate-700">{label}</span><input required={required} type={type} value={value} onChange={e=>onChange(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"/></label>}
