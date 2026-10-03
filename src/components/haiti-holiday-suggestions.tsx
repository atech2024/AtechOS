'use client'
import {useCallback,useEffect,useRef,useState} from 'react'
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
type StoredCalendar={url:string;source:string;label:string;school_year:string|null;document_kind:'school_calendar'|'exam_calendar';last_seen_at:string;suggested_dates:ExamDateProposal[]}
type DiscoveredCalendar={url:string;source:string;label:string;school_year:string|null;kind:'school_calendar'|'exam_calendar';suggested_dates?:ExamDateProposal[]}
type Discovery={yearId:string;checkedAt:string;candidates:DiscoveredCalendar[];warning:string}
const sourceFields='url,source,label,school_year,document_kind,last_seen_at,suggested_dates'

export async function savedCalendarSourcesForYear(db:ReturnType<typeof createClient>,schoolYear:string){
 const [matching,unassigned]=await Promise.all([
  db.from('official_calendar_sources').select(sourceFields).eq('school_year',schoolYear).order('last_seen_at',{ascending:false}).limit(10),
  db.from('official_calendar_sources').select(sourceFields).is('school_year',null).order('last_seen_at',{ascending:false}).limit(5),
 ])
 return {rows:[...(matching.data||[]),...(unassigned.data||[])].sort((a,b)=>b.last_seen_at.localeCompare(a.last_seen_at)) as StoredCalendar[],error:matching.error||unassigned.error}
}

