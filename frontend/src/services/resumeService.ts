// resumeService.ts
// Database persistence functions used by the resume editor and profile page.

import { getUserId, getjwt } from '../lib/supabase'

const api_url = import.meta.env.VITE_API_URL

export type SavedResumeSummary = {
  id: string
  full_name?: string | null
  email?: string | null
  phone?: string | null
  location?: string | null
  professional_summary?: string | null
  created_at?: string | null
  updated_at?: string | null
}

async function authorizedRequest(path: string, options: RequestInit = {}) {
  const jwt = await getjwt()
  const response = await fetch(`${api_url}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${jwt}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
  })

  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      body.error ?? body.message ?? 'Database request failed.'
    )
  }

  return body
}

export async function loadResumeFromDatabase(resume_id: string) {
  const userId = await getUserId()

  return authorizedRequest(
    `/resume/get_resume/${userId}/${resume_id}`
  )
}

export async function listResumesFromDatabase(): Promise<SavedResumeSummary[]> {
  const userId = await getUserId()

  const result = await authorizedRequest(
    `/resume/list_resumes/${userId}`
  )

  return Array.isArray(result.resumes)
    ? result.resumes
    : []
}

export async function saveResumeToDatabase(data: object) {
  const userId = await getUserId()

  return authorizedRequest(
    `/resume/add_resume/${userId}`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  )
}

export async function deleteResumeFromDatabase(
  resume_id: string
) {
  const userId = await getUserId()

  return authorizedRequest(
    `/resume/delete_resume/${userId}/${resume_id}`,
    {
      method: 'DELETE',
    }
  )
}

export async function updateResumeToDatabase(
  resume_id: string,
  data: object
) {
  const userId = await getUserId()

  return authorizedRequest(
    `/resume/update_resume/${userId}/${resume_id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    }
  )
}
