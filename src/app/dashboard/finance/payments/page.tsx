import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FinanceWorkspace from '../workspace'

export const dynamic = 'force-dynamic'

export default async function FinancePaymentsPage() {
  const db = await createClient()
  const { data, error } = await db.rpc('school_context')
  if (error) throw new Error('Unable to verify school access.')
  const roles: string[] = data?.roles || []
  if (!data?.school_id || !roles.some(role => ['school_admin', 'director', 'secretary', 'accountant'].includes(role))) redirect('/dashboard')
  return <FinanceWorkspace schoolId={data.school_id as string} initialTab="payments" />
}
