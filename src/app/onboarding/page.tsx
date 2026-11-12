import { T } from '@/components/translation-provider'
import Image from 'next/image'
import { ArrowRight, DoorOpen, School } from 'lucide-react'
import TeacherRequest from '@/components/teacher-request'
import Link from 'next/link'

export default function OnboardingPage() {
  return <main className="min-h-[calc(100svh-61px)] bg-slate-50 px-4 py-10 text-slate-900 sm:px-6 sm:py-14">
    <div className="mx-auto max-w-5xl">
      <header className="max-w-2xl">
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl"><T text="Connect to your school"/></h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-slate-600"><T text="Your account is ready. Choose how you will use AtechOS."/></p>
      </header>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)]">
        <section aria-labelledby="join-school-heading" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_rgba(8,26,53,0.06)] sm:p-8">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><DoorOpen size={22} aria-hidden="true"/></span>
            <div>
              <h2 id="join-school-heading" className="text-xl font-bold tracking-tight text-slate-950"><T text="Join a school already on AtechOS"/></h2>
              <p className="mt-2 text-sm leading-6 text-slate-600"><T text="Ask your school administrator for an invitation link. Open it and use the same email address to accept. Your school assigns your role and classes; you do not need to create a school."/></p>
            </div>
          </div>
          <Link href="/invitation" className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
            <T text="Join with an invitation →"/><ArrowRight size={17} aria-hidden="true"/>
          </Link>
          <details className="mt-7 border-t border-slate-200 pt-5">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800 marker:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">
              <T text="Teacher — request school access"/>
            </summary>
            <TeacherRequest />
          </details>
        </section>

        <section aria-labelledby="create-school-heading" className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-50 text-amber-700"><School size={22} aria-hidden="true"/></span>
          <h2 id="create-school-heading" className="mt-5 text-xl font-bold tracking-tight text-slate-950"><T text="School owner"/></h2>
          <p className="mt-2 text-sm leading-6 text-slate-600"><T text="Create a workspace only if you are setting up a new school. You will become its administrator."/></p>
          <Link href="/onboarding/create-school" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-blue-900 transition hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
            <T text="Set up a new school →"/><ArrowRight size={16} aria-hidden="true"/>
          </Link>
        </section>
      </div>
      <footer className="mt-8 flex items-center gap-3 text-sm text-slate-500">
        <Image src="/landing/atechos-logo-mark.webp" alt="" width={22} height={22}/>
        <span><T text="AtechOS · School management"/></span>
      </footer>
    </div>
  </main>
}
