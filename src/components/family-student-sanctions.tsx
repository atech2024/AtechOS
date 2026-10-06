'use client'

import {useEffect,useState} from 'react'
import {T,useLocale} from '@/components/translation-provider'
import {createClient} from '@/lib/supabase/client'
import {schoolDateTime} from '@/lib/school-date'

type Sanction={id:string;type:string;incident_at:string;reason:string;status:'active'|'resolved';resolved_at:string|null;resolution:string|null;action_code?:string;action_until?:string|null;parent_meeting_deadline?:string|null;parent_meeting_at?:string|null;departure_decision?:'not_applicable'|'pending_meeting'|'retained'|'departed'}
type FamilyData={sanctions:Sanction[];meeting_options:string[]}
export default function FamilyStudentSanctions({studentId}:{studentId:string}){
 const locale=useLocale(),[items,setItems]=useState<Sanction[]>([]),[slots,setSlots]=useState<string[]>([]),[choice,setChoice]=useState<Record<string,string>>({}),[loading,setLoading]=useState(true),[saving,setSaving]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('')
 useEffect(()=>{
  let active=true
  if(!studentId){setItems([]);setLoading(false);return()=>{active=false}}
  setLoading(true);setError('')
  void createClient().rpc('family_student_sanctions',{p_student_id:studentId}).then(({data,error:requestError})=>{
   if(!active)return
   if(requestError){setItems([]);setSlots([]);setError(requestError.message)}else{const result=data as FamilyData;setItems(result?.sanctions||[]);setSlots(result?.meeting_options||[])}
   setLoading(false)
  })
  return()=>{active=false}
 },[studentId])
 async function selectMeeting(id:string){setSaving(id);setError('');setMessage('');const {error:problem}=await createClient().rpc('submit_student_sanction_meeting',{p_sanction:id,p_meeting_at:choice[id]});setSaving('');if(problem){setError(problem.message);return}setMessage('Le rendez-vous a été confirmé. Présentez-vous à la Direction à l’heure choisie.');setItems(current=>current.map(s=>s.id===id?{...s,parent_meeting_at:choice[id]}:s))}
 const actionLabel=(code:string|undefined)=>code==='parent_meeting'?'Rendez-vous avec la famille demandé':code==='kiosk_suspension'?'Accès au KIOS suspendu':code==='student_suspension'?'Accès de l’élève suspendu':code==='school_departure'?'Décision de départ en attente':null
 return <section aria-labelledby="family-sanctions-title" className="my-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
  <h2 id="family-sanctions-title" className="text-xl font-bold"><T text="Student follow-up and sanctions"/></h2><p className="mt-1 text-sm text-slate-600"><T text="Sanctions recorded by the school for this child."/></p>
  {loading?<p className="mt-3 text-sm text-slate-600"><T text="Loading..."/></p>:error?<p role="alert" className="mt-3 text-sm text-red-700"><T text={error}/></p>:!items.length?<p className="mt-3 text-sm text-slate-600"><T text="No sanctions recorded for this child."/></p>:<ul className="mt-3 divide-y divide-slate-200">{items.map(item=><li key={item.id} className="py-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{item.type}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status==='resolved'?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-900'}`}><T text={item.status==='resolved'?'Resolved':'Active'}/></span></div><p className="mt-1 text-xs text-slate-600">{schoolDateTime(item.incident_at,locale)}</p><p className="mt-2 whitespace-pre-wrap text-sm">{item.reason}</p>{actionLabel(item.action_code)&&<p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950"><strong>{actionLabel(item.action_code)}</strong>{item.action_until&&<> · <T text="Through"/> {schoolDateTime(item.action_until,locale)}</>}</p>}
  {item.parent_meeting_deadline&&item.status==='active'&&!item.parent_meeting_at&&(item.action_code==='parent_meeting'||item.action_code==='student_suspension'||item.action_code==='school_departure')&&<div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3"><p className="font-semibold"><T text="Choose a meeting time within the next three school days"/></p><p className="mt-1 text-sm"><T text="Meeting selection deadline"/>: {schoolDateTime(item.parent_meeting_deadline,locale)}</p>{slots.length?<div className="mt-2 flex flex-wrap gap-2"><select aria-label="Meeting time" value={choice[item.id]||''} onChange={e=>setChoice(v=>({...v,[item.id]:e.target.value}))} className="min-w-64 rounded border bg-white px-3 py-2"><option value=""><T text="Choose a school meeting time"/></option>{slots.map(slot=><option key={slot} value={slot}>{schoolDateTime(slot,locale)}</option>)}</select><button disabled={!choice[item.id]||saving===item.id} onClick={()=>void selectMeeting(item.id)} className="rounded bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50"><T text={saving===item.id?'Saving…':'Confirm meeting time'}/></button></div>:<p className="mt-2 text-sm text-red-800"><T text="The school has not configured meeting hours yet. Contact the school office."/></p>}</div>}
  {item.parent_meeting_at&&<p className="mt-2 rounded-lg bg-blue-50 p-3 text-sm"><strong><T text="Meeting scheduled"/>:</strong> {schoolDateTime(item.parent_meeting_at,locale)}. <T text="Please report to the Direction before going to class."/></p>}
  {item.action_code==='school_departure'&&<p className="mt-2 text-sm"><T text={item.departure_decision==='departed'?'The school recorded a permanent departure. Previous school records remain available.':item.departure_decision==='retained'?'The school confirmed that the student remains enrolled.':'The school will confirm its decision after the family meeting.'}/></p>}
  {item.resolution&&<p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm"><span className="font-medium"><T text="Resolution"/>:</span> {item.resolution}</p>}</li>)}</ul>}
  {message&&<p role="status" className="mt-3 rounded bg-green-50 p-3 text-sm text-green-900">{message}</p>}
 </section>
}
