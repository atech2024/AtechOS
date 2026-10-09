import Link from 'next/link'
import { T } from '@/components/translation-provider'
import { FinanceReceiptSignatureSettings } from '@/components/finance-payment-receipt'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const db = await createClient()
  const { data, error } = await db.rpc('school_context')
  if (error) throw new Error('Unable to verify your settings access.')
  const roles: string[] = Array.isArray(data?.roles) ? data.roles : []
  const canManageGrading = Boolean(data?.owner || roles.some((role: string) => ['school_admin', 'director'].includes(role)))
  const canManageSignature = Boolean(data?.owner || roles.some((role: string) => ['school_admin', 'director', 'censeur', 'secretary', 'accountant'].includes(role)))

  return <main className="mx-auto min-h-screen max-w-5xl space-y-6 p-5 md:p-8">
    <header>
      <h1 className="text-3xl font-bold"><T text="Settings center"/></h1>
      <p className="mt-2 text-slate-600"><T text="School-wide configuration, organized by the settings that are available to your role."/></p>
    </header>
    {!canManageGrading && !canManageSignature && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><T text="You do not have permission to manage school settings."/></p>}
    {canManageSignature && <FinanceReceiptSignatureSettings/>}
    {canManageGrading && <section aria-labelledby="academic-rules" className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 id="academic-rules" className="text-xl font-semibold"><T text="Academic rules"/></h2>
      <p className="mt-1 text-sm text-slate-600"><T text="Configure the number of assessments and the passing average used by grades, report cards and progression."/></p>
      <Link href="/dashboard/grading-settings" className="mt-4 inline-flex rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white"><T text="Grading rules"/> →</Link>
    </section>}
  </main>
}
