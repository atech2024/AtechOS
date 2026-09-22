import Link from 'next/link'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import AcceptButton from './accept-button'
import { dismissInvitation } from './actions'

export const dynamic = 'force-dynamic'
export const metadata = { referrer: 'no-referrer' as const }

export default async function InvitationPage() {
  const token = (await cookies()).get('atechos_invitation')?.value
  let email: string | undefined
  if (token) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    email = user?.email
  }
  return <main className="min-h-screen bg-slate-50 p-8"><section className="mx-auto max-w-lg space-y-5 rounded-2xl border bg-white p-8">
    <Link href="/">AtechOS</Link><h1 className="text-2xl font-bold">School invitation</h1>
    {!token ? <p>Open the invitation link shared by your school.</p> : email ? <><p>Signed in as {email}. Your verified email must match the invitation.</p><AcceptButton /></> : <><p>Sign in or create an account using the email address your school invited. Then return here to accept.</p><div className="flex gap-6"><Link href="/login">Sign in</Link><Link href="/signup">Create account</Link></div></>}
    <form action={dismissInvitation}><button className="text-slate-600 underline">Continue without this invitation</button></form>
  </section></main>
}

