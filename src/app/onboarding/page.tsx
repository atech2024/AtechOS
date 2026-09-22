import Link from 'next/link'

export default function OnboardingPage() {
  return <main className="min-h-screen bg-slate-50 p-8"><section className="mx-auto max-w-2xl space-y-6 rounded-2xl border bg-white p-8">
    <h1 className="text-3xl font-bold">Connect to your school</h1>
    <p>Your account is ready. Choose how you will use AtechOS.</p>
    <article className="rounded-xl border p-5"><h2 className="text-xl font-semibold">Teacher, staff member, parent or student</h2><p className="my-3">Ask your school administrator for an invitation link. Open it and use the same email address to accept. Your school assigns your role and classes; you do not need to create a school.</p><Link href="/invitation" className="font-semibold text-blue-700">Join with an invitation →</Link></article>
    <article className="rounded-xl border p-5"><h2 className="text-xl font-semibold">School owner</h2><p className="my-3">Create a workspace only if you are setting up a new school. You will become its administrator.</p><Link href="/onboarding/create-school" className="font-semibold text-blue-700">Set up a new school →</Link></article>
    <Link href="/login" className="block text-blue-700">Sign in with another account</Link>
  </section></main>
}
