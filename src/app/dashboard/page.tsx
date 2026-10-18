import GradeActions from '@/components/grade-actions'
import { redirect } from 'next/navigation'
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Clock,
  CircleDollarSign,
  Contact,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Users,
  Settings,
  UserCheck,
  UserPlus,
  UserX,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { schoolDate } from '@/lib/school-date'
import { T } from '@/components/translation-provider'
import { cookies } from 'next/headers'
import { localeFrom } from '@/lib/i18n'
import { permittedNavigation, type NavigationItem } from '@/lib/navigation'

const rolePriority = ['school_admin', 'director', 'censeur', 'secretary', 'surveillant', 'teacher', 'parent']
const preferredRoutes: Record<string, string[]> = {
  school_admin: ['/dashboard/approvals', '/dashboard/students', '/dashboard/finance', '/dashboard/publication', '/dashboard/calendar'],
  director: ['/dashboard/approvals', '/dashboard/publication', '/dashboard/students', '/dashboard/finance', '/dashboard/calendar'],
  censeur: ['/dashboard/sanctions', '/dashboard/approvals', '/dashboard/classes', '/dashboard/publication', '/dashboard/exam-submissions'],
  secretary: ['/dashboard/students', '/dashboard/attendance', '/dashboard/finance/payments', '/dashboard/parents', '/dashboard/calendar'],
  surveillant: ['/dashboard/attendance', '/dashboard/attendance/kindergarten-pickup', '/dashboard/badges', '/dashboard/guard', '/dashboard/calendar'],
  teacher: ['/dashboard/grades', '/dashboard/assignments', '/dashboard/exam-submissions', '/dashboard/attendance', '/dashboard/calendar'],
  parent: ['/dashboard/parent-portal', '/dashboard/family-bulletins', '/dashboard/parent-badges'],
}
const actionIcons: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  students: GraduationCap,
  parents: Users,
  teachers: Users,
  classes: BookOpen,
  attendance: ClipboardCheck,
  badge: Contact,
  calendar: CalendarDays,
  grades: FileText,
  publication: ClipboardCheck,
  reports: FileText,
  assignments: BookOpen,
  progression: ArrowUpRight,
  requests: UserPlus,
  users: Users,
  settings: Settings,
  finance: CircleDollarSign,
}

function dashboardActions(roles: string[], owner: boolean, items: NavigationItem[]) {
  const visibleByPath = new Map(items.filter(item => item.href !== '/dashboard').map(item => [item.href, item]))
  const roleOrder = rolePriority.filter(role => roles.includes(role))
  if (owner && roles.length === 0) roleOrder.push('school_admin')

  const orderedPaths = [
    ...roleOrder.flatMap(role => preferredRoutes[role] || []),
    ...items.map(item => item.href),
  ]
  const seen = new Set<string>()
  return orderedPaths.flatMap(path => {
    const item = visibleByPath.get(path)
    if (!item || seen.has(path)) return []
    seen.add(path)
    return [item]
  }).slice(0, 5)
}

type DashboardPageProps = { searchParams: Promise<{ year?: string | string[] }> }

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { year } = await searchParams
  const selectedYear = typeof year === 'string' ? year : null
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/login')

  const locale = localeFrom((await cookies()).get('atechos_locale')?.value)
  const [context, summary] = await Promise.all([db.rpc('school_context'), db.rpc('dashboard_summary')])
  if (context.error) throw new Error('Unable to verify school access.')

  const roles: string[] = Array.isArray(context.data?.roles) ? context.data.roles : []
  if (roles.includes('accountant')) redirect('/dashboard/finance')

  const visibleNavigation = permittedNavigation(roles, Boolean(context.data?.owner))
  const actions = dashboardActions(roles, Boolean(context.data?.owner), visibleNavigation)
  const data = summary.data
  const kpis = [
    ['Students', data?.students, Users, 'bg-blue-50 text-blue-700'],
    ['Present today', data?.present, UserCheck, 'bg-emerald-50 text-emerald-700'],
    ['Late today', data?.late, Clock, 'bg-amber-50 text-amber-700'],
    ['Absent today', data?.absent, UserX, 'bg-red-50 text-red-700'],
  ] as const
  const visibleKpis = kpis.filter(([, value]) => value !== null && value !== undefined)

  return (
    <main className="mx-auto max-w-7xl space-y-7 p-5 md:p-8">
      <header>
        <p className="text-sm font-medium text-blue-700">{context.data?.school_name}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight"><T text="Dashboard" /></h1>
        <p className="mt-2 text-sm text-slate-500">
          {data?.date && schoolDate(data.date, locale)} · <T text={data?.school_scope ? 'School overview' : 'Your authorized records'} />
        </p>
      </header>

      {summary.error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4"><T text="Unable to load dashboard totals." /></p>
      ) : visibleKpis.length > 0 ? (
        <section aria-label="Dashboard totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {visibleKpis.map(([label, value, Icon, color]) => (
            <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500"><T text={label} /></p>
                <span className={'rounded-xl p-3 ' + color}><Icon size={21} aria-hidden="true" /></span>
              </div>
              <p className="mt-3 text-3xl font-bold">{value}</p>
            </article>
          ))}
        </section>
      ) : null}

      {actions.length > 0 && (
        <section aria-labelledby="dashboard-quick-actions" className="space-y-3">
          <h2 id="dashboard-quick-actions" className="text-lg font-semibold"><T text="Quick actions" /></h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {actions.map(item => {
              const Icon = actionIcons[item.icon] || ArrowUpRight
              return (
                <Link
                  key={item.href}
                  href={selectedYear ? `${item.href}?year=${encodeURIComponent(selectedYear)}` : item.href}
                  className="group flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 motion-reduce:transform-none"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-800"><T text={item.label} /></span>
                  <span className="shrink-0 text-slate-400 transition-colors group-hover:text-blue-700">
                    <span className="block transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"><ArrowUpRight size={16} aria-hidden="true" /></span>
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <GradeActions draftGrades={Number(data?.draft_grades || 0)} />
    </main>
  )
}
