'use client'
import { T } from '@/components/translation-provider'
import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
export default function TeacherRequest() {
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 async function submit(e:FormEvent<HTMLFormElement>) {e.preventDefault();setBusy(true);const code=String(new FormData(e.currentTarget).get('code')||'');try {const {error}=await createClient().rpc('request_teacher_access',{p_school_code:code});setMessage(error?.message || 'Request sent. Your school must approve access.')}finally{setBusy(false)}}
 return <section className="rounded-xl border p-5"><h2 className="text-xl font-semibold"><T text="Teacher — request school access"/></h2><form onSubmit={submit} className="my-3 flex flex-wrap gap-3"><label><T text="School code"/><input required name="code" className="ml-2 rounded border p-3" /></label><button disabled={busy} className="rounded bg-blue-600 p-3 text-white"><T text="Request access"/></button></form>{message && <p role="status"><T text={message}/></p>}</section>
}
