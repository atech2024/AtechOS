import { notFound } from 'next/navigation'
import SchoolSubscriptionBilling from '@/components/school-subscription-billing'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function PlatformBillingPage() {
 if (process.env.VERCEL_ENV === 'production' || process.env.SCHOOL_TRIAL_PREVIEW !== 'true') notFound()
 const db = await createClient()
 const { data, error } = await db.rpc('subscription_billing_operator')
 if (error || data !== true) notFound()
 return <main className="mx-auto min-h-screen max-w-5xl bg-slate-50 p-4 sm:p-8">
  <SchoolSubscriptionBilling operator/>
 </main>
}
