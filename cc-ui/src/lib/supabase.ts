import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null
let _url = ''
let _key = ''

export function getSupabase(url: string, anonKey: string): SupabaseClient | null {
  if (!url || !anonKey) return null
  if (_client && url === _url && anonKey === _key) return _client
  _client = createClient(url, anonKey)
  _url = url
  _key = anonKey
  return _client
}
