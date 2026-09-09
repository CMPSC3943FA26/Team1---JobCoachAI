// resumeService.ts
// Persistence layer hook for future database work.
// This is intentionally kept separate from the screen/component code so the UI remains clear.

import { initialResume } from '../features/resume/resumeData'

export async function loadResumeFromDatabase() {
  // Replace this with a real Supabase query later.
  return initialResume
}

export async function saveResumeToDatabase(data: typeof initialResume) {
  // Replace this with a real Supabase insert/update later.
  console.log('Resume ready to persist:', data)
  return data
}
