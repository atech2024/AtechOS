'use client'

import {useEffect,useState} from 'react'
import {T} from '@/components/translation-provider'
import {createClient} from '@/lib/supabase/client'
import {schoolDateTime} from '@/lib/school-date'
import {useLocale} from '@/components/translation-provider'

type Sanction={id:string;type:string;incident_at:string;reason:string;status:'active'|'resolved';resolved_at:string|null;resolution:string|null;action_code?:string;action_until?:string|null}

export default function FamilyStudentSanctions({studentId}:{studentId:string}){
 const locale=useLocale(),[items,setItems]=useState<Sanction[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(false)
 useEffect(()=>{
  let active=true
  if(!studentId){setItems([]);setLoading(false);return()=>{active=false}}
  setLoading(true);setError(false)
  void createClient().rpc('family_student_sanctions',{p_student_id:studentId}).then(({data,error:requestError})=>{
   if(!active)return
   if(requestError){setItems([]);setError(true)}else setItems((data?.sanctions||[]) as Sanction[])
   setLoading(false)
  })
  return()=>{active=false}
 },[studentId])
 const actionLabel=(code:string|undefined)=>code==='parent_meeting'?'Family meeting requested':code==='kiosk_suspension'?'KIOS access suspended':code==='student_suspension'?'Student access suspended':code==='school_departure'?'School departure recorded':null
 return <section aria-labelledby="family-sanctions-title" className="my-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
  <h2 id="family-sanctions-title" className="text-xl font-bold"><T text="Student follow-up and sanctions"/></h2>
  <p className="mt-1 text-sm text-slate-600"><T text="Sanctions recorded by the school for this child."/></p>
  {loading?<p className="mt-3 text-sm text-slate-600"><T text="Loading..."/></p>:error?<p role="alert" className="mt-3 text-sm text-red-700"><T text="Unable to load this child's follow-up record."/></p>:!items.length?<p className="mt-3 text-sm text-slate-600"><T text="No sanctions recorded for this child."/></p>:<ul className="mt-3 divide-y divide-slate-200">{items.map(item=><li key={item.id} className="py-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{item.type}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status==='resolved'?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-900'}`}><T text={item.status==='resolved'?'Resolved':'Active'}/></span></div><p className="mt-1 text-xs text-slate-600">{schoolDateTime(item.incident_at,locale)}</p><p className="mt-2 whitespace-pre-wrap text-sm">{item.reason}</p>{actionLabel(item.action_code)&&<p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950"><span className="font-medium"><T text="Automatic action"/>:</span> <T text={actionLabel(item.action_code)!}/>{item.action_until&&<> · <T text="Through"/> {schoolDateTime(item.action_until,locale)}</>}</p>}{item.resolution&&<p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm"><span className="font-medium"><T text="Resolution"/>:</span> {item.resolution}</p>}</li>)}</ul>}
 </section>
}
