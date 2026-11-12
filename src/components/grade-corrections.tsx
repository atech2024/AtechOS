'use client'
import {useEffect,useState} from 'react'
import {createClient} from '@/lib/supabase/client'
import {T,useLocale} from '@/components/translation-provider'
import {translate} from '@/lib/translations'
import {gradeError} from '@/lib/grade-workflow'
import {schoolDateTime} from '@/lib/school-date'
type Correction={id:string;student:string;subject:string;class:string;teacher:string;score:number;max_score:number;proposed:{score:number;max_score:number;note:string|null};reason:string;state:string;created_at:string}
export default function GradeCorrections({onChange}:{onChange:()=>Promise<void>}){
 const locale=useLocale()
 const [rows,setRows]=useState<Correction[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reason,setReason]=useState('')
 async function load(){try{const r=await createClient().rpc('grade_corrections_review');if(r.error)throw r.error;setRows(r.data||[])}catch{setRows([]);setError('Unable to load corrections.')}}
 useEffect(()=>{void load()},[])
 async function act(id:string,action:string){if(!window.confirm(translate('Confirm this correction decision?',locale)))return;setBusy(true);setError('');try{const r=await createClient().rpc('review_grade_correction',{p_id:id,p_action:action,p_reason:reason||null});if(r.error)throw r.error;await load();await onChange();setReason('')}catch(e){setError(gradeError(e))}finally{setBusy(false)}}
 return <section className="space-y-3 rounded-2xl border bg-white p-5"><h2 className="text-xl font-bold"><T text="Published-grade corrections"/></h2><p className="text-sm text-slate-600"><T text="The official grade remains visible until the approved correction is published."/></p>{error&&<p role="alert" className="text-red-700"><T text={error}/></p>}<label className="block"><T text="Return reason"/><input className="ml-2 rounded border p-2" value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)}/></label>{!rows.length&&<p><T text="No pending corrections."/></p>}{rows.map(c=><article key={c.id} className="space-y-2 rounded-xl border p-4"><p className="font-semibold">{c.student} · {c.class} · {c.subject}</p><p>{c.teacher} · {schoolDateTime(c.created_at)}</p><p>{c.score}/{c.max_score} → {c.proposed.score}/{c.proposed.max_score}</p><p><T text="Reason"/> : {c.reason}</p><p>{c.proposed.note}</p><div className="flex gap-3">{c.state==='submitted'?<button disabled={busy} onClick={()=>act(c.id,'approve')} className="rounded bg-emerald-700 p-2 text-white"><T text="Approve"/></button>:<button disabled={busy} onClick={()=>act(c.id,'publish')} className="rounded bg-blue-600 p-2 text-white"><T text="Publish correction"/></button>}<button disabled={busy||reason.trim().length<3} onClick={()=>act(c.id,'return')} className="rounded border p-2 disabled:opacity-40"><T text="Return for correction"/></button></div></article>)}</section>
}
