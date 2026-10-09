import Link from 'next/link'
import { T } from '@/components/translation-provider'
import { FinanceReceiptSignatureSettings } from '@/components/finance-payment-receipt'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const settingGroups = [
  {
    id: 'school-organization',
    title: 'School organization',
    description: 'Set up the school year, calendar, sections, classes and subjects.',
    links: [
      { href: '/dashboard/calendar', title: 'Academic year and school calendar', description: 'Manage school years, holidays, closures and school dates.' },
      { href: '/dashboard/classes', title: 'Sections and classes', description: 'Choose active school sections and organize classes.' },
      { href: '/dashboard/subjects', title: 'Subjects and teachers', description: 'Configure subjects and their teaching assignments.' },
    ],
  },
  {
    id: 'teaching-results',
    title: 'Teaching and results',
    description: 'Configure the academic rules used for grades, exams and report cards.',
    links: [
      { href: '/dashboard/grading-settings', title: 'Grading rules', description: 'Set assessment counts and the passing average.' },
      { href: '/dashboard/grading-periods', title: 'Exam periods', description: 'Choose the periods and dates used by each school section.' },
    ],
  },
  {
    id: 'school-finance',
    title: 'School finances',
    description: 'Keep school currency, payment methods, fees and due dates together.',
    links: [
      { href: '/dashboard/finance/settings', title: 'Finance rules and payment methods', description: 'Set the school currency, proof rules, restrictions and payment destinations.' },
      { href: '/dashboard/finance/plans', title: 'Fees and installments', description: 'Set each class fee, number of installments, amounts and due dates.' },
    ],
  },
]

export default async function SettingsPage() {
  const db = await createClient()
  const { data, error } = await db.rpc('school_context')
  if (error) throw new Error('Unable to verify your settings access.')
  const roles: string[] = Array.isArray(data?.roles) ? data.roles : []
  const canManageSettings = Boolean(data?.owner || roles.some((role: string) => ['school_admin', 'director'].includes(role)))
  const canManageSignature = Boolean(data?.owner || roles.some((role: string) => ['school_admin', 'director', 'censeur', 'secretary', 'accountant'].includes(role)))

  return <main className="mx-auto min-h-screen max-w-6xl space-y-7 bg-slate-50 p-5 md:p-8">
    <header>
      <p className="text-sm font-semibold uppercase tracking-wide text-blue-700"><T text="School administration"/></p>
      <h1 className="mt-1 text-3xl font-bold text-slate-900"><T text="Settings center"/></h1>
      <p className="mt-2 max-w-3xl text-slate-600"><T text="Configure school-wide rules in one place. Each setting opens the existing module that manages it."/></p>
    </header>
    {!canManageSettings && !canManageSignature && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><T text="You do not have permission to manage school settings."/></p>}
    {canManageSignature && <FinanceReceiptSignatureSettings isSchoolAdmin={Boolean(data?.owner || roles.includes('school_admin'))}/>}
    {canManageSettings && <div className="space-y-6">
      {settingGroups.map(group => <section key={group.id} aria-labelledby={group.id} className="space-y-3">
        <div>
          <h2 id={group.id} className="text-xl font-semibold text-slate-900"><T text={group.title}/></h2>
          <p className="mt-1 text-sm text-slate-600"><T text={group.description}/></p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {group.links.map(link => <Link key={link.href} href={link.href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            <h3 className="font-semibold text-slate-900 group-hover:text-blue-700"><T text={link.title}/></h3>
            <p className="mt-2 min-h-10 text-sm leading-6 text-slate-600"><T text={link.description}/></p>
            <span className="mt-4 inline-flex font-semibold text-blue-700"><T text="Open settings"/> →</span>
          </Link>)}
        </div>
      </section>)}
    </div>}
  </main>
}
