'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import QRScanner from '@/components/qr-scanner'
import { T } from '@/components/translation-provider'
import { createClient } from '@/lib/supabase/client'

type Result = { action:string; first_name:string; last_name:string; atechos_id:string; class_name:string; check_in_at:string|null; check_out_at:string|null }
const messages:Record<string,string> = { check_in:'Check-in recorded.',check_out:'Check-out recorded.',duplicate_scan:'Already checked in. Check-out opens at 13:00.',already_complete:'Attendance already complete for today.' }
export default function StudentKiosk() {
 const [code,setCode]=useState(''),[pin,setPin]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Result|null>(null)
 const lock=useRef(false),codeInput=useRef<HTMLInputElement>(null),pinInput=useRef<HTMLInputElement>(null)
 useEffect(()=>{if(!result)return;const timer=setTimeout(()=>setResult(null),10000);return()=>clearTimeout(timer)},[result])
 async function submit(event:FormEvent){event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');setResult(null)
  try {const {data,error:failure}=await createClient().rpc('student_kiosk_scan',{p_code:code.trim(),p_pin:pin});
   if(failure) setError('Unable to record attendance. Please try again.')
   else if(data?.error) setError(data.error==='kiosk_closed'?'Kiosk closed from 08:01 to 12:59. Contact school staff.':data.error==='check_in_required'?'No check-in today. Contact school staff.':data.error==='current_class_required'?'Ask the school to verify your current class.':'ID or PIN not accepted. After five failed attempts, wait 15 minutes.')
   else if(data?.action) {setResult(data as Result);setCode('')}
  } catch {setError('Unable to record attendance. Please try again.')}
  finally {setPin('');setBusy(false);lock.current=false;codeInput.current?.focus()}
 }
 return <main className="min-h-screen bg-slate-950 p-6 text-white"><div className="mx-auto max-w-xl space-y-6"><header className="text-center"><Link href="/onboarding" className="text-blue-300">AtechOS</Link><h1 className="mt-3 text-3xl font-bold"><T text="Attendance Kiosk"/></h1><p className="mt-3"><T text="Scan your badge or enter your AtechOS ID, then enter your PIN."/></p></header>
 <section className="rounded-3xl bg-white p-6 text-slate-900"><QRScanner onRead={value=>{if(lock.current)return;setCode(value.trim());setPin('');setResult(null);setError('');pinInput.current?.focus()}}/>
 <form onSubmit={submit} autoComplete="off" className="mt-4 space-y-4"><label className="block font-semibold">AtechOS ID<input ref={codeInput} autoFocus required maxLength={80} disabled={busy} value={code} onChange={e=>{setCode(e.target.value);setPin('');setResult(null)}} className="mt-2 w-full rounded border p-4 font-mono"/></label>
 <label className="block font-semibold">PIN<input ref={pinInput} required type="password" inputMode="numeric" pattern="[0-9]{6,12}" minLength={6} maxLength={12} autoComplete="off" disabled={busy} value={pin} onChange={e=>setPin(e.target.value)} className="mt-2 w-full rounded border p-4"/></label>
 <button disabled={busy} className="w-full rounded-xl bg-blue-600 p-4 font-bold text-white disabled:opacity-50"><T text={busy?'Checking…':'Confirm check-in / check-out'}/></button></form>
 {error&&<p role="alert" className="mt-4 text-red-700"><T text={error}/></p>}
 {result&&<div role="status" className="mt-5 rounded-xl bg-green-50 p-4"><p className="font-bold"><T text={messages[result.action]||'Attendance already complete for today.'}/></p><p>{result.first_name} {result.last_name} · {result.atechos_id}</p><p>{result.class_name}</p>{result.check_in_at&&<p><T text="Check-in"/>: {new Date(result.check_in_at).toLocaleTimeString()}</p>}{result.check_out_at&&<p><T text="Check-out"/>: {new Date(result.check_out_at).toLocaleTimeString()}</p>}</div>}
 </section><p className="text-sm text-slate-300"><T text="No PIN yet? Ask the school for a private activation code, then create a PIN in the student portal."/> <Link href="/student/login" className="underline"><T text="Student portal"/></Link></p><p className="text-sm text-slate-400"><T text="Haiti time: 00:00–07:45 check-in; 07:46–08:00 late; 08:01–12:59 closed; 13:00–23:59 check-out."/></p></div></main>
}
