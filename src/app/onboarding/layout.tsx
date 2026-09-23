import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import AccountNavigation from '@/components/account-navigation'

export const dynamic = 'force-dynamic'

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  if ((await cookies()).has('atechos_invitation')) redirect('/invitation')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data, error } = await supabase.rpc('get_my_school_id')
  if (error) throw new Error('Unable to verify school membership. Please try again.')
  // Existing members may return here to choose or join a school.
  void data
  return <><AccountNavigation />{children}</>
}
