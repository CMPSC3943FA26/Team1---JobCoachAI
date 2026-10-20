// Browser-local, per-Supabase-user workspace storage.
// This is not a secure replacement for server-side persistence.
import { resumeDraftStorageKey, resumeIdStorageKey } from '../pages/ResumePage'

const prefix = 'jobcoachai.workspace.'
const page3Key = 'jobcoachai.page3Draft'
const tailoredKey = 'jobcoachai.tailoredResumePayload'
const keys = [resumeDraftStorageKey, resumeIdStorageKey, page3Key, tailoredKey] as const

export function saveWorkspace(userId: string): void {
  if (!userId) throw new Error('User ID is required to save the workspace')
  const entries = Object.fromEntries(keys.map(key => [key, sessionStorage.getItem(key)]))
  localStorage.setItem(`${prefix}${userId}`, JSON.stringify({ entries, updatedAt: Date.now() }))
}

export function restoreWorkspace(userId: string): boolean {
  if (!userId) return false
  const raw = localStorage.getItem(`${prefix}${userId}`)
  // Always purge the previous session's working copy before loading another user.
  keys.forEach(key => sessionStorage.removeItem(key))
  if (!raw) return false
  try {
    const saved = JSON.parse(raw) as { entries?: Record<string, unknown> }
    keys.forEach(key => {
      const value = saved.entries?.[key]
      if (typeof value === 'string') sessionStorage.setItem(key, value)
    })
    return true
  } catch {
    return false
  }
}
