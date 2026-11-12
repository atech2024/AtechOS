import { createClient } from '@/lib/supabase/server'
import ReportWorkspace from '@/components/report-card'
import { T } from '@/components/translation-provider'
export const dynamic = 'force-dynamic'
export default async function FamilyBulletinsPage() {
 const {data,error}=await (await createClient()).rpc('family_bulletin_data')
 if(error) return <main className="p-4 sm:p-6 lg:p-8"><p role="alert" className="mx-auto max-w-5xl rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><T text="Unable to load family bulletins. Please try again."/></p></main>
 return <ReportWorkspace students={data?.students||[]} />
}
