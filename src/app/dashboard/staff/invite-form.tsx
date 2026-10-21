'use client'
import Link from 'next/link'
import { T } from '@/components/translation-provider'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, LoaderCircle, ShieldCheck, ShieldOff } from 'lucide-react'
import { inviteMember, cancelInvitation, changeMember } from './actions'

const roleLabels: Record<string, string> = {
  school_admin: 'School administrator',
  director: 'Director',
  censeur: 'Academic reviewer',
  secretary: 'Secretary',
  teacher: 'Teacher',
  accountant: 'Accountant',
  surveillant: 'Supervisor',
  parent: 'Parent',
  student: 'Student',
}

export function InviteForm({ owner, parents, students, teacherOnly = false }: { owner: boolean; parents: { id: string; full_name: string; email: string }[]; students: { id: string; first_name: string; last_name: string }[]; teacherOnly?: boolean }) {
  const [role, setRole] = useState('teacher')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [url, setUrl] = useState('')
  const [delivery, setDelivery] = useState<'email' | 'manual' | ''>('')
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  return <form className="grid gap-4 rounded-2xl border bg-white p-6 sm:grid-cols-2" onSubmit={async e => {
    e.preventDefault(); const form = new FormData(e.currentTarget)
    setBusy(true); setError(''); setNotice(''); setUrl(''); setDelivery(''); setCopied(false)
    try {
      const result = await inviteMember(form)
      if (result.error) setError(result.error)
      else { setUrl(result.url || ''); setDelivery(result.delivery || 'manual'); if (result.notice) setNotice(result.notice); router.refresh() }
    } catch { setError('Unable to create the invitation. Please try again.') }
    finally { setBusy(false) }
  }}>
    {teacherOnly && <p className="rounded-xl bg-blue-50 p-3 text-sm leading-6 text-blue-950 sm:col-span-2"><T text="This access is limited to inviting teachers. Other staff and family roles remain managed by school administration."/></p>}
    <label className="block text-sm font-medium text-slate-800"><T text="Full name"/><input className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none transition focus-visible:border-blue-700 focus-visible:ring-2 focus-visible:ring-blue-100" name="full_name" required maxLength={150} autoComplete="name" /></label>
    <label className="block text-sm font-medium text-slate-800"><T text="Email"/><input className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none transition focus-visible:border-blue-700 focus-visible:ring-2 focus-visible:ring-blue-100" name="email" type="email" required maxLength={254} autoComplete="email" /></label>
    {teacherOnly ? <input type="hidden" name="role" value="teacher"/> : <label className="block text-sm font-medium text-slate-800"><T text="Role"/><select name="role" value={role} onChange={e => setRole(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none transition focus-visible:border-blue-700 focus-visible:ring-2 focus-visible:ring-blue-100">
      {(owner ? ['school_admin', 'director', 'censeur', 'secretary', 'teacher', 'accountant', 'surveillant', 'parent', 'student'] : ['director', 'censeur', 'secretary', 'teacher', 'accountant', 'surveillant', 'parent', 'student']).map(r => <option key={r} value={r}><T text={roleLabels[r] || r}/></option>)}
    </select></label>}
    {!teacherOnly && role === 'parent' && <label className="block text-sm font-medium text-slate-800"><T text="Guardian record"/><select name="parent_id" required className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus-visible:border-blue-700 focus-visible:ring-2 focus-visible:ring-blue-100"><option value=""><T text="Choose guardian"/></option>{parents.map(p => <option key={p.id} value={p.id}>{p.full_name} — {p.email}</option>)}</select></label>}
    {!teacherOnly && role === 'student' && <label className="block text-sm font-medium text-slate-800"><T text="Student record"/><select name="student_id" required className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus-visible:border-blue-700 focus-visible:ring-2 focus-visible:ring-blue-100"><option value=""><T text="Choose student"/></option>{students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}</select></label>}
    {!teacherOnly && <p className="text-sm leading-6 text-slate-600 sm:col-span-2"><T text="If a verified sender is configured, AtechOS emails the invitation. Otherwise, copy and share the private link. It expires in 7 days; a replacement cancels the pending invitation for the same role and record."/></p>}
    <button type="submit" disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-wait disabled:opacity-60 sm:col-span-2 sm:justify-self-start">
      {busy ? <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin"/> : null}<T text={busy ? 'Creating…' : 'Create invitation link'}/>
    </button>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:col-span-2">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 sm:col-span-2"><T text={notice}/></p>}
    {url && <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 sm:col-span-2"><p role="status" className="flex items-center gap-2 font-medium text-emerald-950"><Check aria-hidden="true" className="size-4 shrink-0"/><T text={delivery === 'email' ? 'Invitation email sent. You can also copy this recovery link.' : 'Invitation created. Share this private link manually.'}/></p><label className="block text-sm font-medium text-slate-800"><T text="Private invitation link"/><input readOnly value={url} className="mt-1 min-h-11 w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700" onFocus={e => e.target.select()} /></label><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true) } catch { setError('Select and copy the link manually.') } }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2 font-semibold text-emerald-900 transition hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"><Copy aria-hidden="true" className="size-4"/><T text={copied ? 'Copied' : 'Copy link'}/></button></div>}
  </form>
}

export function MemberAction({ id, enabled, role, owner, compact = false }: { id: string; enabled: boolean; role:string; owner:boolean; compact?: boolean }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const router = useRouter()
  const [selected,setSelected]=useState(role)
  async function update(action:string){setBusy(true);setError('');try{const result=await changeMember(id,action,action==='role'?selected:undefined);setError(result.error||'');if(!result.error)router.refresh()}catch{setError('Unable to update access.')}finally{setBusy(false)}}
  const choices=['director','censeur','secretary','teacher','accountant','surveillant','parent','student']
  if(owner)choices.unshift('school_admin')
  if(role==='teacher')return <div className={compact ? 'flex flex-wrap items-center gap-2' : 'space-y-2 py-2'}><Link href="/dashboard/approvals" className="inline-flex min-h-10 items-center rounded-lg px-2 text-sm font-medium text-blue-800 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"><T text="Request teacher access change"/></Link><p className="max-w-sm text-sm text-slate-600"><T text="Two different authorized approvers are required."/></p>{!enabled&&<button type="button" disabled={busy} className="inline-flex min-h-10 items-center rounded-lg px-3 font-semibold text-blue-800 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 disabled:opacity-50" onClick={()=>update('enable')}><T text={busy ? 'Saving...' : 'Enable access'}/></button>}{error&&<p role="alert" className="w-full text-sm text-red-800">{error}</p>}</div>
  return <div className={compact ? 'flex flex-col gap-2 sm:flex-row sm:items-center' : 'space-y-2 py-2'}>
    <label className="sr-only" htmlFor={`role-${id}`}><T text="Change role"/></label>
    <select id={`role-${id}`} disabled={busy} value={selected} onChange={e=>setSelected(e.target.value)} className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus-visible:border-blue-700 focus-visible:ring-2 focus-visible:ring-blue-100 disabled:opacity-60 sm:w-auto">{choices.map(r=><option key={r} value={r}><T text={roleLabels[r] || r}/></option>)}</select>
    <button type="button" disabled={busy||selected===role} onClick={()=>update('role')} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-45"><ShieldCheck aria-hidden="true" className="size-4"/><T text={busy ? 'Saving...' : 'Save role'}/></button>
    <button type="button" disabled={busy} className={enabled ? 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-700 disabled:opacity-50' : 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50'} onClick={()=>update(enabled?'disable':'enable')}>{enabled ? <ShieldOff aria-hidden="true" className="size-4"/> : <ShieldCheck aria-hidden="true" className="size-4"/>}<T text={busy ? 'Saving...' : enabled ? 'Disable access' : 'Enable access'}/></button>
    {selected==='parent'&&<p className="max-w-sm text-sm text-slate-600"><T text="After changing to parent, link their children in Parents. No unrelated student is linked automatically."/></p>}
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
  </div>
}

export function CancelInvitation({ id }: { id: string }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const router = useRouter()
  return <div><button type="button" disabled={busy} className="inline-flex min-h-10 items-center rounded-lg px-3 font-semibold text-rose-800 transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-700 disabled:cursor-wait disabled:opacity-50" onClick={async () => { setBusy(true); try { const result = await cancelInvitation(id); setError(result.error || ''); if (!result.error) router.refresh() } catch { setError('Unable to cancel invitation.') } finally { setBusy(false) } }}><T text={busy ? 'Cancelling...' : 'Cancel invitation'}/></button>{error && <p role="alert" className="text-sm text-red-800">{error}</p>}</div>
}