export function calendarDocumentsForYear(sources:StoredCalendar[],discovery:Discovery|null,yearId:string,schoolYear:string|null){
 if(!schoolYear)return []
 const matchesYear=(item:{school_year:string|null})=>!item.school_year||item.school_year===schoolYear
 const fresh=discovery?.yearId===yearId?discovery.candidates.filter(matchesYear):[]
 return [...new Map<string,StoredCalendar>([
  ...sources.filter(matchesYear).map(item=>[item.url,item] as const),
  ...fresh.map(item=>[item.url,{url:item.url,source:item.source,label:item.label,school_year:item.school_year,document_kind:item.kind,last_seen_at:discovery!.checkedAt,suggested_dates:item.suggested_dates||[]}] as const),
 ]).values()]
}
export default function HaitiHolidaySuggestions(){
 const {yearId}=useAcademicYear()
 const locale=useLocale(),t=(text:string)=>translate(text,locale)
 const [year,setYear]=useState<Year|null>(null),[closures,setClosures]=useState<Closure[]>([]),[sources,setSources]=useState<StoredCalendar[]>([]),[discovery,setDiscovery]=useState<Discovery|null>(null),[visible,setVisible]=useState(false),[busy,setBusy]=useState(''),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[storedSourceWarning,setStoredSourceWarning]=useState('')
 const currentYearId=useRef(yearId),loadVersion=useRef(0)
 currentYearId.current=yearId
 const load=useCallback(async()=>{
  const requestedYearId=yearId,version=++loadVersion.current,isCurrent=()=>currentYearId.current===requestedYearId&&loadVersion.current===version
  const db=createClient(),context=await db.rpc('school_context')
  if(!isCurrent())return
  if(context.error)throw context.error
  const roles:string[]=context.data?.roles||[]
  if(!roles.some(r=>['school_admin','director','secretary','surveillant','censeur'].includes(r))){setVisible(false);return}
  setVisible(true)
  if(!requestedYearId){setYear(null);setClosures([]);setSources([]);return}
  const y=await db.from('academic_years').select('id,name,start_date,end_date').eq('id',requestedYearId).maybeSingle()
  if(!isCurrent())return
  if(y.error)throw y.error
  const selectedYear=y.data
  if(!selectedYear){setYear(null);setClosures([]);setSources([]);return}
  const selectedSchoolYear=`${selectedYear.start_date.slice(0,4)}/${selectedYear.end_date.slice(0,4)}`
  const [c,o]=await Promise.all([db.rpc('school_calendar',{p_student:null}),savedCalendarSourcesForYear(db,selectedSchoolYear)])
  if(!isCurrent())return
  if(c.error)throw c.error
  setYear(selectedYear as Year);setClosures(((c.data?.closures||[]) as Closure[]).filter(item=>item.day>=selectedYear.start_date&&item.day<=selectedYear.end_date))
  if(o.error)setStoredSourceWarning('Automatic official calendar updates are not configured yet.')
  else setStoredSourceWarning('')
  setSources(o.rows)
 },[yearId])
 useEffect(()=>{let active=true;const versionRef=loadVersion;setYear(null);setSources([]);setClosures([]);setDiscovery(null);setStoredSourceWarning('');setRefreshing(false);setError('');load().catch(()=>{if(active)setError('Unable to load holiday suggestions.')});return()=>{active=false;versionRef.current++}},[load])
 async function approve(date:string,name:string){
  if(!window.confirm(`${t(name)} · ${schoolDate(date)}\n\n${t('Add this suggested date as a school closure?')}`))return
  setBusy(date);setError('');setMessage('')
  const {error}=await createClient().rpc('save_school_closure',{p_day:date,p_title:name})
  if(error)setError(error.message)
  else{setMessage('School closure approved and added to the calendar.');await load()}
  setBusy('')
 }
 async function refresh(){
  if(!year||year.id!==yearId)return
  const requestedYearId=yearId,selectedSchoolYear=`${year.start_date.slice(0,4)}/${year.end_date.slice(0,4)}`
  setRefreshing(true);setError('')
  try{const response=await fetch('/api/calendar/official-source',{cache:'no-store'}),data=await response.json();if(currentYearId.current!==requestedYearId)return;if(!response.ok)throw new Error(data.error||'Unable to check official MENFP source.');const candidates=(data.candidates||[]).filter((item:DiscoveredCalendar)=>!item.school_year||item.school_year===selectedSchoolYear);setDiscovery({yearId:requestedYearId,candidates,checkedAt:data.checked_at||new Date().toISOString(),warning:data.warning||''});await load()}
  catch{if(currentYearId.current===requestedYearId)setDiscovery({yearId:requestedYearId,candidates:[],checkedAt:'',warning:'Online calendar sources could not be checked right now. Existing dates remain unchanged; staff must verify any document before approving closures.'})}
  finally{if(currentYearId.current===requestedYearId)setRefreshing(false)}
 }
 if(!visible)return null
 const activeYear=year?.id===yearId?year:null,selectedSchoolYear=activeYear?`${activeYear.start_date.slice(0,4)}/${activeYear.end_date.slice(0,4)}`:null
 const activeDiscovery=discovery?.yearId===yearId?discovery:null
 const checkedAt=activeDiscovery?.checkedAt||'',sourceWarning=activeYear?(activeDiscovery?.warning||storedSourceWarning):''
 const discovered=activeDiscovery?.candidates.filter(item=>!item.school_year||item.school_year===selectedSchoolYear)||[]
 const online=discovered.find(item=>item.school_year===selectedSchoolYear)||discovered[0]||null
 const suggestions=activeYear?haitiHolidaySuggestions(activeYear.start_date,activeYear.end_date).filter(h=>!closures.some(c=>c.day===h.date)):[]
 const calendarDocuments=calendarDocumentsForYear(sources,activeDiscovery,yearId,selectedSchoolYear)
 return <section className="my-5 space-y-3 rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold"><T text="Suggested Haiti holidays and MENFP dates"/></h2><button type="button" disabled={refreshing||!activeYear} onClick={()=>void refresh()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50"><RefreshCw size={16} className={refreshing?'animate-spin':''}/><T text={refreshing?'Checking official sources...':'Refresh online suggestions'}/></button></div><p className="text-sm text-slate-600"><T text="Suggestions only: school staff must approve each closure. They are not official school-year dates until confirmed by MENFP or the school."/></p><p className="text-xs text-slate-500"><T text="Sources"/>: <a className="text-blue-700 underline" href="https://www.menfp.gouv.ht/" target="_blank" rel="noreferrer">MENFP official site</a> · <a className="text-blue-700 underline" href="https://communication.gouv.ht/institution/education/" target="_blank" rel="noreferrer">Haitian Government · Education</a> · <a className="text-blue-700 underline" href="https://www.haitilibre.com/cat-5-education-1.html" target="_blank" rel="noreferrer">HaitiLibre · secondary copies</a> · <a className="text-blue-700 underline" href="https://natlex.ilo.org/dyn/natlex2/natlex2/files/download/135/HTI-135.pdf" target="_blank" rel="noreferrer">Haiti Labour Code</a></p>{checkedAt&&<p role="status" className="text-xs text-slate-500"><T text="Last checked"/>: {schoolDate(checkedAt.slice(0,10))} {new Intl.DateTimeFormat('en-US',{timeZone:'America/Port-au-Prince',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(checkedAt))}</p>}{online&&<p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900"><T text={online.kind==='exam_calendar'?'Official exam calendar found':'Official calendar found'}/>: <a className="font-semibold underline" href={online.url} target="_blank" rel="noreferrer">{online.label}</a>. <T text={online.kind==='exam_calendar'?'Review the official exam periods and dates; staff must confirm them before adding them to the school calendar.':'Review its school breaks, then add confirmed closures above.'}/></p>}{calendarDocuments.length>0&&<div className="rounded-lg border p-3"><h3 className="font-semibold"><T text="Calendar documents detected automatically"/></h3><ul className="divide-y">{calendarDocuments.map(item=><li key={item.url} className="py-2 text-sm"><a className="font-medium text-blue-700 underline" href={item.url} target="_blank" rel="noreferrer">{item.label}</a><span className="block text-xs text-slate-500"><T text={item.document_kind==='exam_calendar'?'Exam schedule / period reference':'School-year calendar reference'}/> · {item.source}{item.school_year?` · ${item.school_year}`:''} · {schoolDate(item.last_seen_at.slice(0,10))}</span>{item.suggested_dates?.length>0&&<div className="mt-2 rounded-lg bg-amber-50 p-3"><p className="font-semibold text-amber-950"><T text="Exam date proposals — staff review required"/></p><ul className="mt-1 list-disc space-y-1 pl-5 text-amber-950">{item.suggested_dates.map((proposal,index)=><li key={`${item.url}-${proposal.date_text}-${index}`}><strong><T text={proposal.category==='official_exam'?'Official exam':'Exam period'}/></strong>: {proposal.start_date&&proposal.end_date?`${schoolDate(proposal.start_date)} – ${schoolDate(proposal.end_date)}`:proposal.date_text}<span className="block text-xs text-amber-900"><T text="Source wording"/>: {proposal.date_text}{proposal.start_date&&proposal.end_date?' · ':''}{proposal.status==='needs_review'&&<T text="Unverified proposal; confirm the source and dates before adding them."/>}</span></li>)}</ul></div>}</li>)}</ul><p className="mt-2 text-xs text-slate-600"><T text="Detected documents and exam dates are references only. Verify each proposal with the source; nothing is added to the school calendar automatically."/></p></div>}{checkedAt&&!online&&!sourceWarning&&<p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><T text="MENFP did not link a school calendar on its official home page during this check. Review the source links above; no dates were inferred."/></p>}{sourceWarning&&<p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><T text={sourceWarning}/></p>}{error&&<p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}{message&&<p role="status" className="rounded bg-green-50 p-3 text-green-800"><T text={message}/></p>}{!activeYear?<p><T text="No current academic year is configured."/></p>:!suggestions.length?<p><T text="No unapproved holiday suggestions in this academic year."/></p>:<ul className="divide-y">{suggestions.map(h=><li key={h.date} className="flex flex-wrap items-center justify-between gap-3 py-3"><span><strong>{schoolDate(h.date)}</strong> · <T text={h.name}/></span><button type="button" disabled={Boolean(busy)} onClick={()=>void approve(h.date,h.name)} className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50"><T text="Approve as school closure"/></button></li>)}</ul>}</section>
}
