import { T } from '@/components/translation-provider'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InviteForm, MemberAction, CancelInvitation } from './invite-form'

export default async function StaffPage() {
  const db = await createClient()
  const { data: context, error } = await db.rpc('school_context')
  if (error) throw new Error('Unable to load school access.')
  if (!context?.owner && !context?.roles?.includes('school_admin')) redirect('/dashboard')
  const [members, invitations, parents, students, school] = await Promise.all([
    db.from('school_members').select('id,user_id,role,enabled,users(full_name,email)').eq('school_id', context.school_id),
    db.from('school_invitations').select('id,email,full_name,role,status,expires_at').eq('school_id', context.school_id).order('created_at', { ascending: false }),
    db.from('parents').select('id,full_name,email').eq('school_id', context.school_id),
    db.from('students').select('id,first_name,last_name').eq('school_id', context.school_id).eq('active', true),
    db.from('schools').select('owner_user_id').eq('id', context.school_id).single(),
  ])
  if ([members, invitations, parents, students, school].some(r => r.error)) throw new Error('Unable to load the staff directory.')
  return <main className="mx-auto max-w-6xl space-y-6 p-6"><Link href="/dashboard"><T text="← Dashboard"/></Link><h1 className="text-3xl font-bold"><T text="Users & staff"/></h1><InviteForm owner={context.owner} parents={parents.data || []} students={students.data || []} />
    <section className="overflow-x-auto rounded-2xl border bg-white p-6"><h2 className="mb-4 text-xl font-semibold"><T text="School access"/></h2><table className="w-full text-left"><thead><tr><th>Name / email</th><th>Role</th><th><T text="Status"/></th><th>Action</th></tr></thead><tbody>{members.data?.map(m => {
      const person = Array.isArray(m.users) ? m.users[0] : m.users as { full_name: string; email: string } | null
      const protectedMember = m.user_id === school.data?.owner_user_id || m.user_id === context.user_id || (!context.owner && m.role === 'school_admin')
      return <tr key={m.id} className="border-t"><td className="py-3">{person?.full_name}<p className="text-sm text-slate-500">{person?.email}</p></td><td>{m.user_id === school.data?.owner_user_id ? 'Owner' : m.role}</td><td>{m.enabled ? 'Active' : 'Disabled'}</td><td>{protectedMember ? 'Protected' : <MemberAction id={m.id} enabled={m.enabled} />}</td></tr>
    })}</tbody></table></section>
    <section className="rounded-2xl border bg-white p-6"><h2 className="mb-4 text-xl font-semibold">Invitations</h2>{!invitations.data?.length && <p>No invitations yet.</p>}{invitations.data?.map(i => <div key={i.id} className="flex flex-wrap justify-between gap-3 border-t py-3"><div>{i.full_name} — {i.email}<p className="text-sm text-slate-500">{i.role} · {i.status === 'pending' && new Date(i.expires_at).getTime() < Date.now() ? 'expired' : i.status}</p></div>{i.status === 'pending' && <CancelInvitation id={i.id} />}</div>)}</section>
  </main>
}
