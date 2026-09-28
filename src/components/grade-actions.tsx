'use client'
import {useEffect,useState} from 'react'
import Link from 'next/link'
import {createClient} from '@/lib/supabase/client'
import {T} from '@/components/translation-provider'
type Summary={reviewer:boolean;submitted:number;reviewed:number;returned:number;corrections:number}
export default function GradeActions(){const [data,setData]=useState<Summary|null>(null),[error,setError]=useState(false);useEffect(()=>{let live=true;Promise.resolve(createClient().rpc('grade_workflow_summary')).then(r=>{if(live){setData(r.data);setError(Boolean(r.error))}}).catch(()=>{if(live)setError(true)});return()=>{live=false}},[]);if(error)return <p role="alert"><T text="Unable to load grade actions."/></p>;if(!data||!data.submitted&&!data.reviewed&&!data.returned&&!data.corrections)return null;return <section className="grid gap-3 sm:grid-cols-2">{([['submitted','Grades awaiting review'],['reviewed','Grades ready to publish'],['returned','Returned for correction'],['corrections','Published-grade corrections']] as const).filter(([key])=>data[key]>0).map(([key,label])=><Link key={key} href={data.reviewer?'/dashboard/publication':'/dashboard/grades'} className="rounded-xl border border-amber-200 bg-amber-50 p-4"><strong className="block"><T text={label}/> : {data[key]}</strong><span className="text-sm text-blue-700"><T text="Review action"/> →</span></Link>)}</section>}
