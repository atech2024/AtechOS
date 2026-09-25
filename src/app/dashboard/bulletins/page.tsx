import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ReportWorkspace from '@/components/report-card'
export default async function BulletinsPage() {
 const { data } = await (await createClient()).rpc('school_context')
 if (data?.roles?.includes('parent') && !data?.owner && !data?.roles?.some((r:string)=>['school_admin','director','secretary','surveillant'].includes(r))) redirect('/dashboard/family-bulletins')
 const {data:students,error}=await (await createClient()).rpc('report_students')
 if(error)return <p role="alert" className="p-6">Accès refusé ou chargement impossible.</p>
 return <ReportWorkspace students={students||[]} />
}
