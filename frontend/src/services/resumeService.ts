import type {
  JobRequirements,
  EvidenceSuggestionResponse,
  ResumeAnalysisResponse,
  TailoringResponse,
  UserEvidence,
} from '../types/ai'
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
  jobTitle?: string
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
const pendingTailoringRequests = new Map<string, Promise<TailoringResponse>>()

export async function tailor_resume(
  resume_id: string,
  job: { title: string; company: string; description: string },
): Promise<TailoringResponse> {
  const body = JSON.stringify({ resume_id, job })
  const pending = pendingTailoringRequests.get(body)
  if (pending) return pending

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 300_000)
  const request: Promise<TailoringResponse> = authorizedRequest('/ai/tailor_resume', {
    method: 'POST',
    body,
    signal: controller.signal,
  }).catch((cause: unknown) => {
    if (controller.signal.aborted) {
      throw new Error('AI analysis timed out. Please regenerate.')
    }
    throw cause
  })
  pendingTailoringRequests.set(body, request)
  try {
    return await request
  } finally {
    window.clearTimeout(timeout)
    pendingTailoringRequests.delete(body)
  }
}

function aiRequestPath(path: string, clientRequestId?: string) {
  return clientRequestId
    ? `${path}?client_request_id=${encodeURIComponent(clientRequestId)}`
    : path
}

const pendingAiRequests = new Map<string, Promise<unknown>>()

function deduplicatedAiRequest<T>(
  path: string,
  body: string,
  clientRequestId?: string,
  signal?: AbortSignal,
): Promise<T> {
  const key = `${path}:${body}`
  if (!signal) {
    const pending = pendingAiRequests.get(key)
    if (pending) return pending as Promise<T>
  }

  const request = authorizedRequest(aiRequestPath(path, clientRequestId), {
    method: 'POST',
    body,
    signal,
  }) as Promise<T>
  if (signal) return request

  pendingAiRequests.set(key, request)
  const clearPending = () => {
    if (pendingAiRequests.get(key) === request) {
      pendingAiRequests.delete(key)
    }
  }
  void request.then(clearPending, clearPending)
  return request
}

export async function analyze_resume(
  current_resume: object,
  job: { title: string; company: string; description: string },
  requirements?: JobRequirements,
  user_evidence: UserEvidence[] = [],
  client_request_id?: string,
  signal?: AbortSignal,
): Promise<ResumeAnalysisResponse> {
  return deduplicatedAiRequest(
    '/ai/analyze_resume',
    JSON.stringify({ current_resume, job, requirements, user_evidence }),
    client_request_id,
    signal,
  )
}

export async function generate_tailoring_suggestions(
  current_resume: object,
  job: { title: string; company: string; description: string },
  requirements: JobRequirements,
  analysis: ResumeAnalysisResponse,
  user_evidence: UserEvidence[] = [],
  unapplied_suggestions: {
    section_name: string
    original_text: string
    suggested_change: string
    reasoning: string
  }[] = [],
  client_request_id?: string,
  candidate_context = '',
  signal?: AbortSignal,
): Promise<TailoringResponse> {
  return deduplicatedAiRequest(
    '/ai/generate_suggestions',
    JSON.stringify({
      current_resume,
      job,
      requirements,
      analysis,
      user_evidence,
      unapplied_suggestions,
      candidate_context,
    }),
    client_request_id,
    signal,
  )
}

export async function generate_evidence_section_suggestions(
  current_resume: object,
  job: { title: string; company: string; description: string },
  requirements: JobRequirements,
  user_evidence: UserEvidence[],
  client_request_id?: string,
  signal?: AbortSignal,
): Promise<EvidenceSuggestionResponse> {
  return deduplicatedAiRequest(
    '/ai/generate_evidence_suggestions',
    JSON.stringify({ current_resume, job, requirements, user_evidence }),
    client_request_id,
    signal,
  )
}

// Frontend-only preview. Replace with a backend AI call once that endpoint is implemented.
export type KeywordRewriteResponse = { suggestions: Record<string, string>; note?: string }
export async function rewriteKeywordExperience(_keyword: string, experience: string, sections: string[]): Promise<KeywordRewriteResponse> {
  const cleaned = experience.trim().replace(/\s+/g, ' ')
  if (cleaned.length < 15) return { suggestions: {}, note: 'Please provide more detail about what you actually did.' }
  const description = cleaned.replace(/[.!?]+$/, '')
  const suggestions: Record<string, string> = {}
  for (const section of sections) {
    if (section === 'Work Experience') suggestions[section] = `${description}.`
    if (section === 'Professional Summary') suggestions[section] = `Familiar with the following through reported experience: ${description}.`
  }
  return { suggestions, note: 'Frontend-only preview, not AI-generated. Check accuracy and edit each draft before applying. The AI rewrite endpoint is not connected yet.' }
}

// Frontend-only wording examples. No AI assessment or verification is performed.
export function previewKeywordWording(keyword: string, experience: string, sections: string[]): Record<string, string[]> {
  const evidence = experience.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '')
  const result: Record<string, string[]> = {}
  for (const section of sections) {
    if (section === 'Work Experience') result[section] = [
      `${evidence}.`,
    ]
    if (section === 'Professional Summary') result[section] = [
      `Familiar with ${keyword} through the following experience: ${evidence}.`,
    ]
  }
  return result
}

export async function regenerate_tailor(
  current_resume: object,
  job: {title: string; company: string; description:string},
  requirements: JobRequirements | undefined,
  unapplied_suggestions: { section_name: string; original_text: string; suggested_change: string; reasoning: string }[],
  candidate_context = '',
): Promise<TailoringResponse> {
  const body = JSON.stringify({
    current_resume,
    job,
    requirements,
    unapplied_suggestions,
    candidate_context,
  })
  const request: Promise<TailoringResponse> = authorizedRequest('/ai/regenerate_resume', {
    method: 'POST',
    body,
  })
  return await request
}
  
