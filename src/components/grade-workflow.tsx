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
 const locked=grades.filter(g=>!['draft','returned'].includes(g.workflow_state))
 async function submit(){
  const ids=selected.filter(id=>eligible.some(g=>g.id===id))
  if(!ids.length||!window.confirm(translate('Submit the selected grades for review?',locale)))return
  setBusy(true);setError('')
  try{const r=await createClient().rpc('submit_grades',{p_ids:ids});if(r.error)throw r.error;setSelected([]);await onChange()}
  catch(e){setError(gradeError(e))}finally{setBusy(false)}
 }
 function gradeRow(g:Grade,disabled:boolean){
  return <article key={g.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
   <input aria-label={(g.student||g.assessment_name)+' — '+g.score} type="checkbox" disabled={busy||disabled} checked={selected.includes(g.id)} onChange={e=>setSelected(v=>e.target.checked?[...v,g.id]:v.filter(id=>id!==g.id))}/>
   <span className="min-w-48 flex-1"><strong className="block">{g.student||'—'}</strong><span className="text-sm text-slate-600">{g.assessment_name} · {g.score}/{g.max_score}</span></span>
   <span className={`rounded-full px-3 py-1 text-xs font-semibold ${disabled?'bg-slate-100 text-slate-700':'bg-amber-50 text-amber-800'}`}><T text={gradeStates[g.workflow_state]||g.workflow_state}/></span>
   <GradeHistory gradeId={g.id}/>
  </article>
 }
 return <section id="grade-submit" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold"><T text="Grade submission"/></h2><p className="mt-1 text-sm text-slate-600"><T text="Save, verify, then submit. Submitted grades are locked until review. Families see published grades only."/></p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800">{eligible.length} <T text="ready to submit"/></span></div>
  {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700"><T text={error}/></p>}
  {!eligible.length?<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><T text="No grades ready to submit for this selection."/></p>:<>
   <label className="inline-flex items-center gap-2 text-sm font-medium"><input type="checkbox" disabled={busy} checked={eligible.every(g=>selected.includes(g.id))} onChange={e=>setSelected(e.target.checked?eligible.map(g=>g.id):[])}/> <T text="Select all eligible grades"/></label>
   <div className="space-y-2">{eligible.map(g=>gradeRow(g,false))}</div>
   <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="text-sm text-slate-600">{selected.filter(id=>eligible.some(g=>g.id===id)).length} <T text="selected"/></p><button type="button" disabled={busy||!selected.some(id=>eligible.some(g=>g.id===id))} onClick={submit} className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-40"><T text="Submit selected grades"/></button></div>
  </>}
  {locked.length>0&&<details className="rounded-xl border border-slate-200 bg-slate-50 p-4"><summary className="cursor-pointer font-semibold"><T text="Grade history"/> ({locked.length})</summary><p className="my-3 text-sm text-slate-600"><T text="Submitted grades are locked until review. Families see published grades only."/></p><div className="space-y-2">{locked.map(g=>gradeRow(g,true))}</div></details>}
  {!grades.length&&<p className="text-sm text-slate-500"><T text="Choose a class, subject and period to view saved grades."/></p>}
 </section>
}
