import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data, error } = await supabase.rpc('get_my_school_id')
  if (error) throw new Error('Unable to verify school membership. Please try again.')
  if (!data) redirect('/onboarding')
  return children
}
