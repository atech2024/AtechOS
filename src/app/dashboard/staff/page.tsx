import Link from 'next/link'
import { ArrowRight, CheckCircle2, Clock3, UsersRound } from 'lucide-react'
import { T } from '@/components/translation-provider'
import { InvitationAccepted, InvitationPending, StaffDirectory, type StaffDirectoryPerson } from '@/components/staff-directory'
import { getStaffPagePresentation } from '@/lib/staff-page-presentation'
import { getDisplayMemberRole } from '@/lib/staff-directory-sections'
import { canRenewInvitation } from '@/lib/invitation-policy'
import { createClient } from '@/lib/supabase/server'
import { CancelInvitation, InviteForm, RenewInvitation } from './invite-form'

const staffRoles = new Set(['school_admin', 'director', 'censeur', 'secretary', 'surveillant', 'teacher', 'accountant', 'preschool_coordinator'])
const roleLabels: Record<string, string> = {
  owner: 'School owner',
  school_admin: 'School administrator',
  preschool_coordinator: 'Preschool coordinator',
  director: 'Director',
  censeur: 'Academic reviewer',
  secretary: 'Secretary',
  surveillant: 'Supervisor',
  teacher: 'Teacher',
  accountant: 'Accountant',
  parent: 'Parent',
  student: 'Student',
}

function StaffPageError({ message }: { message: string }) {
  return <main className="mx-auto max-w-3xl p-4 sm:p-6 lg:p-8">
    <section role="alert" className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm sm:p-6">
      <h1 className="text-xl font-semibold text-slate-950"><T text="Staff page unavailable"/></h1>
      <p className="mt-2 text-sm leading-6 text-slate-700"><T text={message}/></p>
      <Link href="/dashboard/staff" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white transition hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
        <T text="Reload staff page"/><ArrowRight aria-hidden="true" className="size-4"/>
      </Link>
    </section>
  </main>
}

function PageHeading({ description }: { description: string }) {
  return <header className="space-y-2 border-b border-slate-200 pb-5">
    <h1 className="font-serif text-3xl tracking-tight text-slate-950 sm:text-4xl"><T text="Users & staff"/></h1>
    <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-base"><T text={description}/></p>
  </header>
}

function TeacherAccessView({ showDirectory, people }: {
  showDirectory: boolean
  people: StaffDirectoryPerson[]
}) {
  return <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
    <PageHeading description="Manage teacher invitations and requests for your school."/>
    {showDirectory && <StaffDirectory people={people} readOnly/>}
    <InviteForm owner={false} teacherOnly students={[]}/>
    <section className="flex flex-col gap-4 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-blue-800"><Clock3 aria-hidden="true" className="size-5"/></span>
        <div>
          <h2 className="font-semibold text-slate-950"><T text="Teacher requests"/></h2>
          <p className="mt-1 text-sm text-slate-700"><T text="Review teacher accounts waiting for school approval."/></p>
        </div>
      </div>
      <Link href="/dashboard/teacher-requests" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white transition hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
        <T text="Review requests"/><ArrowRight aria-hidden="true" className="size-4"/>
      </Link>
    </section>
  </main>
}

