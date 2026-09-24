'use client'
import { T } from '@/components/translation-provider'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { inviteMember, cancelInvitation, changeMember } from './actions'

export function InviteForm({ owner, parents, students }: { owner: boolean; parents: { id: string; full_name: string; email: string }[]; students: { id: string; first_name: string; last_name: string }[] }) {
  const [role, setRole] = useState('teacher')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [url, setUrl] = useState('')
  const [delivery, setDelivery] = useState<'email' | 'manual' | ''>('')
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  return <form className="grid gap-4 rounded-2xl border bg-white p-6 sm:grid-cols-2" onSubmit={async e => {
    e.preventDefault(); const form = new FormData(e.currentTarget)
    setBusy(true); setError(''); setUrl(''); setDelivery(''); setCopied(false)
    try {
      const result = await inviteMember(form)
      if (result.error) setError(result.error)
      else { setUrl(result.url || ''); setDelivery(result.delivery || 'manual'); if (result.notice) setError(result.notice); router.refresh() }
    } catch { setError('Unable to create the invitation. Please try again.') }
    finally { setBusy(false) }
  }}>
    <h2 className="text-xl font-semibold sm:col-span-2">Invite a person</h2>
    <label><T text="Full name"/><input className="mt-1 w-full rounded border p-2" name="full_name" required maxLength={150} /></label>
    <label><T text="Email"/><input className="mt-1 w-full rounded border p-2" name="email" type="email" required maxLength={254} /></label>
    <label>Role<select name="role" value={role} onChange={e => setRole(e.target.value)} className="mt-1 w-full rounded border p-2">
      {(owner ? ['school_admin', 'director', 'secretary', 'teacher', 'accountant', 'surveillant', 'parent', 'student'] : ['director', 'secretary', 'teacher', 'accountant', 'surveillant', 'parent', 'student']).map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
    </select></label>
    {role === 'parent' && <label>Guardian record<select name="parent_id" required className="mt-1 w-full rounded border p-2"><option value="">Choose guardian</option>{parents.map(p => <option key={p.id} value={p.id}>{p.full_name} — {p.email}</option>)}</select></label>}
    {role === 'student' && <label><T text="Student record"/><select name="student_id" required className="mt-1 w-full rounded border p-2"><option value="">Choose student</option>{students.map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}</select></label>}
    <p className="text-sm text-slate-600 sm:col-span-2">If a verified sender is configured, AtechOS emails the invitation. Otherwise, copy and share the private link. It expires in 7 days; a replacement cancels the pending invitation for the same role and record.</p>
    <button disabled={busy} className="rounded-xl bg-blue-600 p-3 text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create invitation link'}</button>
    {error && <p role="alert" className="text-red-700 sm:col-span-2">{error}</p>}
    {url && <div className="space-y-2 rounded bg-blue-50 p-4 sm:col-span-2"><p>{delivery === 'email' ? 'Invitation email sent. You can also copy this recovery link.' : 'Invitation created. Share this private link manually.'}</p><label><T text="Private invitation link"/><input readOnly value={url} className="w-full rounded border p-2" onFocus={e => e.target.select()} /></label><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true) } catch { setError('Select and copy the link manually.') } }}>{copied ? 'Copied' : 'Copy link'}</button></div>}
  </form>
}

export function MemberAction({ id, enabled, role, owner }: { id: string; enabled: boolean; role:string; owner:boolean }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const router = useRouter()
  const [selected,setSelected]=useState(role)
  async function update(action:string){setBusy(true);setError('');try{const result=await changeMember(id,action,action==='role'?selected:undefined);setError(result.error||'');if(!result.error)router.refresh()}catch{setError('Unable to update access.')}finally{setBusy(false)}}
  const choices=['director','secretary','teacher','accountant','surveillant','parent','student']
  if(owner)choices.unshift('school_admin')
  return <div className="space-y-2 py-2"><label className="block"><T text="Change role"/><select disabled={busy} value={selected} onChange={e=>setSelected(e.target.value)} className="ml-2 rounded border p-2">{choices.map(r=><option key={r} value={r}>{r}</option>)}</select></label><button disabled={busy||selected===role} onClick={()=>update('role')} className="rounded border px-3 py-1 disabled:opacity-40"><T text="Save role"/></button><button disabled={busy} className="ml-3 text-blue-700" onClick={()=>update(enabled?'disable':'enable')}>{enabled ? 'Disable access' : 'Enable access'}</button>{selected==='parent'&&<p className="max-w-sm text-sm text-slate-600"><T text="After changing to parent, link their children in Parents. No unrelated student is linked automatically."/></p>}{error && <p role="alert" className="text-red-700">{error}</p>}</div>
}

export function CancelInvitation({ id }: { id: string }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const router = useRouter()
  return <div><button disabled={busy} className="text-red-700" onClick={async () => { setBusy(true); try { const result = await cancelInvitation(id); setError(result.error || ''); if (!result.error) router.refresh() } catch { setError('Unable to cancel invitation.') } finally { setBusy(false) } }}><T text="Cancel"/></button>{error && <p role="alert">{error}</p>}</div>
}
