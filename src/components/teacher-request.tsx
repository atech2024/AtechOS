'use client'
import { T } from '@/components/translation-provider'
import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
export default function TeacherRequest() {
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 async function submit(e:FormEvent<HTMLFormElement>) {
  e.preventDefault()
  setBusy(true)
  const code=String(new FormData(e.currentTarget).get('code')||'').trim()
  try {
   const {error}=await createClient().rpc('request_teacher_access',{p_school_code:code})
   setMessage(error ? 'We could not send your request. Check the code and try again.' : 'Request sent. Your school must approve access.')
  } catch {
   setMessage('We could not send your request. Check the code and try again.')
  } finally { setBusy(false) }
 }
 return <section aria-labelledby="teacher-request-description" className="mt-4">
  <p id="teacher-request-description" className="text-sm leading-6 text-slate-600"><T text="Use the school code shared by your administration to request access. The school will confirm your request."/></p>
  <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
   <label className="block text-sm font-medium text-slate-700"><T text="School code"/><input required name="code" autoComplete="off" className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>
   <button disabled={busy} className="min-h-11 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-wait disabled:opacity-60"><T text={busy ? 'Sending request…' : 'Request access'}/></button>
  </form>
  {message && <p role={message.startsWith('Request sent') ? 'status' : 'alert'} aria-live="polite" className={'mt-3 rounded-lg px-3 py-2 text-sm '+(message.startsWith('Request sent')?'bg-emerald-50 text-emerald-800':'bg-red-50 text-red-800')}><T text={message}/></p>}
 </section>
}
