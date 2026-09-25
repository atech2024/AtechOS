import { T } from '@/components/translation-provider'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const modules = [
  ['Publication des bulletins', 'Réviser, filtrer, publier et fixer les dates limites.', '/dashboard/publication'],
  ['Academic progression', 'Review promotion and departures for a new academic year.', '/dashboard/progression'],
  ['Teacher requests', 'Review applications from teachers.', '/dashboard/teacher-requests'],
  ['Students', 'Manage student profiles, NISU, AtechOS IDs and badges.', '/dashboard/students'],
  ['Classes', 'Manage academic years, classes, rooms and grade levels.', '/dashboard/classes'],
  ['Subjects', 'Manage subjects and assign teachers to classes.', '/dashboard/subjects'],
  ['Attendance', 'Track check-in, check-out, lateness and absences.', '/dashboard/attendance'],
  ['Attendance Kiosk', 'Scan the AtechOS ID or QR code for student check-in and check-out.', '/dashboard/attendance/kiosk'],
  ['Student Badges', 'Print badges with the student AtechOS ID and QR code.', '/dashboard/badges'],
  ['Grades', 'Enter and review grades by class, subject and grading period.', '/dashboard/grades'],
  ['Grading periods', 'Create and review the periods used for grades and bulletins.', '/dashboard/grading-periods'],
  ['Grading settings', 'Choose controls per grading period and the passing average.', '/dashboard/grading-settings'],
  ['Bulletins', 'Generate printable student bulletins and save them as PDF.', '/dashboard/bulletins'],
  ['Parents', 'Review parent accounts and student relationships.', '/dashboard/parents'],
  ['Parent Portal', 'Parent-only view of linked children, attendance and grades.', '/dashboard/parent-portal'],
  ['Assignments', 'Publish work, exams and learning documents.', '/dashboard/assignments'],
  ['Staff', 'Invite teachers and manage school access.', '/dashboard/staff'],
]

export default async function DashboardPage() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect('/login')
  const { data: context, error } = await supabase.rpc('school_context')
  if (error) throw new Error('Unable to load school access. Please try again.')
  const roles: string[] = context?.roles || []
  const admin = context?.owner || roles.includes('school_admin')
  const allowed = new Set<string>()
  if (roles.some(r => ['director', 'secretary'].includes(r))) ['Students','Classes','Subjects','Attendance','Attendance Kiosk','Student Badges','Grades','Grading periods','Grading settings','Bulletins','Parents','Assignments'].forEach(m => allowed.add(m))
  if (roles.some(r=>['director','secretary','surveillant'].includes(r))) allowed.add('Publication des bulletins')
  if (roles.includes('director')) ['Academic progression','Teacher requests'].forEach(m=>allowed.add(m))
  if (roles.includes('surveillant')) allowed.add('Bulletins')
  if (roles.includes('teacher')) ['Students','Attendance','Grades','Assignments'].forEach(m => allowed.add(m))
  if (roles.includes('parent')) ['Parent Portal','Bulletins'].forEach(m => allowed.add(m))
  const visibleModules = modules.filter(([title]) => admin || allowed.has(title))
  return <main className="min-h-screen bg-slate-50 p-6 md:p-10"><div className="mx-auto max-w-7xl"><header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><Link href="/onboarding" className="text-sm font-semibold text-blue-600">AtechOS</Link><h1 className="text-3xl font-bold text-slate-900">{context?.school_name || 'School Dashboard'}</h1><p className="mt-1 text-slate-500"><T text="Your modules are based on the access assigned by your school."/></p></div><span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">MVP</span></header><section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleModules.map(([title, description, href])=><article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900"><T text={title}/></h2><p className="mt-2 text-sm leading-6 text-slate-500"><T text={description}/></p>{href==='#'?<span className="mt-5 inline-block text-sm font-semibold text-slate-400">Coming next</span>:<Link href={title==='Bulletins' && roles.includes('parent') && !admin ? '/dashboard/family-bulletins' : href} className="mt-5 inline-block text-sm font-semibold text-blue-600 hover:underline"><T text="Open module →"/></Link>}</article>)}</section>{!visibleModules.length && <p className="mt-8 rounded-xl border bg-white p-6">Your school account is connected. Ask your administrator which services are available for your role.</p>}</div></main>
}
