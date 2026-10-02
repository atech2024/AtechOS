import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/app-shell'
import {AcademicYearProvider,type AcademicYearOption} from '@/components/academic-year-context'

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
  const yearResult=context.data?.school_id?await supabase.from('academic_years').select('id,name,start_date,end_date,is_current').eq('school_id',context.data.school_id).order('is_current',{ascending:false}).order('start_date',{ascending:false}):{data:[],error:null}
  const years=(yearResult.data||[]) as AcademicYearOption[],roles:string[]=context.data?.roles||[]
  const currentYear=years.find(item=>item.is_current)||null
  const canSelectYear=Boolean(context.data?.owner||roles.some(role=>['school_admin','director','secretary','teacher','surveillant','censeur','parent'].includes(role)))
  return <AcademicYearProvider years={years} currentYearId={currentYear?.id||null} canSelect={canSelectYear}>
    <AppShell school={context.data?.school_name||'AtechOS'} name={profile.data?.full_name||user.email||'AtechOS'} avatar={profile.data?.avatar_url||null} roles={roles} owner={Boolean(context.data?.owner)} academicYear={currentYear?.name||null}>{children}</AppShell>
  </AcademicYearProvider>
}
