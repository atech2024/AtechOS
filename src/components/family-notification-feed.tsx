'use client'

import Link from 'next/link'
import {useCallback,useEffect,useState} from 'react'
import {T,useLocale} from '@/components/translation-provider'
import {createClient} from '@/lib/supabase/client'
import {schoolDateTime} from '@/lib/school-date'

type FamilyNotification={id:string;type:string;title:string;description:string;priority:'normal'|'high'|'urgent';href:string;created_at:string;read_at:string|null}

export default function FamilyNotificationFeed(){
 const locale=useLocale()
 const [items,setItems]=useState<FamilyNotification[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [updating,setUpdating]=useState('')

 const load=useCallback(async()=>{
  const db=createClient()
  const {data:{user},error:authError}=await db.auth.getUser()
  if(authError||!user){setError('Unable to load family updates.');setLoading(false);return}
  const {data,error:queryError}=await db.from('notifications')
   .select('id,type,title,description,priority,href,created_at,read_at')
   .eq('recipient_id',user.id)
   .eq('href','/dashboard/parent-portal')
   .order('created_at',{ascending:false})
   .limit(10)
  if(queryError){setError('Unable to load family updates.');setItems([])}
  else{setError('');setItems((data||[]) as FamilyNotification[])}
  setLoading(false)
 },[])

 useEffect(()=>{void load()},[load])

 async function markRead(id:string){
  setUpdating(id)
  const {error:writeError}=await createClient().rpc('mark_notification_read',{p_id:id})
  if(writeError)setError('Unable to update this notification.')
  else setItems(current=>current.map(item=>item.id===id?{...item,read_at:new Date().toISOString()}:item))
  setUpdating('')
 }

 return <section aria-labelledby="family-updates-title" className="my-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
  <div><h2 id="family-updates-title" className="text-xl font-bold"><T text="Recent family updates"/></h2><p className="mt-1 text-sm text-slate-600"><T text="School messages and updates for your family."/></p></div>
  {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800"><T text={error}/></p>}
  {loading?<p role="status" className="text-sm text-slate-500"><T text="Loading updates…"/></p>:!items.length?<p className="text-sm text-slate-600"><T text="No recent updates."/></p>:<ul className="space-y-2">{items.map(item=><li key={item.id} className={`rounded-xl border p-4 ${item.read_at?'border-slate-200':'border-blue-200 bg-blue-50/50'}`}>
   <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1">
    <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{item.title}</span>{!item.read_at&&<span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800"><T text="New"/></span>}{item.priority!=='normal'&&<span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900"><T text={item.priority}/></span>}</div>
    {item.description&&<p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{item.description}</p>}
    <p className="mt-2 text-xs text-slate-500">{schoolDateTime(item.created_at,locale)}</p>
    <Link href={item.href} className="mt-2 inline-block text-sm font-semibold text-blue-700 underline"><T text="Open family portal"/></Link>
   </div>{!item.read_at&&<button type="button" disabled={updating===item.id} onClick={()=>void markRead(item.id)} className="min-h-10 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50"><T text={updating===item.id?'Saving...':'Mark as read'}/></button>}</div>
  </li>)}</ul>}
 </section>
}
