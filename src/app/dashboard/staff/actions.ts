'use server'

import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

const roles = ['school_admin', 'director', 'secretary', 'teacher', 'accountant', 'surveillant', 'parent', 'student']
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character)) }

export async function inviteMember(form: FormData) {
  const email = String(form.get('email') || '').trim().toLowerCase()
  const name = String(form.get('full_name') || '').trim()
  const role = String(form.get('role') || '')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || !roles.includes(role)) {
    return { error: 'Verify the name, email and role.' }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Please sign in again.' }
  const { data, error } = await supabase.rpc('create_school_invitation', {
    p_email: email, p_full_name: name, p_role: role,
    p_student_id: String(form.get('student_id') || '') || null,
    p_parent_id: String(form.get('parent_id') || '') || null,
  })
  if (error) return { error: error.message }
  // Next.js server actions validate the request origin. Tokens never enter logs or email providers.
  const origin = (await headers()).get('origin')
  if (!origin) return { error: 'Invitation created. Open the application directly and create a replacement link.' }
  const url = `${origin}/invite?token=${encodeURIComponent(data.token)}`
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

