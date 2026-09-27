import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/app-shell'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data, error } = await supabase.rpc('get_my_school_id')
  if (error) throw new Error('Unable to verify school membership. Please try again.')
  if (!data) redirect('/onboarding')
  const [context,profile]=await Promise.all([supabase.rpc('school_context'),supabase.from('users').select('full_name,avatar_url').eq('id',user.id).single()])
  if(context.error||profile.error)throw new Error('Unable to load your school profile. Please try again.')
  return <AppShell school={context.data?.school_name||'AtechOS'} name={profile.data?.full_name||user.email||'AtechOS'} avatar={profile.data?.avatar_url||null} roles={context.data?.roles||[]} owner={Boolean(context.data?.owner)}>{children}</AppShell>
}
