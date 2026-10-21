'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function acceptInvitation() {
  const jar = await cookies()
  const token = jar.get('atechos_invitation')?.value
  if (!token) return { error: 'Open your invitation link again.' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sign in using the email address that received the invitation.' }
  const { error } = await supabase.rpc('accept_school_invitation', { p_token: token })
  if (error) return { error: 'This invitation cannot be accepted. Verify your email address, or ask your school for a new link.' }
  jar.delete('atechos_invitation')
  redirect('/dashboard')
}

export async function dismissInvitation() {
  (await cookies()).delete('atechos_invitation')
  redirect('/onboarding')
}