export default async function StaffPage() {
  const db = await createClient()
  const { data: context, error } = await db.rpc('school_context')
  if (error || !context?.school_id) return <StaffPageError message="We could not load your school access. Refresh the page or contact school administration."/>

  const presentation = getStaffPagePresentation(Boolean(context.owner), context.roles || [])
  const { data: canManageTeachers, error: accessError } = await db.rpc('teacher_staff_management_access')
  if (accessError || !canManageTeachers) return <StaffPageError message="Your account does not have access to this staff workspace. Ask school administration to review your access."/>

  const [members, invitations, students, school, coordinatorWorkspace] = await Promise.all([
    db.from('school_members').select('id,user_id,role,enabled,users(full_name,email)').eq('school_id', context.school_id),
    presentation.fullDirectory ? db.from('school_invitations').select('id,email,full_name,role,status,expires_at,accepted_at').eq('school_id', context.school_id).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    presentation.fullDirectory ? db.from('students').select('id,first_name,last_name').eq('school_id', context.school_id).eq('active', true) : Promise.resolve({ data: [], error: null }),
    presentation.fullDirectory ? db.from('schools').select('owner_user_id').eq('id', context.school_id).single() : Promise.resolve({ data: { owner_user_id: null }, error: null }),
    presentation.coordinatorAssignment ? db.rpc('preschool_coordinator_workspace') : Promise.resolve({ data: { coordinator_user_id: null }, error: null }),
  ])
  if (members.error || invitations.error) return <StaffPageError message="We could not load the staff directory or invitations. Refresh the page and try again."/>
  if (presentation.fullDirectory && (students.error || school.error)) return <StaffPageError message="We could not load the records needed to prepare an invitation. Refresh the page and try again."/>
  if (presentation.coordinatorAssignment && coordinatorWorkspace.error) return <StaffPageError message="We could not load the Preschool coordinator assignment. Refresh the page and try again."/>

  const memberRows = members.data || []
  const coordinatorId = coordinatorWorkspace.data?.coordinator_user_id || null
  const peopleById = new Map<string, StaffDirectoryPerson>()
  for (const member of memberRows) {
    if (!presentation.fullDirectory && !staffRoles.has(member.role)) continue
    const person = Array.isArray(member.users) ? member.users[0] : member.users as { full_name: string; email: string } | null
    const displayName = person?.full_name || person?.email || '—'
    const group: StaffDirectoryPerson = peopleById.get(member.user_id) || { id: member.user_id, name: displayName, email: person?.email || '', access: [] }
    group.access.push({
      id: member.id,
      role: getDisplayMemberRole(member.role, member.user_id === school.data?.owner_user_id),
      enabled: member.enabled,
      protectedMember: !presentation.fullDirectory || member.role === 'preschool_coordinator' || member.user_id === school.data?.owner_user_id || member.user_id === context.user_id || (!context.owner && member.role === 'school_admin'),
      schoolOwner: member.user_id === school.data?.owner_user_id,
    })
    peopleById.set(member.user_id, group)
  }
  const people = [...peopleById.values()].map(person => {
    person.preschoolCoordinator = person.id === coordinatorId
    return person
  }).sort((a, b) => Number(Boolean(b.preschoolCoordinator)) - Number(Boolean(a.preschoolCoordinator)) || a.name.localeCompare(b.name))

  if (!presentation.fullDirectory) {
    return <TeacherAccessView
      showDirectory={presentation.coordinatorAssignment}
      people={people}
    />
  }

  const activeStaffCount = new Set(memberRows.filter(member => member.enabled && staffRoles.has(member.role)).map(member => member.user_id)).size
  const now = Date.now()
  const pendingInvitations = (invitations.data || []).filter(invitation => invitation.status === 'pending' && new Date(invitation.expires_at).getTime() > now)
  const acceptedInvitations = (invitations.data || []).filter(invitation => invitation.status === 'accepted')
  const historyInvitations = (invitations.data || []).filter(invitation => invitation.status !== 'accepted' && (invitation.status !== 'pending' || new Date(invitation.expires_at).getTime() <= now))

  return <main className="staff-page mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
    <PageHeading description="Manage school access, invitations, and the person responsible for Preschool / Kindergarten."/>

    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-700">
      <span className="inline-flex items-center gap-2"><UsersRound aria-hidden="true" className="size-4 text-blue-700"/><strong className="tabular-nums">{activeStaffCount}</strong><T text="Active staff"/></span>
    </div>

    <details className="staff-disclosure rounded-2xl border border-slate-200 bg-white shadow-sm">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 font-semibold text-slate-900 outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-700 sm:px-6">
        <span><T text="Invite a person"/></span>
        <span className="text-sm font-medium text-blue-800"><T text="Open or close"/></span>
      </summary>
      <div className="staff-disclosure__content border-t border-slate-200 p-4 sm:p-6">
        <InviteForm owner={Boolean(context.owner)} students={students.data || []}/>
      </div>
    </details>

    <StaffDirectory people={people} canManageCoordinator={presentation.fullDirectory}/>

    <section className="staff-panel space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold text-slate-950"><T text="Invitation tracking"/></h2>
          <p className="mt-1 text-sm text-slate-600"><T text="Create an invitation, let the recipient accept it, then find their account in the matching directory section."/></p>
        </div>
      </div>
      <ol className="grid gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 sm:grid-cols-3 sm:p-4">
        <li><strong className="text-slate-950">1.</strong> <T text="Create the invitation"/></li>
        <li><strong className="text-slate-950">2.</strong> <T text="The recipient accepts the private link"/></li>
        <li><strong className="text-slate-950">3.</strong> <T text="Their account appears in its section"/></li>
      </ol>
      <div>
        <h3 className="font-semibold text-slate-900"><T text="Pending invitations"/> <span className="ml-1 tabular-nums text-slate-600">({pendingInvitations.length})</span></h3>
        <p className="mt-1 text-sm text-slate-600"><T text="Private links expire after seven days. Cancel an active invitation if it should no longer be used."/></p>
      </div>
      {pendingInvitations.length ? <ul className="divide-y divide-slate-100">{pendingInvitations.map(invitation => <li key={invitation.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{invitation.full_name} <span className="font-normal text-slate-600">· {invitation.email}</span></p>
          <p className="text-sm text-slate-600"><T text={roleLabels[invitation.role] || invitation.role}/></p>
          <InvitationPending expiresAt={invitation.expires_at}/>
        </div>
        <CancelInvitation id={invitation.id}/>
      </li>)}</ul> : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700"><T text="No pending invitations."/></p>}
      <section aria-labelledby="accepted-invitations-title" className="space-y-3 border-t border-slate-200 pt-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 aria-hidden="true" className="size-5 text-emerald-700"/>
          <h3 id="accepted-invitations-title" className="font-semibold text-slate-950"><T text="Accepted invitations"/> <span className="ml-1 tabular-nums text-slate-600">({acceptedInvitations.length})</span></h3>
        </div>
        {acceptedInvitations.length ? <ul className="divide-y divide-emerald-100 rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 sm:px-4">{acceptedInvitations.map(invitation => <li key={invitation.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{invitation.full_name} <span className="font-normal text-slate-600">· {invitation.email}</span></p>
            <p className="text-sm text-slate-600"><T text={roleLabels[invitation.role] || invitation.role}/></p>
          </div>
          <InvitationAccepted acceptedAt={invitation.accepted_at}/>
        </li>)}</ul> : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700"><T text="No accepted invitations yet."/></p>}
      </section>
      <details className="staff-disclosure border-t border-slate-200 pt-3">
        <summary className="min-h-11 cursor-pointer rounded-lg py-2 font-medium text-blue-800 outline-none focus-visible:ring-2 focus-visible:ring-blue-700"><T text="Expired and cancelled invitations"/> <span className="ml-1 text-sm text-slate-600">({historyInvitations.length})</span></summary>
        <div className="staff-disclosure__content pt-2">
          {historyInvitations.length ? <ul className="divide-y divide-slate-100">{historyInvitations.map(invitation => <li key={invitation.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="min-w-0 truncate text-sm font-medium text-slate-800">{invitation.full_name} <span className="font-normal text-slate-600">· {invitation.email}</span></span>
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm text-slate-600"><T text={roleLabels[invitation.role] || invitation.role}/> · <T text={invitation.status === 'pending' ? 'Expired' : invitation.status === 'cancelled' ? 'Cancelled' : invitation.status}/></span>{canRenewInvitation(invitation.status, invitation.expires_at, now) && <RenewInvitation id={invitation.id}/>}</div>
          </li>)}</ul> : <p className="py-3 text-sm text-slate-600"><T text="No invitation history yet."/></p>}
        </div>
      </details>
    </section>
  </main>
}

