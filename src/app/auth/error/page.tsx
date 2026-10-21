import Link from 'next/link'

export default function AuthErrorPage() {
  return <main className="mx-auto max-w-lg p-8"><h1 className="text-2xl font-bold">Unable to complete email confirmation</h1><p className="my-4">The link may have expired or been opened in a different browser. Try signing in if your email is already confirmed, or request a new confirmation email from your school administrator.</p><Link className="underline" href="/login">Go to sign in</Link></main>
}
