import {createClient} from '@/lib/supabase/server'
import {redirect} from 'next/navigation'
import PreschoolWorkspace from '@/components/preschool-workspace'

export const dynamic='force-dynamic'

export default async function PreschoolReportsPage(){
 const db=await createClient()
 const {data:context}=await db.rpc('school_context')
 if(!context?.roles?.some((role:string)=>['school_admin','director','secretary','teacher','censeur'].includes(role))&&!context?.owner) redirect('/dashboard')
 return <PreschoolWorkspace/>
}
