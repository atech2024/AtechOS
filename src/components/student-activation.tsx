'use client'
import { T } from '@/components/translation-provider'
import {useState} from 'react'
import {createClient} from '@/lib/supabase/client'
export default function StudentActivation({id}:{id:string}) {
 const [code,setCode]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 async function issue(){setBusy(true);setCode('');try{const {data,error}=await createClient().rpc('issue_student_activation',{p_student:id});if(error)setMessage(error.message);else {setCode(data);setMessage('Give this private code to the student. It expires after 2 days and can be used once. Previous PIN and device sessions have been reset.')}}finally{setBusy(false)}}
 return <section className="my-5 rounded border p-4"><h2 className="font-semibold"><T text="Student portal activation"/></h2><p className="my-2"><T text="Creating a new code resets the student’s PIN and signs out their devices."/></p><button disabled={busy} onClick={issue} className="rounded border p-3"><T text="Create / reset activation code"/></button>{message && <p role="status" className="my-3"><T text={message}/></p>}{code && <input aria-label="Private activation code" value={code} readOnly onFocus={e=>e.target.select()} className="w-full rounded border p-3" />}</section>
}
