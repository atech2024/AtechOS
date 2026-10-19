'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Camera, CheckCircle2, ChevronDown, Clock3, Eye, EyeOff, Pause, Play, ScanLine, ShieldCheck } from 'lucide-react'
import { schoolTime,schoolDateTime } from '@/lib/school-date'
import QRScanner from '@/components/qr-scanner'
import { T } from '@/components/translation-provider'
import { createClient } from '@/lib/supabase/client'

type Result = { action:string; first_name:string; last_name:string; class_name:string; check_in_at:string|null; check_out_at:string|null; guard_meeting_required?:boolean; school_release_protocol_active?:boolean; direction_only?:boolean; sanction_action?:string|null; sanction_return_at?:string|null }
type ScanLog = { id:number; result:Result; at:string }
type Notice = { tone:'success'|'warning'|'error'; message:string; firstName?:string; lastName?:string; className?:string; at:string; result?:Result }
const messages:Record<string,string> = { check_in:'Check-in recorded.',check_out:'Check-out recorded.',duplicate_scan:'Already checked in. Check-out opens at 13:00.',already_complete:'Attendance already complete for today.',already_picked_up_by_parent:'This student has already been collected by a parent or authorized adult today.' }
const scanErrors:Record<string,string> = {
 invalid_badge:'Badge not accepted. Ask the school to replace it.', kiosk_closed:'Kiosk closed from 08:01 to 12:59. Contact school staff.', check_in_required:'No check-in today. Contact school staff.', current_class_required:'Ask the school to verify your current class.',
 guard_account_suspended:"Student access is temporarily inactive. Go to the Director's office with your parent or guardian.", guard_three_unexcused_absences:'Access refused: three school-day absences have no accepted reason. Go to the Director with your parent or guardian.', financial_restriction:'Access refused: an overdue school fee still has a balance. Contact the school administration.',
 sanction_kiosk_suspended:'Accès refusé : la sanction enregistrée suspend temporairement l’accès au KIOS. Adressez-vous à la Direction.', sanction_student_suspended:'Accès suspendu par une sanction active. Adressez-vous à la Direction.', sanction_school_departure_pending:'Accès refusé : une décision de la Direction est en attente après une réunion avec la famille.', sanction_parent_meeting:'Accès refusé : la famille doit choisir une date de rendez-vous avec la Direction.', sanction_meeting_required:'Accès refusé : aucun rendez-vous familial n’a été choisi. Contactez la Direction.', sanction_meeting_overdue:'Accès refusé : le rendez-vous familial est passé. Adressez-vous à la Direction.', sanction_meeting_not_today:'Accès refusé : l’élève pourra se présenter à la Direction le jour du rendez-vous choisi.', sanction_meeting_window:'Accès refusé : présentez-vous au KIOS dans les 30 minutes avant ou après l’heure du rendez-vous.', sanction_checkout_not_open:'Sortie non disponible à cette heure. Présentez le badge pendant la plage de sortie indiquée par l’école.',
 }
