'use client'
import {useCallback,useEffect,useState} from 'react'
import {createClient} from '@/lib/supabase/client'
import {schoolDate} from '@/lib/school-date'
import {haitiHolidaySuggestions} from '@/lib/haiti-holidays'
import {T,useLocale} from '@/components/translation-provider'
import {translate} from '@/lib/translations'
import {RefreshCw} from 'lucide-react'
import {useAcademicYear} from '@/components/academic-year-context'

type Year={id:string;name:string;start_date:string;end_date:string}
type Closure={day:string;title:string}
type ExamDateProposal={date_text:string;start_date:string|null;end_date:string|null;category:'exam_period'|'official_exam';context:string;status:'needs_review'}
type OfficialCalendar={url:string;label:string;year:string|null;kind:'school_calendar'|'exam_calendar';suggested_dates?:ExamDateProposal[]}
type StoredCalendar={url:string;source:string;label:string;school_year:string|null;document_kind:'school_calendar'|'exam_calendar';last_seen_at:string;suggested_dates:ExamDateProposal[]}
type DiscoveredCalendar={url:string;source:string;label:string;school_year:string|null;kind:'school_calendar'|'exam_calendar';suggested_dates?:ExamDateProposal[]}
export default function HaitiHolidaySuggestions(){
 const {yearId}=useAcademicYear()
 const locale=useLocale(),t=(text:string)=>translate(text,locale)
 const [year,setYear]=useState<Year|null>(null),[closures,setClosures]=useState<Closure[]>([]),[sources,setSources]=useState<StoredCalendar[]>([]),[discovered,setDiscovered]=useState<DiscoveredCalendar[]>([]),[visible,setVisible]=useState(false),[busy,setBusy]=useState(''),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[online,setOnline]=useState<OfficialCalendar|null>(null),[checkedAt,setCheckedAt]=useState(''),[sourceWarning,setSourceWarning]=useState('')
 const load=useCallback(async()=>{
  const db=createClient(),context=await db.rpc('school_context')
  if(context.error)throw context.error
  const roles:string[]=context.data?.roles||[]
  if(!roles.some(r=>['school_admin','director','secretary','surveillant','censeur'].includes(r))){setVisible(false);return}
  setVisible(true)
  if(!yearId){setYear(null);setClosures([]);return}
  const [y,c,o]=await Promise.all([db.from('academic_years').select('id,name,start_date,end_date').eq('id',yearId).maybeSingle(),db.rpc('school_calendar',{p_student:null}),db.from('official_calendar_sources').select('url,source,label,school_year,document_kind,last_seen_at,suggested_dates').order('last_seen_at',{ascending:false}).limit(10)])
  if(y.error||c.error)throw y.error||c.error
  const selectedYear=y.data
  if(!selectedYear){setYear(null);setClosures([]);return}
  setYear(selectedYear as Year);setClosures(((c.data?.closures||[]) as Closure[]).filter(item=>item.day>=selectedYear.start_date&&item.day<=selectedYear.end_date))
  if(o.error)setSourceWarning('Automatic official calendar updates are not configured yet.')
  else setSources((o.data||[]) as StoredCalendar[])
 },[yearId])
 useEffect(()=>{let active=true;load().catch(()=>{if(active)setError('Unable to load holiday suggestions.')});return()=>{active=false}},[load])
 async function approve(date:string,name:string){
  if(!window.confirm(`${t(name)} · ${schoolDate(date)}\n\n${t('Add this suggested date as a school closure?')}`))return
  setBusy(date);setError('');setMessage('')
  const {error}=await createClient().rpc('save_school_closure',{p_day:date,p_title:name})
  if(error)setError(error.message)
  else{setMessage('School closure approved and added to the calendar.');await load()}
  setBusy('')
 }
 async function refresh(){
  setRefreshing(true);setSourceWarning('');setError('')
  try{const response=await fetch('/api/calendar/official-source',{cache:'no-store'}),data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to check official MENFP source.');setOnline(data.latest_calendar||null);setDiscovered(data.candidates||[]);setCheckedAt(data.checked_at||new Date().toISOString());setSourceWarning(data.warning||'');await load()}
  catch{setSourceWarning('Online calendar sources could not be checked right now. Existing dates remain unchanged; staff must verify any document before approving closures.')}
  finally{setRefreshing(false)}
 }
 if(!visible)return null
 const suggestions=year?haitiHolidaySuggestions(year.start_date,year.end_date).filter(h=>!closures.some(c=>c.day===h.date)):[]
 const calendarDocuments=[...new Map([...discovered.map(item=>({url:item.url,source:item.source,label:item.label,school_year:item.school_year,document_kind:item.kind,last_seen_at:checkedAt||new Date().toISOString(),suggested_dates:item.suggested_dates||[]})),...sources].map(item=>[item.url,item])).values()]
 return <section className="my-5 space-y-3 rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold"><T text="Suggested Haiti holidays and MENFP dates"/></h2><button type="button" disabled={refreshing} onClick={()=>void refresh()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50"><RefreshCw size={16} className={refreshing?'animate-spin':''}/><T text={refreshing?'Checking official sources...':'Refresh online suggestions'}/></button></div><p className="text-sm text-slate-600"><T text="Suggestions only: school staff must approve each closure. They are not official school-year dates until confirmed by MENFP or the school."/></p><p className="text-xs text-slate-500"><T text="Sources"/>: <a className="text-blue-700 underline" href="https://www.menfp.gouv.ht/" target="_blank" rel="noreferrer">MENFP official site</a> · <a className="text-blue-700 underline" href="https://communication.gouv.ht/institution/education/" target="_blank" rel="noreferrer">Haitian Government · Education</a> · <a className="text-blue-700 underline" href="https://www.haitilibre.com/cat-5-education-1.html" target="_blank" rel="noreferrer">HaitiLibre · secondary copies</a> · <a className="text-blue-700 underline" href="https://natlex.ilo.org/dyn/natlex2/natlex2/files/download/135/HTI-135.pdf" target="_blank" rel="noreferrer">Haiti Labour Code</a></p>{checkedAt&&<p role="status" className="text-xs text-slate-500"><T text="Last checked"/>: {schoolDate(checkedAt.slice(0,10))} {new Intl.DateTimeFormat('en-US',{timeZone:'America/Port-au-Prince',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(checkedAt))}</p>}{online&&<p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900"><T text={online.kind==='exam_calendar'?'Official exam calendar found':'Official calendar found'}/>: <a className="font-semibold underline" href={online.url} target="_blank" rel="noreferrer">{online.label}</a>. <T text={online.kind==='exam_calendar'?'Review the official exam periods and dates; staff must confirm them before adding them to the school calendar.':'Review its school breaks, then add confirmed closures above.'}/></p>}{calendarDocuments.length>0&&<div className="rounded-lg border p-3"><h3 className="font-semibold"><T text="Calendar documents detected automatically"/></h3><ul className="divide-y">{calendarDocuments.map(item=><li key={item.url} className="py-2 text-sm"><a className="font-medium text-blue-700 underline" href={item.url} target="_blank" rel="noreferrer">{item.label}</a><span className="block text-xs text-slate-500"><T text={item.document_kind==='exam_calendar'?'Exam schedule / period reference':'School-year calendar reference'}/> · {item.source}{item.school_year?` · ${item.school_year}`:''} · {schoolDate(item.last_seen_at.slice(0,10))}</span>{item.suggested_dates?.length>0&&<div className="mt-2 rounded-lg bg-amber-50 p-3"><p className="font-semibold text-amber-950"><T text="Exam date proposals — staff review required"/></p><ul className="mt-1 list-disc space-y-1 pl-5 text-amber-950">{item.suggested_dates.map((proposal,index)=><li key={`${item.url}-${proposal.date_text}-${index}`}><strong><T text={proposal.category==='official_exam'?'Official exam':'Exam period'}/></strong>: {proposal.start_date&&proposal.end_date?`${schoolDate(proposal.start_date)} – ${schoolDate(proposal.end_date)}`:proposal.date_text}<span className="block text-xs text-amber-900"><T text="Source wording"/>: {proposal.date_text}{proposal.start_date&&proposal.end_date?' · ':''}{proposal.status==='needs_review'&&<T text="Unverified proposal; confirm the source and dates before adding them."/>}</span></li>)}</ul></div>}</li>)}</ul><p className="mt-2 text-xs text-slate-600"><T text="Detected documents and exam dates are references only. Verify each proposal with the source; nothing is added to the school calendar automatically."/></p></div>}{checkedAt&&!online&&!sourceWarning&&<p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><T text="MENFP did not link a school calendar on its official home page during this check. Review the source links above; no dates were inferred."/></p>}{sourceWarning&&<p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><T text={sourceWarning}/></p>}{error&&<p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}{message&&<p role="status" className="rounded bg-green-50 p-3 text-green-800"><T text={message}/></p>}{!year?<p><T text="No current academic year is configured."/></p>:!suggestions.length?<p><T text="No unapproved holiday suggestions in this academic year."/></p>:<ul className="divide-y">{suggestions.map(h=><li key={h.date} className="flex flex-wrap items-center justify-between gap-3 py-3"><span><strong>{schoolDate(h.date)}</strong> · <T text={h.name}/></span><button type="button" disabled={Boolean(busy)} onClick={()=>void approve(h.date,h.name)} className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50"><T text="Approve as school closure"/></button></li>)}</ul>}</section>
}
