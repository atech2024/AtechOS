import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StudentKiosk from './kiosk-client'

const kioskRoles = ['school_admin', 'director', 'secretary', 'surveillant', 'censeur', 'preschool_coordinator']

export default async function KioskPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=%2Fkiosk')

  const { data: context, error } = await supabase.rpc('school_context')
  const authorized = !error && Boolean(
    context?.owner || context?.roles?.some((role: string) => kioskRoles.includes(role)),
  )
  if (!authorized) redirect('/dashboard')

  return <StudentKiosk />
}
