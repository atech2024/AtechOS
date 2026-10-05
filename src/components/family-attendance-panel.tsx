'use client'

import {useEffect,useState,type FormEvent} from 'react'
import {T,useLocale} from '@/components/translation-provider'
import {createClient} from '@/lib/supabase/client'
import {schoolDate,schoolTime} from '@/lib/school-date'

type AttendanceRecord={attendance_date:string;status:string;late_minutes:number|null;check_in_at:string|null;check_out_at:string|null}
type AttendanceHistory={records:AttendanceRecord[];total_count:number;summary:{present:number;late:number;absent:number}}
const PAGE_SIZE=30

function haitiToday(){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Port-au-Prince',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
 const part=(type:string)=>parts.find(item=>item.type===type)?.value||''
 return `${part('year')}-${part('month')}-${part('day')}`
}
function defaultRange(){
 const to=haitiToday(),day=new Date(`${to}T12:00:00Z`)
 day.setUTCDate(day.getUTCDate()-29)
 return {from:day.toISOString().slice(0,10),to}
}

export default function FamilyAttendancePanel({studentId}:{studentId:string}){
 const locale=useLocale()
 const [range,setRange]=useState<{from:string;to:string}|null>(null)
 const [draft,setDraft]=useState({from:'',to:''})
 const [offset,setOffset]=useState(0)
 const [history,setHistory]=useState<AttendanceHistory>({records:[],total_count:0,summary:{present:0,late:0,absent:0}})
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')

 useEffect(()=>{const initial=defaultRange();setRange(initial);setDraft(initial)},[])
 useEffect(()=>{
  let active=true
  if(!range||!studentId)return
  setLoading(true);setError('')
  createClient().rpc('family_child_attendance_history',{p_student:studentId,p_from:range.from,p_to:range.to,p_limit:PAGE_SIZE,p_offset:offset}).then(({data,error})=>{
   if(!active)return
   if(error){setError('Impossible de charger l’historique des présences.');setHistory({records:[],total_count:0,summary:{present:0,late:0,absent:0}})}
   else setHistory({records:data?.records||[],total_count:Number(data?.total_count||0),summary:{present:Number(data?.summary?.present||0),late:Number(data?.summary?.late||0),absent:Number(data?.summary?.absent||0)}})
   setLoading(false)
  })
  return()=>{active=false}
 },[studentId,range,offset])

 function applyRange(event:FormEvent<HTMLFormElement>){
  event.preventDefault()
  const first=new Date(`${draft.from}T12:00:00Z`),last=new Date(`${draft.to}T12:00:00Z`)
  if(!draft.from||!draft.to||!Number.isFinite(first.getTime())||!Number.isFinite(last.getTime())||draft.to<draft.from){setError('Choisissez une période valide.');return}
  if((last.getTime()-first.getTime())/86400000>365){setError('La période ne peut pas dépasser 366 jours.');return}
  setOffset(0);setRange({...draft})
 }

 const chart=history.records.slice(0,7).reverse()
 const previousDisabled=offset===0||loading
 const nextDisabled=loading||offset+PAGE_SIZE>=history.total_count
 return <section aria-labelledby="family-attendance-title" className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
  <div className="flex flex-wrap items-start justify-between gap-2">
   <div><h2 id="family-attendance-title" className="text-xl font-bold"><T text="Attendance history"/></h2><p className="mt-1 text-sm text-slate-600"><T text="Review daily attendance, late arrivals, absences and check-in/check-out times."/></p></div>
   {history.records[0]&&<p className="text-sm"><T text="Most recent day"/> · {schoolDate(history.records[0].attendance_date,locale)}</p>}
  </div>
  <form onSubmit={applyRange} className="mt-4 flex flex-wrap items-end gap-3 print:hidden">
   <label className="text-sm"><T text="Date from"/><input aria-label="Date from" type="date" required value={draft.from} onChange={e=>setDraft(value=>({...value,from:e.target.value}))} className="mt-1 block rounded-lg border px-3 py-2"/></label>
   <label className="text-sm"><T text="Date to"/><input aria-label="Date to" type="date" required value={draft.to} onChange={e=>setDraft(value=>({...value,to:e.target.value}))} className="mt-1 block rounded-lg border px-3 py-2"/></label>
   <button type="submit" disabled={loading||!range} className="rounded-lg bg-blue-700 px-4 py-2 font-medium text-white disabled:opacity-60"><T text="Apply dates"/></button>
  </form>
  {error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  {loading?<p className="mt-4 text-sm text-slate-600"><T text="Loading..."/></p>:history.total_count===0?<p className="mt-4 text-sm text-slate-600"><T text="No attendance in this date range."/></p>:<>
   <div className="mt-4 grid grid-cols-3 gap-2 text-center">
    <div className="rounded-xl bg-emerald-50 p-3"><p className="text-2xl font-bold">{history.summary.present}</p><p className="text-xs"><T text="Present"/></p></div>
    <div className="rounded-xl bg-amber-50 p-3"><p className="text-2xl font-bold">{history.summary.late}</p><p className="text-xs"><T text="Late"/></p></div>
    <div className="rounded-xl bg-rose-50 p-3"><p className="text-2xl font-bold">{history.summary.absent}</p><p className="text-xs"><T text="Absent"/></p></div>
   </div>
   <div className="mt-5 flex min-h-32 items-end justify-center gap-3 overflow-x-auto" role="img" aria-label="Attendance chart for the latest school days">
    {chart.map(record=>{const color=record.status==='present'?'bg-emerald-500':record.status==='late'?'bg-amber-500':record.status==='absent'?'bg-rose-500':'bg-slate-400';const label=record.status==='present'?'P':record.status==='late'?'R':record.status==='absent'?'A':'—';return <div key={record.attendance_date} className="flex w-12 shrink-0 flex-col items-center gap-1"><span className="text-[10px] text-slate-600">{label}</span><div className={`w-full rounded-t ${color}`} style={{height:record.status==='present'||record.status==='late'?'4rem':'2rem'}}/><span className="text-[10px] text-slate-600">{schoolDate(record.attendance_date,locale).split(' ')[0]}</span></div>})}
   </div>
   <ul className="mt-4 divide-y">{history.records.map(record=><li key={record.attendance_date} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span>{schoolDate(record.attendance_date,locale)} · <T text={record.status==='present'?'Present':record.status==='late'?'Late':record.status==='absent'?'Absent':record.status}/></span><span className="text-slate-600"><T text="Check-in"/> {schoolTime(record.check_in_at)} · <T text="Check-out"/> {schoolTime(record.check_out_at)}</span></li>)}</ul>
   <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
    <span><T text="Showing"/> {offset+1}–{Math.min(offset+history.records.length,history.total_count)} / {history.total_count}</span>
    <div className="flex gap-2"><button type="button" disabled={previousDisabled} onClick={()=>setOffset(value=>Math.max(0,value-PAGE_SIZE))} className="rounded border px-3 py-2 disabled:opacity-50"><T text="Previous"/></button><button type="button" disabled={nextDisabled} onClick={()=>setOffset(value=>value+PAGE_SIZE)} className="rounded border px-3 py-2 disabled:opacity-50"><T text="Next"/></button></div>
   </div>
  </>}
 </section>
}
