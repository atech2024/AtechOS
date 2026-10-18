import { T } from '@/components/translation-provider'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InviteForm, MemberAction, CancelInvitation } from './invite-form'

const staffRoleLabels: Record<string,string> = {school_admin:'School administrator',director:'Director',censeur:'Academic reviewer',secretary:'Secretary',surveillant:'Supervisor',teacher:'Teacher',accountant:'Accountant',parent:'Parent'}

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
  return <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8"><header><h1 className="text-3xl font-bold tracking-tight text-slate-950"><T text="Users & staff"/></h1></header><InviteForm owner={context.owner} parents={parents.data || []} students={students.data || []} />
    <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><h2 className="mb-4 text-xl font-semibold"><T text="School access"/></h2><table className="w-full min-w-[640px] text-left"><thead className="border-b border-slate-200 bg-slate-50 text-sm text-slate-600"><tr><th className="px-3 py-3"><T text="Name / email"/></th><th className="px-3 py-3"><T text="Role"/></th><th className="px-3 py-3"><T text="Status"/></th><th className="px-3 py-3"><T text="Action"/></th></tr></thead><tbody>{members.data?.map(m => {
      const person = Array.isArray(m.users) ? m.users[0] : m.users as { full_name: string; email: string } | null
      const protectedMember = m.user_id === school.data?.owner_user_id || m.user_id === context.user_id || (!context.owner && m.role === 'school_admin')
      return <tr key={m.id} className="border-t border-slate-100"><td className="px-3 py-3">{person?.full_name}<p className="text-sm text-slate-500">{person?.email}</p></td><td className="px-3 py-3">{m.user_id === school.data?.owner_user_id ? <T text="Owner"/> : <T text={staffRoleLabels[m.role] || m.role}/>}</td><td className="px-3 py-3"><span className={m.enabled?'inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800':'inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700'}><T text={m.enabled ? 'Active' : 'Disabled'}/></span></td><td className="px-3 py-3">{protectedMember ? <T text="Protected"/> : <MemberAction id={m.id} enabled={m.enabled} role={m.role} owner={Boolean(context.owner)} />}</td></tr>
    })}</tbody></table></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><h2 className="mb-4 text-xl font-semibold"><T text="Invitations"/></h2>{!invitations.data?.length && <p className="rounded-xl bg-slate-50 p-4 text-slate-600"><T text="No invitations yet."/></p>}{invitations.data?.map(i => <div key={i.id} className="flex flex-wrap justify-between gap-3 border-t py-3"><div>{i.full_name} — {i.email}<p className="text-sm text-slate-500"><T text={staffRoleLabels[i.role] || i.role}/> · {i.status === 'pending' && new Date(i.expires_at).getTime() < Date.now() ? <T text="expired"/> : <T text={i.status}/>}</p></div>{i.status === 'pending' && <CancelInvitation id={i.id} />}</div>)}</section>
  </main>
}
