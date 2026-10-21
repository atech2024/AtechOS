'use client'
import {useRef,useState} from 'react'
import {createClient} from '@/lib/supabase/client'
import {schoolDateTime} from '@/lib/school-date'
import {gradeEvents,gradeStates} from '@/lib/grade-workflow'
import {T} from '@/components/translation-provider'
type Correction={id:string;state:string;reason:string;proposed:{score:number;max_score:number};created_at:string}
type Entry={id:string;action:string;actor_name:string|null;actor_role:string|null;reason:string|null;created_at:string;old_value:{score?:number;max_score?:number}|null;new_value:{score?:number;max_score?:number}|null}
export default function GradeHistory({gradeId}:{gradeId:string}){
 const [events,setEvents]=useState<Entry[]|null>(null),[error,setError]=useState(false),[busy,setBusy]=useState(false),[corrections,setCorrections]=useState<Correction[]>([])
 const request=useRef(0)
 async function open(){const id=++request.current;setBusy(true);setError(false);try{const result=await createClient().rpc('grade_history',{p_grade:gradeId});if(result.error)throw result.error;if(id===request.current){setEvents(result.data?.events||[]);setCorrections(result.data?.corrections||[])}}catch{if(id===request.current)setError(true)}finally{if(id===request.current)setBusy(false)}}
 return <div><button type="button" disabled={busy} onClick={open} className="text-blue-700 underline disabled:opacity-40"><T text="History"/></button>{error&&<p role="alert" className="text-red-700"><T text="Unable to load grade history."/></p>}{events&&<section aria-label="Grade history" className="min-w-64 rounded-xl border bg-slate-50 p-3"><button type="button" onClick={()=>{request.current++;setEvents(null);setBusy(false)}} className="float-right underline"><T text="Close"/></button><h3 className="font-bold"><T text="Grade history"/></h3>{events.length===0&&<p><T text="No history recorded since workflow activation."/></p>}{corrections.map(c=><p key={c.id} className="my-2 rounded border border-amber-200 p-2"><T text="Correction requested"/>: {c.proposed.score}/{c.proposed.max_score} · <T text={gradeStates[c.state]||c.state}/> · {c.reason}</p>)}{events.map(event=><article key={event.id} className="mt-2 border-t pt-2"><p>{schoolDateTime(event.created_at)} · {event.actor_name||'—'} · {event.actor_role||'—'}</p><p><T text={gradeEvents[event.action]||event.action}/></p>{event.old_value?.score!==undefined&&<p>{event.old_value.score}/{event.old_value.max_score} → {event.new_value?.score??'—'}/{event.new_value?.max_score??'—'}</p>}<p>{event.reason}</p></article>)}</section>}</div>
}
