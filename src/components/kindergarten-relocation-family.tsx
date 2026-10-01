'use client'
import {useCallback,useEffect,useState} from 'react'
import {T} from '@/components/translation-provider'
import {createClient} from '@/lib/supabase/client'

type Relocation={student_id:string;student:string;class:string;message:string}
export default function KindergartenRelocationFamily(){
 const [rows,setRows]=useState<Relocation[]>([])
 const load=useCallback(async()=>{const {data,error}=await createClient().rpc('kindergarten_parent_relocation_status');if(!error)setRows((data||[]) as Relocation[])},[])
 useEffect(()=>{void load();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load()},15000);return()=>window.clearInterval(timer)},[load])
 if(!rows.length)return null
 return <section className="my-5 rounded-xl border border-amber-300 bg-amber-50 p-4 print:hidden"><h2 className="text-lg font-semibold"><T text="Please contact the school"/></h2><div className="mt-2 space-y-2">{rows.map(r=><article key={r.student_id} className="rounded border bg-white p-3"><p className="font-medium">{r.student} · {r.class}</p><p className="text-sm"><T text={r.message}/></p></article>)}</div></section>
}
