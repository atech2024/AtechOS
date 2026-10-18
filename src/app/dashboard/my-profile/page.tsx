import { redirect } from 'next/navigation'
import { T } from '@/components/translation-provider'
import { createClient } from '@/lib/supabase/server'
import { canAccessStaffProfile } from '@/lib/staff-profile'
import { StaffSelfProfileForm } from '@/components/staff-self-profile-form'

export const dynamic = 'force-dynamic'

const roleLabels: Record<string, string> = {
  school_admin: 'Administrator',
  director: 'Director',
  secretary: 'Secretary',
  censeur: 'Academic reviewer',
  teacher: 'Teacher',
  accountant: 'Accountant',
  surveillant: 'Attendance supervisor',
}

export default async function MyProfilePage() {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/login')

  const { data: context, error: contextError } = await db.rpc('school_context')
  if (contextError) throw new Error('Unable to verify your school access.')
  const roles: string[] = Array.isArray(context?.roles) ? context.roles : []
  if (!context?.school_id || !canAccessStaffProfile(roles)) redirect('/dashboard')

  const [personResult, profileResult] = await Promise.all([
    db.from('users').select('full_name').eq('id', user.id).single(),
    db.from('staff_private_profiles')
      .select('address,phone,date_of_birth,sex,identity_document_type,identity_document_number,profile_photo_path')
      .eq('school_id', context.school_id)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])
  const loadError = Boolean(personResult.error || profileResult.error)

  let photoUrl: string | null = null
  if (!loadError && profileResult.data?.profile_photo_path) {
    const { data } = await db.storage.from('staff-profile-photos').createSignedUrl(profileResult.data.profile_photo_path, 900)
    photoUrl = data?.signedUrl || null
  }

  const profile = profileResult.data || {
    address: null,
    phone: null,
    date_of_birth: null,
    sex: null,
    identity_document_type: null,
    identity_document_number: null,
    profile_photo_path: null,
  }

  return <main className="mx-auto min-h-screen max-w-5xl space-y-6 p-5 md:p-8">
    <header className="space-y-2">
      <h1 className="text-3xl font-bold tracking-tight text-slate-950"><T text="My profile"/></h1>
      <p className="max-w-2xl text-slate-600"><T text="Manage the personal information associated with your school account."/></p>
      <p className="text-sm font-semibold text-blue-800">{personResult.data?.full_name || user.email} · {roles.map((role, index) => <span key={role}>{index > 0 ? ' · ' : ''}<T text={roleLabels[role] || role}/></span>)}</p>
      <p className="text-sm text-slate-600"><T text="The role shown here comes from your school access and cannot be changed from this form."/></p>
    </header>
    {loadError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><T text="Unable to load your private staff profile. Please refresh or contact the school administrator."/></p> : <StaffSelfProfileForm
      schoolId={context.school_id}
      userId={user.id}
      initialProfile={profile}
      initialPhotoUrl={photoUrl}
    />}
  </main>
}
