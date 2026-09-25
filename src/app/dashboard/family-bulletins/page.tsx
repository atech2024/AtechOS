import { createClient } from '@/lib/supabase/server'
import ReportWorkspace from '@/components/report-card'
export const dynamic = 'force-dynamic'
export default async function FamilyBulletinsPage() {
 const {data,error}=await (await createClient()).rpc('family_bulletin_data')
 if(error) return <p role="alert" className="p-6">Unable to load family bulletins. Please try again.</p>
 return <ReportWorkspace students={data?.students||[]} />
}
