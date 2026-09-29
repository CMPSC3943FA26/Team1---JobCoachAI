import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase environment variables')
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

  if (response.error) {
    throw new Error('Error signing in')
  }

  return response
}

export async function getjwt() {
  const { data } = await supabase.auth.getSession()

  if (data.session === null) {
    throw new Error('No active session')
  }

  return data.session.access_token
}

// Create a new user account and store the user's name in auth metadata.
export async function signUp(
  email: string,
  password: string,
  firstName: string,
  lastName: string
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      },
    },
  })

  if (error) {
    if (
      error.message.toLowerCase().includes('already registered')
    ) {
      throw new Error(
        'An account with this email already exists. Please log in.'
      )
    }

    throw error
  }

  if (
    data.user &&
    Array.isArray(data.user.identities) &&
    data.user.identities.length === 0
  ) {
    throw new Error(
      'An account with this email already exists. Please log in.'
    )
  }

  return data
}

// Log in an existing user.
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw error
  }

  return data
}

export async function updateCurrentUserProfile(input: {
  firstName: string
  lastName: string
  email: string
  phone: string
  location: string
}) {
  const { data: current, error: currentError } = await supabase.auth.getUser()

  if (currentError) throw currentError
  if (!current.user) throw new Error('No active user session.')

  const trimmedEmail = input.email.trim()
  const emailChanged = trimmedEmail !== (current.user.email ?? '')

  const { data, error } = await supabase.auth.updateUser({
    ...(emailChanged ? { email: trimmedEmail } : {}),
    data: {
      ...current.user.user_metadata,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      phone: input.phone.trim(),
      location: input.location.trim(),
    },
  })

  if (error) throw error
  return data
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
