'use server'

import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { canRenewInvitation } from '@/lib/invitation-policy'

type InvitationActionResult = { error?: string; url?: string; delivery?: 'email' | 'manual'; notice?: string }

const roles = ['school_admin', 'director', 'censeur', 'secretary', 'teacher', 'accountant', 'surveillant', 'parent', 'student']
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character)) }

async function deliverInvitation(origin: string, token: string, email: string, name: string, role: string): Promise<InvitationActionResult> {
  const url = `${origin}/invite?token=${encodeURIComponent(token)}`
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.ATECHOS_FROM_EMAIL
  if (!apiKey || !from) return { url, delivery: 'manual' as const }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [email], subject: 'Your AtechOS school invitation', html: `<p>Hello ${escapeHtml(name)},</p><p>You have been invited to join your school on AtechOS as <strong>${escapeHtml(role.replace('_', ' '))}</strong>.</p><p><a href="${url}">Accept your invitation</a></p><p>This link expires in 7 days and requires confirmation of this email address.</p>` }),
    })
    if (response.ok) return { url, delivery: 'email' as const }
  } catch {
    // The invitation remains usable through its manual link. Do not expose provider details.
  }
  return { url, delivery: 'manual' as const, notice: 'The email was not sent. Share the private link manually.' }
}

export async function inviteMember(form: FormData): Promise<InvitationActionResult> {
  const email = String(form.get('email') || '').trim().toLowerCase()
  const name = String(form.get('full_name') || '').trim()
  const role = String(form.get('role') || '')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || !roles.includes(role)) {
    return { error: 'Verify the name, email and role.' }
  }
  // Check the link origin before writing an invitation. Otherwise a missing
  // Origin would leave an unshareable pending row in the database.
  const origin = (await headers()).get('origin')
  if (!origin) return { error: 'Unable to create the invitation. Please try again.' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in again.' }
  const { data, error } = await supabase.rpc('create_school_invitation', {
    p_email: email, p_full_name: name, p_role: role,
    p_student_id: String(form.get('student_id') || '') || null,
    p_parent_id: String(form.get('parent_id') || '') || null,
  })
  if (error) return { error: error.message }
  return deliverInvitation(origin, data.token, email, name, role)
}

export async function renewInvitation(id: string): Promise<InvitationActionResult> {
  const origin = (await headers()).get('origin')
  if (!origin) return { error: 'Unable to create the invitation. Please try again.' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in again.' }
  const { data: context, error: contextError } = await supabase.rpc('school_context')
  if (contextError || !context?.school_id) return { error: 'Unable to verify school access.' }
  const { data: invitation, error } = await supabase.from('school_invitations')
    .select('email,full_name,role,status,expires_at,student_id,parent_id')
    .eq('id', id).eq('school_id', context.school_id).maybeSingle()
  if (error || !invitation) return { error: 'Invitation not found or not available.' }
  if (!canRenewInvitation(invitation.status, invitation.expires_at)) return { error: 'Only expired or cancelled invitations can be renewed.' }
  const { data, error: createError } = await supabase.rpc('create_school_invitation', {
    p_email: invitation.email, p_full_name: invitation.full_name, p_role: invitation.role,
    p_student_id: invitation.student_id, p_parent_id: invitation.parent_id,
  })
  if (createError) return { error: createError.message }
  return deliverInvitation(origin, data.token, invitation.email, invitation.full_name, invitation.role)
}

export async function changeMember(id: string, action: string, role?: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('manage_school_member', { p_member_id: id, p_action: action, p_role: role || null })
  return { error: error?.message }
}

export async function cancelInvitation(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_school_invitation', { p_id: id })
  return { error: error?.message }
}
