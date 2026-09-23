'use client'
import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { inviteMember } from '@/app/dashboard/staff/actions'

export default function ParentInvite({ studentId }: { studentId: string }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [url, setUrl] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(''); setUrl('')
    const form = new FormData(event.currentTarget)
    try {
      const { data, error } = await createClient().rpc('save_parent_for_student', {
        p_student: studentId, p_name: String(form.get('full_name')), p_email: String(form.get('email')), p_phone: String(form.get('phone') || '')
      })
      if (error) throw error
      const context = await createClient().rpc('school_context')
      if (!context.data?.owner && !context.data?.roles?.some((r: string) => ['school_admin','director'].includes(r))) { setMessage('Parent saved and linked. Ask the director to send the invitation.'); return }
      form.set('parent_id', data); form.set('role', 'parent')
      const result = await inviteMember(form)
      if (result.error) throw new Error(`Parent saved. ${result.error}`)
      setUrl(result.url || '')
      setMessage(result.delivery === 'email' ? 'Invitation sent by email.' : 'Parent linked. Share this private invitation link with this parent only.')
    } catch (error) { setMessage(error instanceof Error ? error.message : String((error as {message?: string})?.message || 'Could not create invitation.')) }
    finally { setBusy(false) }
  }
  return <section className="my-5 rounded-xl border bg-white p-5"><h2 className="text-lg font-semibold">Add / invite parent</h2><p className="my-2 text-sm text-slate-600">The parent will access only their linked children and published bulletins.</p><form onSubmit={submit} className="grid gap-3 md:grid-cols-2"><label>Parent full name<input name="full_name" required className="block w-full rounded border p-3" /></label><label>Email<input name="email" type="email" required className="block w-full rounded border p-3" /></label><label>Phone (optional)<input name="phone" type="tel" className="block w-full rounded border p-3" /></label><button disabled={busy} className="rounded bg-blue-600 p-3 text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save and invite parent'}</button></form>{message && <p role="status" className="mt-3">{message}</p>}{url && <label className="mt-3 block">Private invitation link<input readOnly value={url} onFocus={e => e.target.select()} className="block w-full rounded border p-3" /><button onClick={async () => { try { await navigator.clipboard.writeText(url); setMessage('Link copied.') } catch { setMessage('Select and copy the link above.') } }} className="mt-2 rounded border p-2">Copy link</button></label>}</section>
}
