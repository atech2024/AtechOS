'use client'
import {useEffect,useState} from 'react'
import {createClient} from '@/lib/supabase/client'
import {schoolDateTime} from '@/lib/school-date'
import {T} from '@/components/translation-provider'
type Change={id:string;actor_name:string;actor_role:string;changed_at:string;entity:string;fields:string[]}
const fields:Record<string,string>={first_name:'First name',last_name:'Last name',date_of_birth:'Date of birth',place_of_birth:'Place of birth',sex:'Sex',address:'Address',photo_url:'Photo',class_id:'Class',active:'Status',status:'Status',school_status:'Status',departure_year_id:'Academic year',nis:'NISU',student_code:'School code',notes:'Notes',portal_enabled:'Student portal'}
export default function StudentChanges({changes}:{changes:Change[]}){
 return <details className="my-5 rounded-xl border bg-white p-4 print:hidden"><summary className="cursor-pointer font-semibold"><T text="Student record changes"/></summary>{changes.map(c=><article key={c.id} className="my-3 border-t pt-3"><p className="font-semibold">{c.actor_name} · <T text={c.actor_role}/></p><p>{schoolDateTime(c.changed_at)}</p><p>{Array.from(new Set(c.fields.map(f=>fields[f]||'Student record'))).map((f,i)=><span key={f}>{i?', ':''}<T text={f}/></span>)}</p></article>)}{!changes.length&&<p className="mt-3"><T text="No changes recorded since this history was enabled."/></p>}</details>
}
export function StudentChangePanel({studentId}:{studentId:string}){
 const [changes,setChanges]=useState<Change[]>([]),[error,setError]=useState('')
 useEffect(()=>{let current=true;setChanges([]);setError('');createClient().rpc('student_change_history',{p_student:studentId}).then(({data,error})=>{if(!current)return;if(error)setError(error.message);else setChanges(data||[])});return()=>{current=false}},[studentId])
 return error?<p role="alert">{error}</p>:<StudentChanges changes={changes}/>
}
