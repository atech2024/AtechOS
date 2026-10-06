'use client'

import {useEffect,useState} from 'react'
import {T} from '@/components/translation-provider'
import {createClient} from '@/lib/supabase/client'

type Child={id:string;first_name:string;last_name:string;atechos_id:string;photo_url?:string|null}
type ChildView=Child & {photo:string;attendance:'present'|'late'|'absent'|'unknown'}

export function childPortraitTone(status:ChildView['attendance']){
 return status==='absent'?'grayscale opacity-70':status==='present'?'saturate-100':'saturate-75'
}

function haitiToday(){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Port-au-Prince',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
 const get=(kind:string)=>parts.find(part=>part.type===kind)?.value||''
 return `${get('year')}-${get('month')}-${get('day')}`
}

export default function FamilyChildrenOverview({students,selectedId,onSelect}:{students:Child[];selectedId:string;onSelect:(id:string)=>void}){
 const [views,setViews]=useState<ChildView[]>([]),[loading,setLoading]=useState(true)
 useEffect(()=>{
  let active=true
  if(!students.length){setViews([]);setLoading(false);return()=>{active=false}}
  setLoading(true)
  void(async()=>{
   const db=createClient(),today=haitiToday()
   const photos=await db.from('students').select('id,photo_url').in('id',students.map(child=>child.id))
   const photoById=new Map<string,string>()
   for(const row of photos.data||[]){
    if(!row.photo_url)continue
    if(/^https?:\/\//i.test(row.photo_url)){photoById.set(row.id,row.photo_url);continue}
    const {data}=await db.storage.from('student-photos').createSignedUrl(row.photo_url,3600)
    if(data?.signedUrl)photoById.set(row.id,data.signedUrl)
   }
   const next=await Promise.all(students.map(async child=>{
    const {data,error}=await db.rpc('family_child_attendance_history',{p_student:child.id,p_from:today,p_to:today,p_limit:50,p_offset:0})
    const records=error?[]:(data?.records||[])
    const statuses=records.map((row:{status:string})=>row.status)
    const attendance:ChildView['attendance']=statuses.includes('late')?'late':statuses.includes('present')?'present':statuses.includes('absent')?'absent':'unknown'
    return {...child,photo:photoById.get(child.id)||'',attendance}
   }))
   if(active){setViews(next);setLoading(false)}
  })()
  return()=>{active=false}
 },[students])
 return <section aria-labelledby="family-children-overview-title" className="mb-5 rounded-2xl border bg-white p-4 sm:p-5">
  <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 id="family-children-overview-title" className="text-lg font-bold text-slate-900"><T text="My children today"/></h2><p className="mt-1 text-sm text-slate-600"><T text="Today's recorded school attendance"/></p></div><p className="text-xs text-slate-600"><T text="Color means present; grayscale means recorded absent."/></p></div>
  {loading?<p className="mt-4 text-sm text-slate-600"><T text="Loading..."/></p>:<ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{views.map(child=>{
   const fullName=`${child.first_name} ${child.last_name}`
   const stateText=child.attendance==='present'?'Present':child.attendance==='late'?'Late':child.attendance==='absent'?'Absent':'No record today'
   return <li key={child.id}><button type="button" onClick={()=>onSelect(child.id)} aria-pressed={selectedId===child.id} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 ${selectedId===child.id?'border-blue-700 bg-blue-50':'border-slate-200 hover:bg-slate-50'}`}>
    {child.photo?<img src={child.photo} alt="" loading="lazy" referrerPolicy="no-referrer" className={`h-14 w-14 shrink-0 rounded-lg object-cover ${childPortraitTone(child.attendance)}`}/>:<span aria-hidden="true" className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-semibold text-slate-700 ${childPortraitTone(child.attendance)}`}>{child.first_name[0]}{child.last_name[0]}</span>}
    <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-900">{fullName}</span><span className="block truncate text-xs text-slate-600">{child.atechos_id}</span><span className="mt-1 block text-xs font-medium"><T text={stateText}/></span></span>
   </button></li>
  })}</ul>}
 </section>
}
