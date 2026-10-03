'use client'
import {useCallback,useEffect,useState} from 'react'
import {createClient} from '@/lib/supabase/client'
import {schoolDate} from '@/lib/school-date'
import SchoolDateInput from '@/components/school-date-input'
import {useAcademicYear} from '@/components/academic-year-context'
import {T,useLocale} from '@/components/translation-provider'
import {translate} from '@/lib/translations'

type Closure={day:string;title:string}
export default function AttendanceCalendar({canManage}:{canManage:boolean}) {
 const {year}=useAcademicYear()
 const locale=useLocale(),t=(text:string)=>translate(text,locale)
 const [rows,setRows]=useState<Closure[]>([]),[day,setDay]=useState(''),[title,setTitle]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const load=useCallback(async()=>{if(!year){setRows([]);return}const closures=await createClient().from('school_closures').select('day,title').gte('day',year.start_date).lte('day',year.end_date).order('day');if(closures.error)setError(closures.error.message);else setRows(closures.data||[])},[year])
 useEffect(()=>{void load()},[load])
 async function save(date:string,label:string){setBusy(true);setError('');try{const {error}=await createClient().rpc('save_school_closure',{p_day:date,p_title:label});if(error)setError(error.message);else {setDay('');setTitle('');await load()}}catch{setError('Connection interrupted. Please try again.')}finally{setBusy(false)}}
 return <details className="my-6 rounded-xl border bg-white p-5"><summary className="cursor-pointer font-semibold"><T text="School closure calendar"/></summary><p className="my-3"><T text="From 9:00 AM Haiti time, students without recorded attendance are marked absent automatically, Monday to Friday, within the school-year dates. A closure must be confirmed here by an authorized staff member. Suggested holidays do not close the school automatically."/></p>{error&&<p role="alert" className="text-red-700"><T text={error}/></p>}{canManage&&!year&&<p><T text="No current academic year is configured. Set one before adding a closure."/></p>}{canManage&&<form className="my-4 flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();void save(day,title)}}><label><T text="Date"/><SchoolDateInput required disabled={!year} type="date" min={year?.start_date} max={year?.end_date} value={day} onChange={e=>setDay(e.target.value)} className="block rounded border p-2"/></label><label><T text="Reason"/><input required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} className="block rounded border p-2"/></label><button disabled={busy||!year||!day||!title.trim()} className="rounded border p-2"><T text="Confirm closure"/></button></form>}<ul>{rows.map(r=><li key={r.day} className="flex flex-wrap items-center gap-3 border-t py-3"><span>{schoolDate(r.day,locale)} · {r.title}</span>{canManage&&<button disabled={busy} className="text-blue-700 underline" onClick={()=>{if(window.confirm(t('Confirm the school was open on this date?')))void save(r.day,'')}}><T text="Reopen school"/></button>}</li>)}</ul>{!rows.length&&<p><T text="No school closures recorded for this academic year."/></p>}<p className="mt-3 text-sm"><T text="A closure added after 9:00 AM does not remove absences already recorded. Authorized staff must review any needed corrections."/></p></details>
}
