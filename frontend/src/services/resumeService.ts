// resumeService.ts
// Database persistence functions used by the resume editor and profile page.

import { getUserId, getjwt } from '../lib/supabase'

const configuredApiUrl = String(import.meta.env.VITE_API_URL ?? '').trim()

function getApiBaseUrl() {
  const hostname = window.location.hostname
  const isLocalFrontend = hostname === 'localhost' || hostname === '127.0.0.1'

  // The Flask backend for local development runs on port 5000.
  // Call it directly instead of depending on a Vite proxy.
  if (isLocalFrontend) return 'http://127.0.0.1:5000'

  return (
    configuredApiUrl && configuredApiUrl !== 'your_api_url_here'
      ? configuredApiUrl
      : window.location.origin
  ).replace(/\/$/, '')
}

const api_url = getApiBaseUrl()


export type SavedResumeDisplayMeta = {
  filename: string
  kind: 'original' | 'tailored'
}

const SAVED_RESUME_META_KEY = 'jobcoachai.savedResumeMeta'

function readSavedResumeMeta(): Record<string, SavedResumeDisplayMeta> {
  try {
    const raw = localStorage.getItem(SAVED_RESUME_META_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function setSavedResumeDisplayMeta(
  resumeId: string,
  meta: SavedResumeDisplayMeta,
) {
  const current = readSavedResumeMeta()
  current[resumeId] = meta
  localStorage.setItem(SAVED_RESUME_META_KEY, JSON.stringify(current))
}

export function getSavedResumeDisplayMeta(resumeId: string) {
  return readSavedResumeMeta()[resumeId] ?? null
}

export function removeSavedResumeDisplayMeta(resumeId: string) {
  const current = readSavedResumeMeta()
  if (!(resumeId in current)) return
  delete current[resumeId]
  localStorage.setItem(SAVED_RESUME_META_KEY, JSON.stringify(current))
}

export type SavedResumeSummary = {
  id: string
  title?: string | null
  career_field?: string | null
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

  const responseText = await response.text()
  let body: any = {}

  if (responseText) {
    try {
      body = JSON.parse(responseText)
    } catch {
      // Flask/Vite may return HTML for an error response. Keep the body empty
      // and surface the HTTP status below instead of hiding it behind a
      // generic database error.
    }
  }

  if (!response.ok) {
    const serverMessage =
      (typeof body.error === 'string' && body.error) ||
      (typeof body.message === 'string' && body.message)

    throw new Error(
      serverMessage ||
      `Resume request failed (${response.status} ${response.statusText || 'HTTP error'}).`
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
