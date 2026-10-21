import { getSupabaseConfig } from './config'
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const { url, key } = getSupabaseConfig()
  return createBrowserClient(
    url,
    key
  )
}
