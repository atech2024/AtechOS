'use client'
import {useEffect,useState} from 'react'
import {createClient} from '@/lib/supabase/client'
import {ParentBadge} from '@/components/badge-history'
import {T} from '@/components/translation-provider'
export default function ParentBadges(){const [children,setChildren]=useState<{id:string;first_name:string;last_name:string;atechos_id:string}[]>([]),[error,setError]=useState(false),[loading,setLoading]=useState(true);useEffect(()=>{let active=true;createClient().rpc('family_bulletin_data').then(({data,error})=>{if(active){setChildren(data?.students||[]);setError(Boolean(error));setLoading(false)}});return()=>{active=false}},[]);return <main className="mx-auto max-w-5xl p-6"><h1 className="mb-5 text-3xl font-bold"><T text="Student Badges"/></h1>{error?<p role="alert"><T text="Unable to load badge."/></p>:loading?<p><T text="Loading..."/></p>:!children.length?<p><T text="No linked children."/></p>:children.map(c=><section key={c.id}><ParentBadge key={c.id} studentId={c.id} student={c}/></section>)}</main>}
