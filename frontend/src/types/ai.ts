
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

export type JobRequirement = {
  requirement: string
  group: string
  group_logic: 'all' | 'any'
  importance: 'required' | 'desired' | 'mentioned'
  direct_search_terms: string[]
  related_search_terms: string[]
}

export type JobRequirements = {
  requirements: JobRequirement[]
}

export type UserEvidence = {
  requirement: string
  evidence: string
  target_section:
    | 'Work Experience'
    | 'Professional Summary'
    | 'Projects'
    | 'Education'
    | 'Skills'
    | 'Certifications'
  source: 'user'
}

export type EvidenceSectionSuggestion = {
  requirement: string
  section_name: 'Professional Summary' | 'Work Experience' | 'Projects'
  action: 'add' | 'replace'
  original_text: string
  suggestion: string
  reason: string
  new_entry: {
    job_title?: string
    company?: string
    location?: string
    start_date?: string
    end_date?: string
    description: string
    name?: string
    link?: string
  } | null
}

export type EvidenceSuggestionResponse = {
  suggestions: EvidenceSectionSuggestion[]
}

export type RequirementEvidence = {
  resume_id: string
  source: 'resume' | 'user'
  reason: string
}

export type RequirementMatch = {
  requirement: string
  group: string
  group_logic: 'all' | 'any'
  group_classification: 'supported' | 'partial' | 'unsupported'
  importance: JobRequirement['importance']
  classification: 'supported' | 'partial' | 'unsupported'
  evidence: RequirementEvidence[]
}

// Response structure used by the ATS score panel.
export type AIResponse = {
  suggestions: Suggestion[]
  improvements: Improvement[]
  ATS_score: number
  requirements_met: { requirement: string }[]
  requirements_missing: number
  evidence?: RequirementMatch[]
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

export type SummaryGenerationResponse = {
  options: Array<Pick<SummaryOption, 'tone' | 'text'>>
}

export type TailoringResponse = AIResponse & {
  total_time_seconds?: number
  removals: { relevant_text: string; reason: string }[]
  missing_requirements: { requirement: string }[]
  requirements: JobRequirements
  evidence?: RequirementMatch[]
}

export type ResumeAnalysisResponse = AIResponse & {
  improvements: Improvement[]
  removals: { relevant_text: string; reason: string }[]
  missing_requirements: { requirement: string }[]
  requirements: JobRequirements
  evidence: RequirementMatch[]
}
