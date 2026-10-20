import {redirect} from 'next/navigation'
import KioskScheduleSettings from '@/components/kiosk-schedule-settings'
import {createClient} from '@/lib/supabase/server'

export const dynamic='force-dynamic'

export default async function KioskSettingsPage(){
 const db=await createClient()
 const {data,error}=await db.rpc('school_context')
 if(error)throw new Error('Unable to verify KIOS settings access.')
 const roles:string[]=Array.isArray(data?.roles)?data.roles:[]
 const allowed=Boolean(data?.owner||roles.some(role=>['school_admin','director','secretary','surveillant','censeur'].includes(role)))
 if(!allowed)redirect('/dashboard')
 return <KioskScheduleSettings/>
}
