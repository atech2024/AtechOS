const modules = [
  ['Students', 'Manage student profiles, enrollment and NISU records.'],
  ['Attendance', 'Track check-in, check-out, lateness and absences.'],
  ['Grades', 'Enter and review grades by class and subject.'],
  ['Assignments', 'Publish work, exams and learning documents.'],
  ['Parents', 'Connect families with school information and meetings.'],
  ['Staff', 'Manage teachers, secretaries, accountants and staff.'],
]

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">AtechOS</p>
            <h1 className="text-3xl font-bold text-slate-900">School Dashboard</h1>
            <p className="mt-1 text-slate-500">Your school operations, in one place.</p>
          </div>
          <span className="rounded-full bg-white px-4 py-2 text-sm text-slate-600 border border-slate-200">MVP</span>
        </header>
        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map(([title, description]) => (
            <article key={title} className="rounded-2xl bg-white p-6 border border-slate-200 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
              <button className="mt-5 text-sm font-semibold text-blue-600">Open module →</button>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}