export default function StudentKiosk() {
 const [code,setCode]=useState(''),[pin,setPin]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState<Notice|null>(null),[log,setLog]=useState<ScanLog[]>([])
 const [scanGuideActive,setScanGuideActive]=useState(false),[scanGuidePaused,setScanGuidePaused]=useState(false),[historyOpen,setHistoryOpen]=useState(true)
 const lock=useRef(false),nextId=useRef(0),codeInput=useRef<HTMLInputElement>(null),pinInput=useRef<HTMLInputElement>(null),scanGuideRef=useRef<HTMLDivElement>(null)
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(null),10000);return()=>clearTimeout(timer)},[notice])
 useEffect(()=>{const guide=scanGuideRef.current;if(!guide)return;let isIntersecting=false;const syncMotion=()=>setScanGuideActive(document.visibilityState==='visible'&&isIntersecting);const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(([entry])=>{isIntersecting=entry.isIntersecting;syncMotion()},{threshold:.1});if(observer)observer.observe(guide);else isIntersecting=true;document.addEventListener('visibilitychange',syncMotion);syncMotion();return()=>{observer?.disconnect();document.removeEventListener('visibilitychange',syncMotion)}},[])
 async function submit(event:FormEvent){event.preventDefault();await record(code.trim(),pin)}
 function announceError(message:string,details?:{first_name?:string;last_name?:string;class_name?:string},tone:'warning'|'error'='warning') {setNotice({tone,message,firstName:details?.first_name,lastName:details?.last_name,className:details?.class_name,at:new Date().toISOString()})}
 async function record(scanned:string,secret='',fromCamera=false){if(lock.current)return;lock.current=true;setBusy(true);setNotice(null)
  try {const {data,error:failure}=await (scanned.startsWith('AOSQ1.')?createClient().rpc('student_kiosk_badge',{p_qr:scanned}):createClient().rpc('student_kiosk_scan',{p_code:scanned,p_pin:secret}));
   if(failure) announceError('Unable to record attendance. Please try again.',undefined,'error')
   else if(data?.error) {const reason=scanErrors[data.error] || 'ID or PIN not accepted. After five failed attempts, wait 15 minutes.';const returnAt=data?.return_at;announceError(reason+(returnAt?` Retour ou réactivation prévu(e) le : ${schoolDateTime(returnAt)}.`:''),data)}
   else if(data?.action) {const result=data as Result,at=new Date().toISOString(),entry={id:++nextId.current,result,at};setLog(current=>[entry,...current].slice(0,50));setNotice({tone:result.direction_only?'warning':'success',message:messages[result.action]||'Attendance already complete for today.',firstName:result.first_name,lastName:result.last_name,className:result.class_name,at,result});setCode('')}
  } catch {announceError('Unable to record attendance. Please try again.',undefined,'error')}
  finally {setPin('');setBusy(false);lock.current=false;if(!fromCamera)codeInput.current?.focus()}
 }
 const noticeTone=notice?.tone==='success'?'border-emerald-200 bg-emerald-50 text-emerald-950':notice?.tone==='warning'?'border-amber-200 bg-amber-50 text-amber-950':'border-rose-200 bg-rose-50 text-rose-950'
 return <main className="kiosk-page min-h-screen px-4 py-5 text-[#081a35] sm:px-6 sm:py-8">
  <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8">
   <header className="kiosk-header flex flex-wrap items-center justify-between gap-4 border-b border-[#dce4ee] pb-4">
    <Link href="/onboarding" aria-label="AtechOS" className="inline-flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#056cd3] focus-visible:ring-offset-2">
     <Image src="/landing/atechos-logo-mark.webp" alt="" width={420} height={372} priority className="h-11 w-12 object-contain mix-blend-multiply"/>
     <Image src="/landing/atechos-logo-wordmark.webp" alt="AtechOS" width={760} height={157} priority className="h-auto w-32 sm:w-36 mix-blend-multiply"/>
    </Link>
    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 shadow-sm"><span className="size-2 rounded-full bg-emerald-500" aria-hidden="true"/><T text="School attendance station"/></div>
   </header>

   <section className="kiosk-intro grid gap-5 border-b border-[#dce4ee] pb-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,34rem)] xl:items-end">
    <div className="min-w-0"><h1 className="max-w-none font-serif text-3xl font-medium leading-tight tracking-[-.035em] sm:text-4xl"><T text="Attendance Kiosk"/></h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#52637a] sm:mt-3 sm:text-base"><T text="Scan your private badge QR without a PIN, or enter your AtechOS ID and PIN."/></p></div>
    <details className="kiosk-schedule group justify-self-start rounded-lg border border-[#dce4ee] bg-white text-sm text-[#35445a] sm:justify-self-end"><summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 font-semibold text-[#253b56] marker:hidden"><Clock3 size={17} className="shrink-0 text-[#056cd3]" aria-hidden="true"/><T text="Haiti schedule"/><ChevronDown size={16} className="ml-1 text-[#64748b] transition-transform group-open:rotate-180" aria-hidden="true"/></summary><p className="max-w-[22rem] px-3 pb-3 text-xs leading-5 text-[#52637a]"><T text="Check-in 00:00–07:45 · Late 07:46–08:00 · Closed 08:01–12:59 · Check-out 13:00–23:59."/></p></details>
   </section>

   <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,.95fr)]">
    <section aria-labelledby="scanner-title" className="rounded-2xl border border-[#dce4ee] bg-white p-4 shadow-[0_8px_28px_rgba(8,26,53,.06)] sm:p-6">
     <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e9f3ff] text-[#056cd3]"><ScanLine size={20} aria-hidden="true"/></span><div><h2 id="scanner-title" className="text-lg font-bold tracking-[-.02em] sm:text-xl"><T text="Scan a student badge"/></h2><p className="mt-1 text-sm leading-5 text-[#52637a]"><T text="The camera stays on until you stop it. Scans appear in the history."/></p></div></div>
     <div ref={scanGuideRef} data-motion-active={scanGuideActive&&!scanGuidePaused} className="kiosk-scan-guide relative isolate mt-4 overflow-hidden rounded-xl border border-[#dce8f5] bg-[#f7faff]" role="img">
      <span className="sr-only"><T text="Illustration: a student badge moves over the scanner, is read, then attendance is confirmed."/></span>
      <svg className="kiosk-scan-demo kiosk-scan-demo-wide absolute inset-0 hidden h-full w-full sm:block" viewBox="0 0 560 180" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
       <defs>
        <linearGradient id="kioskBackdrop" x1="0" y1="0" x2="560" y2="180" gradientUnits="userSpaceOnUse"><stop stopColor="#F7FAFF"/><stop offset=".58" stopColor="#EAF3FF"/><stop offset="1" stopColor="#F5F7FC"/></linearGradient>
        <linearGradient id="kioskCard" x1="0" y1="0" x2="194" y2="112" gradientUnits="userSpaceOnUse"><stop stopColor="white"/><stop offset="1" stopColor="#F4F8FF"/></linearGradient>
        <linearGradient id="kioskHolo" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#42C8FF" stopOpacity="0"/><stop offset=".46" stopColor="#80D8FF" stopOpacity=".16"/><stop offset=".53" stopColor="white" stopOpacity=".9"/><stop offset=".62" stopColor="#F7C850" stopOpacity=".25"/><stop offset="1" stopColor="#42C8FF" stopOpacity="0"/></linearGradient>
        <linearGradient id="kioskBeam" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#0877DB" stopOpacity="0"/><stop offset=".5" stopColor="#0877DB" stopOpacity=".4"/><stop offset="1" stopColor="#0877DB" stopOpacity="0"/></linearGradient>
        <clipPath id="kioskCardClip"><rect x="0" y="0" width="194" height="112" rx="14"/></clipPath>
       </defs>
       <rect width="560" height="180" fill="url(#kioskBackdrop)"/>
       <circle cx="478" cy="20" r="96" fill="#D9E9FF" fillOpacity=".42"/><circle cx="478" cy="20" r="66" stroke="#B9D5F5" strokeOpacity=".45"/><circle cx="478" cy="20" r="39" stroke="#B9D5F5" strokeOpacity=".38"/>
       <path d="M0 145C108 111 172 178 284 143s177-26 276-6" stroke="white" strokeOpacity=".72" strokeWidth="2"/>
       <rect x="310" y="28" width="194" height="112" rx="20" fill="#D9E9FF" fillOpacity=".56" stroke="#A9C9EF" strokeDasharray="5 6"/>
       <path d="M327 45h18M327 45v18M487 45h-18M487 45v18M327 123h18M327 123v-18M487 123h-18M487 123v-18" stroke="#4B92D5" strokeWidth="2" strokeLinecap="round"/>
       <rect className="kiosk-scan-beam" x="311" y="29" width="192" height="110" rx="20" fill="url(#kioskBeam)"/>
       <g transform="translate(46 34)" filter="drop-shadow(0 8px 12px rgba(20,63,110,.15))">
        <g className="kiosk-scan-badge">
        <g clipPath="url(#kioskCardClip)">
         <rect width="194" height="112" rx="14" fill="url(#kioskCard)" stroke="#B7CCE3"/>
         <rect x="0" y="0" width="194" height="8" fill="#0877DB"/>
         <circle cx="42" cy="52" r="24" fill="#E8F2FF"/><circle cx="42" cy="45" r="8" fill="#F3B22B"/><path d="M27 66c2.2-12.5 27.8-12.5 30 0" stroke="#2477C4" strokeWidth="5" strokeLinecap="round"/>
         <text x="78" y="35" fill="#0877DB" fontSize="9" fontWeight="700" letterSpacing="1.2">ATECHOS · ÉCOLE</text><text x="78" y="54" fill="#132B49" fontSize="13" fontWeight="700">BADGE ÉLÈVE</text><path d="M78 66h67M78 76h51" stroke="#AFC2D7" strokeWidth="3" strokeLinecap="round"/><rect x="78" y="88" width="52" height="11" rx="5.5" fill="#E9F3FF"/>
         <path className="kiosk-scan-reflection" d="M-30 0h43l80 112H50z" fill="url(#kioskHolo)"/>
        </g>
        <rect width="194" height="112" rx="14" stroke="#AFC7E2" strokeWidth="1.2"/>
        </g>
       </g>
       <circle className="kiosk-scan-confirm" cx="511" cy="35" r="13" fill="#DCFCEB"/><path d="m505 35 4 4 8-9" stroke="#13834B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
       <path d="M520 121h19M529.5 111.5v19" stroke="white" strokeOpacity=".85" strokeWidth="2" strokeLinecap="round"/>
      </svg>
      <svg className="kiosk-scan-demo kiosk-scan-demo-compact absolute inset-0 block h-full w-full sm:hidden" viewBox="0 0 300 180" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
       <defs>
        <linearGradient id="kioskCompactBackdrop" x1="0" y1="0" x2="300" y2="180" gradientUnits="userSpaceOnUse"><stop stopColor="#F7FAFF"/><stop offset="1" stopColor="#EAF3FF"/></linearGradient>
        <linearGradient id="kioskCompactCard" x1="0" y1="0" x2="142" y2="82" gradientUnits="userSpaceOnUse"><stop stopColor="white"/><stop offset="1" stopColor="#F4F8FF"/></linearGradient>
        <linearGradient id="kioskCompactHolo" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#42C8FF" stopOpacity="0"/><stop offset=".5" stopColor="white" stopOpacity=".9"/><stop offset=".7" stopColor="#F7C850" stopOpacity=".25"/><stop offset="1" stopColor="#42C8FF" stopOpacity="0"/></linearGradient>
        <linearGradient id="kioskCompactBeam" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#0877DB" stopOpacity="0"/><stop offset=".5" stopColor="#0877DB" stopOpacity=".4"/><stop offset="1" stopColor="#0877DB" stopOpacity="0"/></linearGradient>
        <clipPath id="kioskCompactCardClip"><rect width="142" height="82" rx="12"/></clipPath>
       </defs>
       <rect width="300" height="180" fill="url(#kioskCompactBackdrop)"/>
       <circle cx="253" cy="22" r="82" fill="#D9E9FF" fillOpacity=".42"/><circle cx="253" cy="22" r="54" stroke="#B9D5F5" strokeOpacity=".45"/>
       <path d="M0 147c53-24 86 24 145 0s96-18 155-4" stroke="white" strokeOpacity=".72" strokeWidth="2"/>
       <rect x="152" y="49" width="142" height="82" rx="14" fill="#D9E9FF" fillOpacity=".56" stroke="#A9C9EF" strokeDasharray="5 6"/>
       <path d="M164 61h13M164 61v13M282 61h-13M282 61v13M164 119h13M164 119v-13M282 119h-13M282 119v-13" stroke="#4B92D5" strokeWidth="2" strokeLinecap="round"/>
       <rect className="kiosk-scan-beam" x="153" y="50" width="140" height="80" rx="13" fill="url(#kioskCompactBeam)"/>
       <g transform="translate(7 49)" filter="drop-shadow(0 6px 9px rgba(20,63,110,.15))">
        <g className="kiosk-scan-badge">
         <g clipPath="url(#kioskCompactCardClip)">
          <rect width="142" height="82" rx="12" fill="url(#kioskCompactCard)" stroke="#B7CCE3"/><rect width="142" height="6" fill="#0877DB"/>
          <circle cx="31" cy="40" r="19" fill="#E8F2FF"/><circle cx="31" cy="35" r="6.5" fill="#F3B22B"/><path d="M19 52c1.8-10 22.2-10 24 0" stroke="#2477C4" strokeWidth="4" strokeLinecap="round"/>
          <text x="59" y="32" fill="#0877DB" fontSize="7.5" fontWeight="700" letterSpacing=".8">ATECHOS · ÉCOLE</text><text x="59" y="49" fill="#132B49" fontSize="10" fontWeight="700">BADGE ÉLÈVE</text><path d="M59 59h55M59 67h42" stroke="#AFC2D7" strokeWidth="2.5" strokeLinecap="round"/>
          <path className="kiosk-scan-reflection" d="M-22 0h30l62 82H46z" fill="url(#kioskCompactHolo)"/>
         </g>
         <rect width="142" height="82" rx="12" stroke="#AFC7E2" strokeWidth="1.2"/>
        </g>
       </g>
       <circle className="kiosk-scan-confirm" cx="284" cy="57" r="10" fill="#DCFCEB"/><path d="m279 57 3 3 6-7" stroke="#13834B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div className="min-h-40 sm:min-h-44" aria-hidden="true"/>
     </div>
     <div className="mt-2 flex justify-end"><button type="button" aria-pressed={scanGuidePaused} onClick={()=>setScanGuidePaused(value=>!value)} className="kiosk-motion-toggle inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#0757a8] transition-colors hover:bg-[#e9f3ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#056cd3] focus-visible:ring-offset-2"><span aria-hidden="true">{scanGuidePaused?<Play size={16}/>:<Pause size={16}/>}</span><T text={scanGuidePaused?'Resume badge animation':'Pause badge animation'}/></button></div>
          <section aria-labelledby="notice-title" className="rounded-xl border border-[#dce4ee] bg-white p-3 sm:p-4">
           <div className="flex items-center justify-between gap-3"><h2 id="notice-title" className="text-lg font-bold tracking-[-.02em]"><T text="Latest scan notification"/></h2><span className="text-xs text-[#64748b]"><T text="Visible for 10 seconds"/></span></div>
           {notice?<div key={notice.at} role={notice.tone==='error'?'alert':'status'} aria-live={notice.tone==='error'?'assertive':'polite'} className={`kiosk-notice mt-4 rounded-xl border p-4 ${noticeTone}`}>
            <div className="flex items-start gap-3">{notice.tone==='success'?<CheckCircle2 size={21} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true"/>:<AlertTriangle size={21} className="mt-0.5 shrink-0" aria-hidden="true"/>}<div className="min-w-0 flex-1"><p className="font-bold">{notice.firstName?`${notice.firstName} ${notice.lastName||''}`:<T text="Scan not completed"/>}</p>{notice.className&&<p className="mt-0.5 text-sm"><T text="Class"/>: {notice.className}</p>}<p className="mt-2 text-sm font-medium"><T text={notice.message}/></p>{notice.result&&<><p className="mt-1 text-xs"><T text={notice.result.action==='check_out'?'Check-out':'Check-in'}/> · {schoolTime(notice.result.action==='check_out'?notice.result.check_out_at:notice.result.check_in_at)}</p>{notice.result.direction_only&&<p className="mt-2 text-sm font-semibold"><T text="Presence recorded at the Director’s office only. The student may not join class."/></p>}{notice.result.school_release_protocol_active&&notice.result.action==='check_out'&&<p className="mt-2 text-sm font-semibold"><T text="School release protocol active. Check-out recorded."/></p>}{notice.result.sanction_return_at&&<p className="mt-2 text-sm"><T text={notice.result.sanction_action==='student_suspension'||notice.result.sanction_action==='kiosk_suspension'?'Access suspended until':'Director meeting'}/> · {schoolDateTime(notice.result.sanction_return_at)}</p>}{notice.result.guard_meeting_required&&<p className="mt-2 text-sm font-semibold"><T text="Please go to the Director’s office with your parent or guardian for the required meeting."/></p>}</>}</div></div>
           </div>:<div className="mt-4 flex min-h-24 items-center gap-3 rounded-xl bg-[#f5f7fb] px-4 py-3 text-sm text-[#52637a]"><Camera size={19} className="shrink-0 text-[#056cd3]" aria-hidden="true"/><p><T text="Scan a badge to see the student’s name, class and attendance status here."/></p></div>}
          </section>
     <div className="mt-3 rounded-xl bg-[#f5f7fb] p-3 sm:p-4"><QRScanner keepActive onRead={value=>{if(lock.current||value===code)return;if(value.startsWith('AOSQ1.')){void record(value,'',true);return}setCode(value);setPin('');setNotice(null);pinInput.current?.focus()}}/></div>
     <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[.1em] text-[#64748b]"><span className="h-px flex-1 bg-[#dce4ee]"/><T text="Or enter manually"/><span className="h-px flex-1 bg-[#dce4ee]"/></div>
     <form onSubmit={submit} autoComplete="off" className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-semibold text-[#253b56]"><T text="AtechOS ID"/><input ref={codeInput} required maxLength={80} disabled={busy} value={code} onChange={e=>setCode(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-[#cbd6e3] bg-white px-3 py-2 font-mono text-base outline-none transition focus-visible:border-[#056cd3] focus-visible:ring-2 focus-visible:ring-[#056cd3]/20 disabled:bg-slate-100"/></label>
      <label className="block text-sm font-semibold text-[#253b56]"><T text="Personal identification number (PIN)"/><input ref={pinInput} required type="password" inputMode="numeric" pattern="[0-9]{6,12}" minLength={6} maxLength={12} autoComplete="off" disabled={busy||code.startsWith('AOSQ1.')} value={pin} onChange={e=>setPin(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-[#cbd6e3] bg-white px-3 py-2 text-base outline-none transition focus-visible:border-[#056cd3] focus-visible:ring-2 focus-visible:ring-[#056cd3]/20 disabled:bg-slate-100"/></label>
      <button disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#056cd3] px-4 py-3 font-bold text-white shadow-sm transition hover:bg-[#0757a8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#056cd3] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 sm:col-span-2">{busy?<span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true"/>:<ShieldCheck size={18} aria-hidden="true"/>}<T text={busy?'Checking…':'Confirm check-in / check-out'}/></button>
     </form>
     <p className="mt-4 text-xs leading-5 text-[#52637a]"><T text="No PIN yet? Ask the school for a private activation code, then create a PIN in the student portal."/> <Link href="/student/login" className="font-semibold text-[#0757a8] underline decoration-[#8bbcf0] underline-offset-4 hover:text-[#056cd3]"><T text="Student portal"/></Link></p>
    </section>

    <div className="space-y-5">
     <section aria-labelledby="history-title" className="overflow-hidden rounded-2xl border border-[#dce4ee] bg-white shadow-[0_8px_28px_rgba(8,26,53,.06)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
       <div className="min-w-0"><h2 id="history-title" className="text-lg font-bold tracking-[-.02em]"><T text="Scanned students"/></h2><p className="mt-1 text-sm text-[#52637a]"><strong className="tabular-nums">{log.length}</strong> <T text={log.length===1?'scan in this session':'scans in this session'}/></p></div>
       <button type="button" aria-expanded={historyOpen} aria-controls="scan-history-content" onClick={()=>setHistoryOpen(value=>!value)} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-[#cbd6e3] bg-white px-3 text-sm font-semibold text-[#0757a8] transition hover:bg-[#f3f8fe]">
        {historyOpen?<EyeOff size={16} aria-hidden="true"/>:<Eye size={16} aria-hidden="true"/>}<T text={historyOpen?'Hide scan history':'Show scan history'}/>
       </button>
      </div>
      {historyOpen&&<div id="scan-history-content" className="border-t border-[#e7edf4]">
       {log.length===0?<div className="flex min-h-28 flex-col items-center justify-center px-5 py-7 text-center text-[#64748b]"><ScanLine size={24} className="mb-2 text-[#8ba5c2]" aria-hidden="true"/><p className="text-sm font-medium"><T text="No scans yet"/></p><p className="mt-1 text-xs"><T text="Completed scans stay in this list during the session."/></p></div>:<ol className="max-h-[420px] divide-y divide-[#edf1f6] overflow-auto" aria-labelledby="history-title">
        {log.map(({id,result,at})=><li key={id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-5">
         <p className="min-w-0 truncate text-sm font-semibold text-[#081a35]">{result.first_name} {result.last_name}</p>
         <time dateTime={at} className="row-span-2 text-right text-xs tabular-nums text-[#52637a]">{schoolTime(at)}</time>
         <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#52637a]"><span className="truncate">{result.class_name||'—'}</span><span aria-hidden="true">·</span><span className={`inline-flex items-center gap-1 font-semibold ${result.direction_only?'text-amber-800':'text-emerald-800'}`}>{result.action==='check_out'?<ArrowUpFromLine size={13} aria-hidden="true"/>:<ArrowDownToLine size={13} aria-hidden="true"/>}<T text={result.direction_only?'Direction only':result.action==='check_out'?'Check-out':'Check-in'}/></span></div>
        </li>)}
       </ol>}
      </div>}
     </section>
    </div>
   </div>
   <footer className="border-t border-[#dce4ee] pt-4 text-xs leading-5 text-[#52637a]"><p><T text="Attendance is recorded securely by the school. Only a student’s name, class and scan status are shown here."/></p></footer>
  </div>
 </main>
}
