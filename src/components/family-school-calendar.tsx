'use client'

import {useEffect,useMemo,useState} from 'react'
import {CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react'
import {T,useLocale} from '@/components/translation-provider'
import {createClient} from '@/lib/supabase/client'
import {schoolDate} from '@/lib/school-date'

type Attendance={attendance_date:string;status:string;check_in_at:string|null;check_out_at:string|null}
type Event={id:string;day:string;kind:'attendance'|'exam'|'holiday'|'payment'|'badge';attendanceStatus?:'present'|'late'|'absent';title:string;detail?:string}
type CalendarPayload={exams?:{id:string;subject:string;class:string;starts_at:string;ends_at:string;cancelled:boolean}[];official_exam_dates?:{id:string;category:string;section:string;start_date:string;end_date:string;source_name:string}[];closures?:{day:string;title:string}[]}
type Props={studentId:string}
type View='month'|'week'|'day'|'year'

function dateKey(date:Date){return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`}
function haitiDayKey(value:string){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Port-au-Prince',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));const get=(key:string)=>parts.find(part=>part.type===key)?.value||'';return `${get('year')}-${get('month')}-${get('day')}`}
function haitiToday(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Port-au-Prince',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const value=(key:string)=>parts.find(part=>part.type===key)?.value||'';return `${value('year')}-${value('month')}-${value('day')}`}
function rangeFor(anchor:Date,view:View){
 const from=new Date(Date.UTC(anchor.getUTCFullYear(),anchor.getUTCMonth(),anchor.getUTCDate()))
 if(view==='day')return {from:dateKey(from),to:dateKey(from)}
 if(view==='week'){const monday=(from.getUTCDay()+6)%7;from.setUTCDate(from.getUTCDate()-monday);const to=new Date(from);to.setUTCDate(to.getUTCDate()+6);return {from:dateKey(from),to:dateKey(to)}}
 if(view==='year')return {from:`${anchor.getUTCFullYear()}-01-01`,to:`${anchor.getUTCFullYear()}-12-31`}
 return {from:dateKey(new Date(Date.UTC(anchor.getUTCFullYear(),anchor.getUTCMonth(),1))),to:dateKey(new Date(Date.UTC(anchor.getUTCFullYear(),anchor.getUTCMonth()+1,0)))}
}
function statusKind(status:string):Event['kind']|null{return status==='present'||status==='late'||status==='absent'?'attendance':null}
const tones:Record<Event['kind'],string>={attendance:'bg-emerald-600',exam:'bg-violet-600',holiday:'bg-slate-500',payment:'bg-sky-600',badge:'bg-orange-600'}
function markerTone(event:Event){return event.kind==='attendance'?(event.attendanceStatus==='late'?'bg-amber-500':event.attendanceStatus==='absent'?'bg-rose-600':'bg-emerald-600'):tones[event.kind]}
function markerKey(event:Event){return event.kind==='attendance'?`attendance:${event.attendanceStatus||'present'}`:event.kind}

export default function FamilySchoolCalendar({studentId}:Props){
 const locale=useLocale(),[view,setView]=useState<View>('month'),[anchor,setAnchor]=useState(()=>new Date(`${haitiToday()}T12:00:00Z`)),[attendance,setAttendance]=useState<Attendance[]>([]),[school,setSchool]=useState<CalendarPayload|null>(null),[finance,setFinance]=useState<{id:string;paid_at:string;charge_description:string;status:string}[]>([]),[badge,setBadge]=useState<{id:string;action:string;created_at:string;reason:string|null}[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('')
 const range=useMemo(()=>rangeFor(anchor,view),[anchor,view])
 useEffect(()=>{
  let active=true
  if(!studentId)return()=>{active=false}
  setLoading(true);setError('')
  const db=createClient()
  void(async()=>{
   try{
    const first=await db.rpc('family_child_attendance_history',{p_student:studentId,p_from:range.from,p_to:range.to,p_limit:50,p_offset:0})
    if(first.error)throw first.error
    const count=Number(first.data?.total_count||0),pages=Math.ceil(count/50),rest=await Promise.all(Array.from({length:Math.max(0,pages-1)},(_,index)=>db.rpc('family_child_attendance_history',{p_student:studentId,p_from:range.from,p_to:range.to,p_limit:50,p_offset:(index+1)*50})))
    const failed=rest.find(result=>result.error);if(failed?.error)throw failed.error
    const rows=[...(first.data?.records||[]),...rest.flatMap(result=>result.data?.records||[])] as Attendance[]
    const [calendarResult,financeResult,badgeResult]=await Promise.all([db.rpc('school_calendar',{p_student:studentId}),db.rpc('family_finance_workspace',{p_student_id:studentId}),db.rpc('badge_workspace',{p_student:studentId})])
    if(!active)return
    setAttendance(rows)
    if(calendarResult.error){setSchool(null);setError('Impossible de charger les dates scolaires.')}else setSchool(calendarResult.data as CalendarPayload)
    if(financeResult.error)setFinance([]);else{const value=Array.isArray(financeResult.data)?financeResult.data[0]:financeResult.data;setFinance((value?.payments||[]) as typeof finance)}
    if(badgeResult.error)setBadge([]);else setBadge((badgeResult.data?.events||[]) as typeof badge)
   }catch{if(active){setAttendance([]);setSchool(null);setFinance([]);setBadge([]);setError('Impossible de charger le calendrier familial.')}}
   finally{if(active)setLoading(false)}
  })()
  return()=>{active=false}
 },[studentId,range.from,range.to])
 const events=useMemo(()=>{
  const result:Event[]=[]
  for(const item of attendance){const kind=statusKind(item.status);if(kind)result.push({id:`attendance:${item.attendance_date}`,day:item.attendance_date,kind,attendanceStatus:item.status as Event['attendanceStatus'],title:item.status,detail:[item.check_in_at?'Entrée':'',item.check_out_at?'Sortie':''].filter(Boolean).join(' · ')})}
  for(const item of school?.exams||[]){const day=haitiDayKey(item.starts_at);if(!item.cancelled)result.push({id:`exam:${item.id}`,day,kind:'exam',title:item.subject,detail:item.class})}
  for(const item of school?.official_exam_dates||[]){let day=item.start_date;const stop=new Date(`${item.end_date}T12:00:00Z`);for(let i=0;i<90&&day<=item.end_date;i++){result.push({id:`official:${item.id}:${day}`,day,kind:'exam',title:item.category==='exam_period'?'Exam period':'Official exam',detail:item.section});const next=new Date(`${day}T12:00:00Z`);next.setUTCDate(next.getUTCDate()+1);day=dateKey(next);if(next>stop)break}}
  for(const item of school?.closures||[])result.push({id:`closure:${item.day}`,day:item.day,kind:'holiday',title:item.title})
  for(const item of finance)if(item.paid_at)result.push({id:`payment:${item.id}`,day:haitiDayKey(item.paid_at),kind:'payment',title:item.charge_description,detail:item.status})
  for(const item of badge)if(item.created_at)result.push({id:`badge:${item.id}`,day:haitiDayKey(item.created_at),kind:'badge',title:item.action,detail:item.reason||undefined})
  return result.filter(item=>item.day>=range.from&&item.day<=range.to)
 },[attendance,school,finance,badge,range.from,range.to])
 const byDay=useMemo(()=>{const map=new Map<string,Event[]>();for(const event of events)map.set(event.day,[...(map.get(event.day)||[]),event]);return map},[events])
 const year=anchor.getUTCFullYear(),month=anchor.getUTCMonth()
 const days=useMemo(()=>{if(view==='year')return[];const from=new Date(`${range.from}T12:00:00Z`),to=new Date(`${range.to}T12:00:00Z`);if(view==='month'){const weekday=(from.getUTCDay()+6)%7;from.setUTCDate(from.getUTCDate()-weekday);const endWeekday=(to.getUTCDay()+6)%7;to.setUTCDate(to.getUTCDate()+(6-endWeekday))}const result:Date[]=[];for(let day=new Date(from);day<=to;day.setUTCDate(day.getUTCDate()+1))result.push(new Date(day));return result},[range.from,range.to,view])
 function move(direction:number){const next=new Date(anchor);if(view==='year')next.setUTCFullYear(next.getUTCFullYear()+direction);else if(view==='month')next.setUTCMonth(next.getUTCMonth()+direction);else if(view==='week')next.setUTCDate(next.getUTCDate()+direction*7);else next.setUTCDate(next.getUTCDate()+direction);setAnchor(next)}
 const heading=view==='year'?String(year):view==='month'?new Intl.DateTimeFormat(locale==='ht'?'ht-HT':'fr-HT',{month:'long',year:'numeric',timeZone:'UTC'}).format(anchor):`${schoolDate(range.from,locale)}${range.to!==range.from?` – ${schoolDate(range.to,locale)}`:''}`
 return <section aria-labelledby="family-calendar-title" className="my-6 rounded-2xl border bg-white p-4 sm:p-5">
  <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="family-calendar-title" className="flex items-center gap-2 text-xl font-bold"><CalendarDays aria-hidden="true" className="h-5 w-5 text-blue-700"/><T text="Family calendar"/></h2><p className="mt-1 text-sm text-slate-600"><T text="Attendance, exams, school closures and recorded family actions."/></p></div><div className="flex flex-wrap items-center gap-1" aria-label="Calendar view">{(['month','week','day','year'] as const).map(item=><button key={item} type="button" onClick={()=>setView(item)} aria-pressed={view===item} className={`rounded-lg px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 ${view===item?'bg-blue-700 font-semibold text-white':'text-slate-700 hover:bg-slate-100'}`}><T text={item==='month'?'Month':item==='week'?'Week':item==='day'?'Day':'Year'}/></button>)}</div></header>
  <div className="mt-4 flex items-center justify-between gap-3"><button type="button" aria-label="Previous period" onClick={()=>move(-1)} className="rounded-lg border p-2 hover:bg-slate-50"><ChevronLeft className="h-5 w-5"/></button><h3 className="text-center font-semibold capitalize">{heading}</h3><button type="button" aria-label="Next period" onClick={()=>move(1)} className="rounded-lg border p-2 hover:bg-slate-50"><ChevronRight className="h-5 w-5"/></button></div>
  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-y py-3 text-xs">{([{key:'present',tone:'bg-emerald-600',label:'Present'},{key:'late',tone:'bg-amber-500',label:'Late'},{key:'absent',tone:'bg-rose-600',label:'Absent'},{key:'exam',tone:tones.exam,label:'Exam period'},{key:'holiday',tone:tones.holiday,label:'Holiday'},{key:'payment',tone:tones.payment,label:'Payment request'},{key:'badge',tone:tones.badge,label:'Badge action'}] as const).map(item=><span key={item.key} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${item.tone}`}/><T text={item.label}/></span>)}</div>
  {error&&<p role="alert" className="mt-3 text-sm text-amber-800">{error}</p>}
  {loading?<p className="py-6 text-center text-sm text-slate-600"><T text="Loading..."/></p>:view==='year'?<div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{Array.from({length:12},(_,index)=>{const first=new Date(Date.UTC(year,index,1)),last=new Date(Date.UTC(year,index+1,0)),start=dateKey(first),end=dateKey(last),items=events.filter(event=>event.day>=start&&event.day<=end);return <button key={index} type="button" onClick={()=>{setAnchor(first);setView('month')}} className="rounded-xl border p-3 text-left hover:bg-slate-50"><span className="block font-semibold capitalize">{new Intl.DateTimeFormat(locale==='ht'?'ht-HT':'fr-HT',{month:'long',timeZone:'UTC'}).format(first)}</span><span className="mt-2 flex gap-1">{Array.from(new Set(items.map(markerKey))).map(key=><i key={key} aria-hidden="true" className={`h-2 w-2 rounded-full ${markerTone(items.find(item=>markerKey(item)===key)!)}`}/>)}</span><span className="mt-1 block text-xs text-slate-600">{items.length} <T text="events"/></span></button>})}</div>:<div className={`mt-4 grid ${view==='day'?'grid-cols-1':view==='week'?'grid-cols-7':'grid-cols-7'} gap-1`}>
   {view==='month'&&['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day=><span key={day} className="px-1 py-2 text-center text-[10px] font-semibold text-slate-600 sm:text-xs"><T text={day}/></span>)}
   {days.map(day=>{const key=dateKey(day),items=byDay.get(key)||[],currentMonth=day.getUTCMonth()===month;return <button key={key} type="button" onClick={()=>{setAnchor(day);setView('day')}} className={`min-h-16 rounded-lg border p-1 text-left hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 sm:min-h-24 sm:p-2 ${view==='month'&&!currentMonth?'bg-slate-50 text-slate-600':'bg-white text-slate-900'} ${key===haitiToday()?'border-blue-700':''}`}><span className="flex items-center justify-between text-xs font-semibold"><span>{day.getUTCDate()}</span>{items.length>0&&<span className="text-[10px] text-slate-600">{items.length}</span>}</span><span className="mt-1 flex flex-wrap gap-1">{Array.from(new Set(items.map(markerKey))).slice(0,4).map(marker=><i key={marker} aria-hidden="true" className={`h-2 w-2 rounded-full ${markerTone(items.find(item=>markerKey(item)===marker)!)}`}/>)}</span>{view!=='month'&&items.map(item=><span key={item.id} className="mt-1 block truncate text-[10px]">{item.title}</span>)}</button>})}
  </div>}
  {!loading&&view!=='year'&&<ul className="mt-4 divide-y">{events.filter(item=>view==='day'?item.day===dateKey(anchor):true).slice(0,view==='day'?30:12).map(item=><li key={item.id} className="flex gap-3 py-2 text-sm"><span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${markerTone(item)}`}/><span className="min-w-0"><span className="font-medium">{schoolDate(item.day,locale)} · <T text={item.title}/></span>{item.detail&&<span className="block truncate text-xs text-slate-600">{item.detail}</span>}</span></li>)}</ul>}
  {!loading&&!events.length&&<p className="py-5 text-center text-sm text-slate-600"><T text="No events in this period."/></p>}
 </section>
}
