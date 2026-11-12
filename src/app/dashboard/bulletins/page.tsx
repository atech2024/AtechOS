import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ReportWorkspace from '@/components/report-card'
import { T } from '@/components/translation-provider'
export default async function BulletinsPage() {
 const { data } = await (await createClient()).rpc('school_context')
 if (data?.roles?.includes('parent') && !data?.owner && !data?.roles?.some((r:string)=>['school_admin','director','secretary','surveillant','censeur'].includes(r))) redirect('/dashboard/family-bulletins')
 const {data:students,error}=await (await createClient()).rpc('report_students')
 if(error)return <main className="p-4 sm:p-6 lg:p-8"><p role="alert" className="mx-auto max-w-5xl rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><T text="Access denied or could not load bulletins."/></p></main>
 return <ReportWorkspace students={students||[]} />
}
