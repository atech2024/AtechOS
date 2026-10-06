'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import {schoolTime,schoolDateTime} from '@/lib/school-date'
import QRScanner from '@/components/qr-scanner'
import { T } from '@/components/translation-provider'
import { createClient } from '@/lib/supabase/client'

type Result = { action:string; first_name:string; last_name:string; class_name:string; check_in_at:string|null; check_out_at:string|null; guard_meeting_required?:boolean; school_release_protocol_active?:boolean; direction_only?:boolean; sanction_action?:string|null; sanction_return_at?:string|null }
const messages:Record<string,string> = { check_in:'Check-in recorded.',check_out:'Check-out recorded.',duplicate_scan:'Already checked in. Check-out opens at 13:00.',already_complete:'Attendance already complete for today.',already_picked_up_by_parent:'This student has already been collected by a parent or authorized adult today.' }
const scanErrors:Record<string,string> = {
 invalid_badge:'Badge not accepted. Ask the school to replace it.',
 kiosk_closed:'Kiosk closed from 08:01 to 12:59. Contact school staff.',
 check_in_required:'No check-in today. Contact school staff.',
 current_class_required:'Ask the school to verify your current class.',
 guard_account_suspended:"Student access is temporarily inactive. Go to the Director's office with your parent or guardian.",
 guard_three_unexcused_absences:'Access refused: three school-day absences have no accepted reason. Go to the Director with your parent or guardian.',
 financial_restriction:'Access refused: an overdue school fee still has a balance. Contact the school administration.',
 sanction_kiosk_suspended:'Accès refusé : la sanction enregistrée suspend temporairement l’accès au KIOS. Adressez-vous à la Direction.',
 sanction_student_suspended:'Accès suspendu par une sanction active. Adressez-vous à la Direction.',\n sanction_school_departure_pending:'Accès refusé : une décision de la Direction est en attente après une réunion avec la famille.',\n sanction_parent_meeting:'Accès refusé : la famille doit choisir une date de rendez-vous avec la Direction.',\n sanction_meeting_required:'Accès refusé : aucun rendez-vous familial n’a été choisi. Contactez la Direction.',\n sanction_meeting_overdue:'Accès refusé : le rendez-vous familial est passé. Adressez-vous à la Direction.',\n sanction_meeting_not_today:'Accès refusé : l’élève pourra se présenter à la Direction le jour du rendez-vous choisi.',\n sanction_meeting_window:'Accès refusé : présentez-vous au KIOS dans les 30 minutes avant ou après l’heure du rendez-vous.',
}
export default function StudentKiosk() {
 const [code,setCode]=useState(''),[pin,setPin]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Result|null>(null)
 const lock=useRef(false),codeInput=useRef<HTMLInputElement>(null),pinInput=useRef<HTMLInputElement>(null)
 useEffect(()=>{if(!result)return;const timer=setTimeout(()=>setResult(null),10000);return()=>clearTimeout(timer)},[result])
 async function submit(event:FormEvent){event.preventDefault();await record(code.trim(),pin)}
 async function record(scanned:string,secret=''){if(lock.current)return;lock.current=true;setBusy(true);setError('');setResult(null)
  try {const {data,error:failure}=await (scanned.startsWith('AOSQ1.')?createClient().rpc('student_kiosk_badge',{p_qr:scanned}):createClient().rpc('student_kiosk_scan',{p_code:scanned,p_pin:secret}));
   if(failure) setError('Unable to record attendance. Please try again.')
   else if(data?.error) {const reason=scanErrors[data.error] || 'ID or PIN not accepted. After five failed attempts, wait 15 minutes.';const returnAt=data?.return_at;setError(reason+(returnAt?` Retour ou réactivation prévu(e) le : ${schoolDateTime(returnAt)}.`:''))}
   else if(data?.action) {setResult(data as Result);setCode('')}
  } catch {setError('Unable to record attendance. Please try again.')}
  finally {setPin('');setBusy(false);lock.current=false;codeInput.current?.focus()}
 }
 return <main className="min-h-screen bg-slate-950 p-6 text-white"><div className="mx-auto max-w-xl space-y-6"><header className="text-center"><Link href="/onboarding" className="text-blue-300">AtechOS</Link><h1 className="mt-3 text-3xl font-bold"><T text="Attendance Kiosk"/></h1><p className="mt-3"><T text="Scan your private badge QR without a PIN, or enter your AtechOS ID and PIN."/></p></header>
 <section className="rounded-3xl bg-white p-6 text-slate-900"><QRScanner onRead={value=>{if(lock.current)return;if(value.trim().startsWith('AOSQ1.')){void record(value.trim());return}setCode(value.trim());setPin('');setResult(null);setError('');pinInput.current?.focus()}}/>
 <form onSubmit={submit} autoComplete="off" className="mt-4 space-y-4"><label className="block font-semibold">AtechOS ID<input ref={codeInput} autoFocus required maxLength={80} disabled={busy} value={code} onChange={e=>{setCode(e.target.value);setPin('');setResult(null)}} className="mt-2 w-full rounded border p-4 font-mono"/></label>
 {!code.startsWith('AOSQ1.')&&<label className="block font-semibold">PIN<input ref={pinInput} required type="password" inputMode="numeric" pattern="[0-9]{6,12}" minLength={6} maxLength={12} autoComplete="off" disabled={busy} value={pin} onChange={e=>setPin(e.target.value)} className="mt-2 w-full rounded border p-4"/></label>}
 <button disabled={busy} className="w-full rounded-xl bg-blue-600 p-4 font-bold text-white disabled:opacity-50"><T text={busy?'Checking…':'Confirm check-in / check-out'}/></button></form>
 {error&&<p role="alert" className="mt-4 text-red-700"><T text={error}/></p>}
 {result&&<div role="status" className={`mt-5 rounded-xl p-4 ${result.direction_only?'bg-amber-50':'bg-green-50'}`}><p className="font-bold"><T text={result.direction_only?'Présence enregistrée à la Direction uniquement. L’élève ne peut pas rejoindre sa classe.':result.action==='check_out'&&result.sanction_action?'Sortie enregistrée. La sanction reste active jusqu’à sa date de fin.':messages[result.action]||'Attendance already complete for today.'}/></p>{result.sanction_return_at&&<p className="mt-2"><T text={result.action==='check_out'?'Accès suspendu jusqu’au':'Rendez-vous avec la Direction'}/> {schoolDateTime(result.sanction_return_at)}.</p>}{result.school_release_protocol_active&&result.action==='check_out'&&<p className="mt-2 font-semibold text-amber-900"><T text="School release protocol active. Check-out recorded."/></p>}<p>{result.first_name} {result.last_name}</p><p>{result.class_name}</p>{result.check_in_at&&<p><T text="Check-in"/>: {schoolTime(result.check_in_at)}</p>}{result.check_out_at&&<p><T text="Check-out"/>: {schoolTime(result.check_out_at)}</p>}{result.guard_meeting_required&&<p className="mt-3 rounded bg-amber-100 p-3 font-semibold text-amber-950"><T text="Please go to the Director's office with your parent or guardian for the required meeting."/></p>}</div>}
 </section><p className="text-sm text-slate-300"><T text="No PIN yet? Ask the school for a private activation code, then create a PIN in the student portal."/> <Link href="/student/login" className="underline"><T text="Student portal"/></Link></p><p className="text-sm text-slate-400"><T text="Haiti time: 00:00–07:45 check-in; 07:46–08:00 late; 08:01–12:59 closed; 13:00–23:59 check-out."/></p></div></main>
}
