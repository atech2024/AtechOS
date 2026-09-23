import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Workspace from './workspace'
export default async function BulletinsPage() {
 const { data } = await (await createClient()).rpc('school_context')
 if (data?.roles?.includes('parent') && !data?.owner && !data?.roles?.some((r:string)=>['school_admin','director'].includes(r))) redirect('/dashboard/family-bulletins')
 return <Workspace />
}
