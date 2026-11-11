import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { T } from '@/components/translation-provider'
import { notFound } from 'next/navigation'
import SchoolSubscriptionBilling from '@/components/school-subscription-billing'
import { createClient } from '@/lib/supabase/server'
import { isSchoolSubscriptionsEnabled } from '@/lib/school-subscriptions-feature'

export const dynamic = 'force-dynamic'

export default async function PlatformBillingPage() {
 if (!isSchoolSubscriptionsEnabled()) notFound()
 const db = await createClient()
 const { data, error } = await db.rpc('subscription_billing_operator')
 if (error || data !== true) notFound()
 return <main className="mx-auto min-h-screen max-w-5xl space-y-5 bg-slate-50 p-4 sm:p-8">
  <header className="flex flex-wrap items-center justify-between gap-4">
   <Link href="/" aria-label="AtechOS" className="inline-flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
    <Image src="/landing/atechos-logo-mark.webp" alt="" width={46} height={46} priority className="h-11 w-12 object-contain"/>
    <Image src="/landing/atechos-logo-wordmark.webp" alt="" width={150} height={42} priority className="h-auto w-32 object-contain"/>
   </Link>
   <Link href="/dashboard/settings" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-blue-800 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><ArrowLeft size={18} aria-hidden="true"/><T text="Settings center"/></Link>
  </header>
  <SchoolSubscriptionBilling operator/>
 </main>
}
