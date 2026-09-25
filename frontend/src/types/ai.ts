
/**
 * Shared AI response types for JobCoachAI.
 *
 * Used by:
 * - AtsScorePanel.tsx
 * - SummaryOptions.tsx
 * - resumeInsights.ts
 *
 * These definitions describe frontend data.
 * They do not modify the backend or database.
 */

// A resume requirement that is already satisfied.
export type Suggestion = {
  suggestion: string
  type: string
  requirement: string
  importance: number
  before: string
  reason: string
  resume_id: string
}

// A resume requirement that needs improvement.
export type Improvement = {
  improvement: string
  type: string
  requirement: string
  reason: string
  resume_id: string | null
}

// Response structure used by the ATS score panel.
export type AIResponse = {
  suggestions: Suggestion[]
  improvements: Improvement[]
  ATS_score: number
  requirements_met: number
  requirements_missing: number
}

// Supported professional summary tones.
export type SummaryTone =
  | 'executive'
  | 'technical'
  | 'concise'

// Individual professional summary option.
export type SummaryOption = {
  tone: SummaryTone
  title: string
  description: string
  text: string
}
