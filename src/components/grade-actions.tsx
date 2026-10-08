'use client'
import {useEffect,useState} from 'react'
import Link from 'next/link'
import {ArrowUpRight,ClipboardList} from 'lucide-react'
import {createClient} from '@/lib/supabase/client'
import {T} from '@/components/translation-provider'
type Summary={reviewer:boolean;submitted:number;reviewed:number;returned:number;corrections:number}
type Action={key:string;label:string;count:number;href:string;detail:string}
export default function GradeActions({draftGrades=0}:{draftGrades?:number}){
 const [data,setData]=useState<Summary|null>(null),[error,setError]=useState(false)
 useEffect(()=>{let live=true;Promise.resolve(createClient().rpc('grade_workflow_summary')).then(r=>{if(live){setData(r.data);setError(Boolean(r.error))}}).catch(()=>{if(live)setError(true)});return()=>{live=false}},[])
 if(error)return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4"><T text="Unable to load grade actions."/></p>
 if(!data)return null
 const actions:Action[]=[
  ...(draftGrades>0?[{key:'draft',label:'Unpublished grades',count:draftGrades,href:'/dashboard/grades#grade-entry',detail:'Open grade entry to verify the saved work.'}]:[]),
  ...(data.submitted>0?[{key:'submitted',label:'Grades awaiting review',count:data.submitted,href:data.reviewer?'/dashboard/publication#grade-review':'/dashboard/grades#grade-submit',detail:'Review action'}]:[]),
  ...(data.reviewed>0?[{key:'reviewed',label:'Grades ready to publish',count:data.reviewed,href:data.reviewer?'/dashboard/publication#grade-review':'/dashboard/grades#grade-submit',detail:'Review action'}]:[]),
  ...(data.returned>0?[{key:'returned',label:'Returned for correction',count:data.returned,href:data.reviewer?'/dashboard/publication#grade-review':'/dashboard/grades#grade-entry',detail:'Review action'}]:[]),
  ...(data.corrections>0?[{key:'corrections',label:'Published-grade corrections',count:data.corrections,href:data.reviewer?'/dashboard/publication#grade-corrections':'/dashboard/grades#grade-submit',detail:'Review action'}]:[]),
 ]
 if(!actions.length)return null
 return <section aria-labelledby="grade-actions-title" className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm"><h2 id="grade-actions-title" className="mb-4 flex items-center gap-2 text-lg font-semibold"><ClipboardList size={20} className="text-amber-700"/><T text="Actions required"/></h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{actions.map(action=><Link key={action.key} href={action.href} className="group flex min-h-24 items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 transition-colors hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"><span><strong className="block"><T text={action.label}/> : {action.count}</strong><span className="text-sm text-slate-600"><T text={action.detail}/> →</span></span><ArrowUpRight size={20} className="shrink-0 text-blue-700"/></Link>)}</div></section>
}
