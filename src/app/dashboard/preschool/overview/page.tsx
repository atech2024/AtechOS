import {createClient} from '@/lib/supabase/server'
import {redirect} from 'next/navigation'
import PreschoolOverview from '@/components/preschool-overview'

export const dynamic='force-dynamic'

export default async function PreschoolOverviewPage(){
 const db=await createClient()
 const {data:context}=await db.rpc('school_context')
 if(!context?.roles?.some((role:string)=>['school_admin','director','secretary','teacher','censeur'].includes(role))&&!context?.owner)redirect('/dashboard')
 const canManage=Boolean(context?.roles?.some((role:string)=>['school_admin','director','secretary','censeur'].includes(role)))
 return <PreschoolOverview canManage={canManage}/>
}
