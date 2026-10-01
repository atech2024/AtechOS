'use client'
import {useCallback,useEffect,useState} from 'react'
import {createClient} from '@/lib/supabase/client'
import {schoolDate} from '@/lib/school-date'
import {haitiHolidaySuggestions} from '@/lib/haiti-holidays'
import {T,useLocale} from '@/components/translation-provider'
import {translate} from '@/lib/translations'
import {RefreshCw} from 'lucide-react'

type Year={id:string;name:string;start_date:string;end_date:string}
type Closure={day:string;title:string}
type OfficialCalendar={url:string;label:string;year:string|null}
export default function HaitiHolidaySuggestions(){
 const locale=useLocale(),t=(text:string)=>translate(text,locale)
 const [year,setYear]=useState<Year|null>(null),[closures,setClosures]=useState<Closure[]>([]),[visible,setVisible]=useState(false),[busy,setBusy]=useState(''),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[online,setOnline]=useState<OfficialCalendar|null>(null),[checkedAt,setCheckedAt]=useState(''),[sourceWarning,setSourceWarning]=useState('')
 const load=useCallback(async()=>{
  const db=createClient(),context=await db.rpc('school_context')
  if(context.error)throw context.error
  const roles:string[]=context.data?.roles||[]
  if(!roles.some(r=>['school_admin','director','secretary','surveillant','censeur'].includes(r))){setVisible(false);return}
  setVisible(true)
  const [y,c]=await Promise.all([db.from('academic_years').select('id,name,start_date,end_date').eq('is_current',true).maybeSingle(),db.rpc('school_calendar',{p_student:null})])
  if(y.error||c.error)throw y.error||c.error
  setYear(y.data as Year|null);setClosures((c.data?.closures||[]) as Closure[])
 },[])
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
  try{const response=await fetch('/api/calendar/official-source',{cache:'no-store'}),data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to check official MENFP source.');setOnline(data.latest_calendar||null);setCheckedAt(data.checked_at||new Date().toISOString());setSourceWarning(data.warning||'');await load()}
  catch{setSourceWarning('The official MENFP page could not be checked right now. The current statutory suggestions remain available for staff review.')}
  finally{setRefreshing(false)}
 }
 if(!visible)return null
 const suggestions=year?haitiHolidaySuggestions(year.start_date,year.end_date).filter(h=>!closures.some(c=>c.day===h.date)):[]
 return <section className="my-5 space-y-3 rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold"><T text="Suggested Haiti holidays and MENFP dates"/></h2><button type="button" disabled={refreshing} onClick={()=>void refresh()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50"><RefreshCw size={16} className={refreshing?'animate-spin':''}/><T text={refreshing?'Checking official sources...':'Refresh online suggestions'}/></button></div><p className="text-sm text-slate-600"><T text="Suggestions only: school staff must approve each closure. They are not official school-year dates until confirmed by MENFP or the school."/></p><p className="text-xs text-slate-500"><T text="Sources"/>: <a className="text-blue-700 underline" href="https://www.menfp.gouv.ht/" target="_blank" rel="noreferrer">MENFP official site</a> · <a className="text-blue-700 underline" href="https://menfp.gouv.ht/assets/CALENDRIER_SCOLAIRE_2025_2026.pdf" target="_blank" rel="noreferrer">MENFP calendar 2025–2026</a> · <a className="text-blue-700 underline" href="https://communication.gouv.ht/dates/fete-de-lindependance/" target="_blank" rel="noreferrer">Haitian Government · national dates</a> · <a className="text-blue-700 underline" href="https://natlex.ilo.org/dyn/natlex2/natlex2/files/download/135/HTI-135.pdf" target="_blank" rel="noreferrer">Haiti Labour Code</a></p>{checkedAt&&<p role="status" className="text-xs text-slate-500"><T text="Last checked"/>: {schoolDate(checkedAt.slice(0,10))} {new Intl.DateTimeFormat('en-US',{timeZone:'America/Port-au-Prince',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(checkedAt))}</p>}{online&&<p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900"><T text="Official calendar found"/>: <a className="font-semibold underline" href={online.url} target="_blank" rel="noreferrer">{online.label}</a>. <T text="Review its school breaks, then add confirmed closures above."/></p>}{checkedAt&&!online&&!sourceWarning&&<p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><T text="MENFP did not link a school calendar on its official home page during this check. Review the source links above; no dates were inferred."/></p>}{sourceWarning&&<p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><T text={sourceWarning}/></p>}{error&&<p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}{message&&<p role="status" className="rounded bg-green-50 p-3 text-green-800"><T text={message}/></p>}{!year?<p><T text="No current academic year is configured."/></p>:!suggestions.length?<p><T text="No unapproved holiday suggestions in this academic year."/></p>:<ul className="divide-y">{suggestions.map(h=><li key={h.date} className="flex flex-wrap items-center justify-between gap-3 py-3"><span><strong>{schoolDate(h.date)}</strong> · <T text={h.name}/></span><button type="button" disabled={Boolean(busy)} onClick={()=>void approve(h.date,h.name)} className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50"><T text="Approve as school closure"/></button></li>)}</ul>}</section>
}
