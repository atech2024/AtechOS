'use client'
import {useState} from 'react'
import {createClient} from '@/lib/supabase/client'
import {gradeError,gradeStates} from '@/lib/grade-workflow'
import {translate} from '@/lib/translations'
import {T,useLocale} from '@/components/translation-provider'
import GradeHistory from '@/components/grade-history'
type Grade={id:string;student?:string;assessment_name:string;score:number;max_score:number;workflow_state:string}
export default function GradeWorkflow({grades,onChange}:{grades:Grade[];onChange:()=>Promise<void>}){
 const locale=useLocale()
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState<string[]>([])
 const eligible=grades.filter(g=>['draft','returned'].includes(g.workflow_state))
 async function submit(){
  const ids=selected.filter(id=>eligible.some(g=>g.id===id))
  if(!ids.length||!window.confirm(translate('Submit the selected grades for review?',locale)))return
  setBusy(true);setError('')
  try{const r=await createClient().rpc('submit_grades',{p_ids:ids});if(r.error)throw r.error;setSelected([]);await onChange()}
  catch(e){setError(gradeError(e))}finally{setBusy(false)}
 }
 return <section className="my-6 space-y-4 rounded-2xl border bg-white p-5">
  <h2 className="text-xl font-bold"><T text="Grade submission"/></h2>
  <p className="text-sm text-slate-600"><T text="Save, verify, then submit. Submitted grades are locked until review. Families see published grades only."/></p>
  {error&&<p role="alert" className="text-red-700"><T text={error}/></p>}
  <label className="block"><input type="checkbox" disabled={busy} checked={eligible.length>0&&eligible.every(g=>selected.includes(g.id))} onChange={e=>setSelected(e.target.checked?eligible.map(g=>g.id):[])}/> <T text="Select all eligible grades"/></label>
  {!grades.length&&<p><T text="Choose a class, subject and period to view saved grades."/></p>}
  <div className="max-h-96 overflow-auto">{grades.map(g=><div key={g.id} className="flex flex-wrap items-start gap-3 border-t py-3">
   <input aria-label={(g.student||g.assessment_name)+' — '+g.score} type="checkbox" disabled={busy||!eligible.some(x=>x.id===g.id)} checked={selected.includes(g.id)} onChange={e=>setSelected(v=>e.target.checked?[...v,g.id]:v.filter(id=>id!==g.id))}/>
   <span className="flex-1">{g.student} · {g.assessment_name} · {g.score}/{g.max_score}</span>
   <span className="rounded-full bg-blue-50 px-3 py-1 text-xs"><T text={gradeStates[g.workflow_state]||g.workflow_state}/></span><GradeHistory gradeId={g.id}/>
  </div>)}</div>
  <button type="button" disabled={busy||!selected.some(id=>eligible.some(g=>g.id===id))} onClick={submit} className="rounded-xl bg-blue-600 px-5 py-3 text-white disabled:opacity-40"><T text="Submit selected grades"/></button>
 </section>
}
