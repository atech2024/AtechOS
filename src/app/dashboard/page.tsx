import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const modules = [
  ['Students', 'Manage student profiles, NISU, AtechOS IDs and badges.', '/dashboard/students'],
  ['Classes', 'Manage academic years, classes, rooms and grade levels.', '/dashboard/classes'],
  ['Subjects', 'Manage subjects and assign teachers to classes.', '/dashboard/subjects'],
  ['Attendance', 'Track check-in, check-out, lateness and absences.', '/dashboard/attendance'],
  ['Attendance Kiosk', 'Scan RFID/NFC badges for automatic student check-in and check-out.', '/dashboard/attendance/kiosk'],
  ['Student Badges', 'Preview and print school badges without exposing the private AtechOS ID or NISU.', '/dashboard/badges'],
  ['Grades', 'Enter and review grades by class, subject and grading period.', '/dashboard/grades'],
  ['Grading settings', 'Choose controls per grading period and the passing average.', '/dashboard/grading-settings'],
  ['Bulletins', 'Generate printable student bulletins and save them as PDF.', '/dashboard/bulletins'],
  ['Assignments', 'Publish work, exams and learning documents.', '#'],
  ['Parents', 'Connect families with school information and meetings.', '#'],
  ['Staff', 'Manage teachers, secretaries, accountants and staff.', '#'],
]

export default async function DashboardPage() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect('/login')
  return <main className="min-h-screen bg-slate-50 p-6 md:p-10"><div className="mx-auto max-w-7xl"><header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><p className="text-sm font-semibold text-blue-600">AtechOS</p><h1 className="text-3xl font-bold text-slate-900">School Dashboard</h1><p className="mt-1 text-slate-500">Your school operations, in one place.</p></div><span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">MVP</span></header><section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{modules.map(([title, description, href])=><article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-slate-900">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>{href==='#'?<span className="mt-5 inline-block text-sm font-semibold text-slate-400">Coming next</span>:<Link href={href} className="mt-5 inline-block text-sm font-semibold text-blue-600 hover:underline">Open module →</Link>}</article>)}</section></div></main>
}
