import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!supabaseUrl || !supabasePublishableKey) {
  
throw new Error (
'Missing Supabase environment variables'
)
}
export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
)

export async function getUserId() {
  const { data } = await supabase.auth.getSession()
  if (data.session === null) {
    throw new Error('No active session')
  }
  return data.session.user.id
}
export async function signInAsGuest() {
  const response = await supabase.auth.signInAnonymously()
  if(response.error) {
    throw new Error('error signing in')
  }
    return response
}
export async function getjwt() {
  const { data } = await supabase.auth.getSession()
  if (data.session === null)
    throw new Error('No active session')
  return data.session.access_token
}


