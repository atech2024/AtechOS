'use client'
import {useCallback,useEffect,useState} from 'react'
import {createClient} from '@/lib/supabase/client'
import {schoolDate} from '@/lib/school-date'
import {haitiHolidaySuggestions} from '@/lib/haiti-holidays'
import {T,useLocale} from '@/components/translation-provider'
import {translate} from '@/lib/translations'

type Year={id:string;name:string;start_date:string;end_date:string}
type Closure={day:string;title:string}
export default function HaitiHolidaySuggestions(){
 const locale=useLocale(),t=(text:string)=>translate(text,locale)
 const [year,setYear]=useState<Year|null>(null),[closures,setClosures]=useState<Closure[]>([]),[visible,setVisible]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('')
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
 if(!visible)return null
 const suggestions=year?haitiHolidaySuggestions(year.start_date,year.end_date).filter(h=>!closures.some(c=>c.day===h.date)):[]
 return <section className="my-5 space-y-3 rounded-2xl border bg-white p-5"><h2 className="text-xl font-bold"><T text="Suggested Haiti holidays"/></h2><p className="text-sm text-slate-600"><T text="Suggestions only: school staff must approve each closure. They are not official school-year dates until confirmed by MENFP or the school."/></p><p className="text-xs text-slate-500"><T text="Sources"/>: <a className="text-blue-700 underline" href="https://menfp.gouv.ht/assets/CALENDRIER_SCOLAIRE_2025_2026.pdf" target="_blank" rel="noreferrer">MENFP calendar 2025–2026</a> · <a className="text-blue-700 underline" href="https://www.diplomatie.gouv.fr/fr/information-par-pays/haiti/presentation-d-haiti" target="_blank" rel="noreferrer">France Diplomatie · national holidays</a> · <a className="text-blue-700 underline" href="https://natlex.ilo.org/dyn/natlex2/natlex2/files/download/135/HTI-135.pdf" target="_blank" rel="noreferrer">Haiti Labour Code, Articles 110–111</a></p>{error&&<p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}{message&&<p role="status" className="rounded bg-green-50 p-3 text-green-800"><T text={message}/></p>}{!year?<p><T text="No current academic year is configured."/></p>:!suggestions.length?<p><T text="No unapproved holiday suggestions in this academic year."/></p>:<ul className="divide-y">{suggestions.map(h=><li key={h.date} className="flex flex-wrap items-center justify-between gap-3 py-3"><span><strong>{schoolDate(h.date)}</strong> · <T text={h.name}/></span><button type="button" disabled={Boolean(busy)} onClick={()=>void approve(h.date,h.name)} className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50"><T text="Approve as school closure"/></button></li>)}</ul>}</section>
}
