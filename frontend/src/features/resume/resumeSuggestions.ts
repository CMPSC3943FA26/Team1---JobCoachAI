import type {
  Certification,
  Education,
  Project,
  Skill,
  WorkExperience,
} from './resumeData'

// A single AI recommendation for a resume section (Issue #4 schema).
export type ResumeRecommendation = {
  section_name: string
  original_text: string
  suggested_change: string
  reasoning: string
}

export type SectionKey =
  | 'summary'
  | 'education'
  | 'work_experience'
  | 'skills'
  | 'projects'
  | 'certifications'

export type SectionEntry =
  | string
  | WorkExperience
  | Education
  | Skill
  | Project
  | Certification

export type ResumeSectionLike = {
  key: SectionKey
  entries: SectionEntry[]
}

// Where a suggestion maps to inside the live resume state.
export type SuggestionTarget = {
  sectionKey: SectionKey
  entryIndex: number
  fieldKey: string
}

// Emitted by ResumeSuggestions when the user accepts a change.
export type SuggestionChange = {
  suggestion: ResumeRecommendation
  target: SuggestionTarget
  newText: string
}

// Maps recommendation labels (e.g. "Work Experience") to editor section keys.
const sectionNameAliases: Record<string, SectionKey> = {
  summary: 'summary',
  'professional summary': 'summary',
  education: 'education',
  'work experience': 'work_experience',
  experience: 'work_experience',
  work_experience: 'work_experience',
  skills: 'skills',
  projects: 'projects',
  certifications: 'certifications',
  certification: 'certifications',
}

export function normalizeSectionKey(sectionName: string): SectionKey | null {
  const key = sectionName.trim().toLowerCase()
  return sectionNameAliases[key] ?? null
}

// Length of the shared text between two values; stronger matches score higher.
function overlapLength(left: string, right: string): number {
  const a = left.trim()
  const b = right.trim()
  if (!a || !b) return 0
  if (a === b) return Number.MAX_SAFE_INTEGER
  if (a.includes(b)) return b.length
  if (b.includes(a)) return a.length
  return 0
}

// Find the entry + field in the resume whose text matches the suggestion's
// original_text. Returns null when no section/entry/field can be located.
export function resolveSuggestionTarget(
  suggestion: ResumeRecommendation,
  sections: ResumeSectionLike[],
): SuggestionTarget | null {
  const sectionKey = normalizeSectionKey(suggestion.section_name)
  if (!sectionKey) return null

  const section = sections.find((candidate) => candidate.key === sectionKey)
  if (!section) return null

  let bestEntryIndex = -1
  let bestFieldKey = ''
  let bestScore = 0

  for (let entryIndex = 0; entryIndex < section.entries.length; entryIndex++) {
    const entry = section.entries[entryIndex]
    const candidates: Array<[string, string]> =
      typeof entry === 'string'
        ? [['value', entry]]
        : Object.entries(entry).filter(
            (entryFields): entryFields is [string, string] =>
              typeof entryFields[1] === 'string',
          )

    for (const [fieldKey, value] of candidates) {
      const score = overlapLength(value, suggestion.original_text)
      if (score > bestScore) {
        bestScore = score
        bestEntryIndex = entryIndex
        bestFieldKey = fieldKey
      }
    }
  }

  if (bestEntryIndex === -1) return null

  return { sectionKey, entryIndex: bestEntryIndex, fieldKey: bestFieldKey }
}

// Replace the original text inside a field value; when only part of a larger
// field matches, only that part is replaced so the rest of the text survives.
export function replaceTextInField(
  currentValue: string,
  originalText: string,
  newText: string,
): string {
  const original = originalText.trim()
  const replacement = newText.trim()

  if (original && currentValue.includes(original)) {
    return currentValue.replace(original, replacement)
  }

  return replacement
}

// Curated suggestions that match the built-in sample resume (Jordan Lee),
// used to demo edit/apply until the AI pipeline is connected.
export const sampleResumeRecommendations: ResumeRecommendation[] = [
  {
    section_name: 'Work Experience',
    original_text:
      'Led a redesign of the onboarding experience that improved activation by 28% and created a reusable design system with product and engineering.',
    suggested_change:
      'Spearheaded a full onboarding redesign that lifted activation by 32% and shipped a reusable design system in close partnership with product and engineering.',
    reasoning:
      "Replaced passive phrasing with a strong action verb ('Spearheaded'), added a concrete metric, and emphasized cross-functional collaboration matching the target job description.",
  },
  {
    section_name: 'Professional Summary',
    original_text:
      'Product-minded designer who turns complex problems into clear, intuitive experiences. You bring a thoughtful balance of user empathy, sharp visual craft, and cross-functional momentum.',
    suggested_change:
      'Product-minded designer who turns complex problems into clear, intuitive experiences with a proven balance of user empathy, sharp visual craft, and cross-functional momentum focused on measurable business impact.',
    reasoning:
      'Removed second-person phrasing for a professional third-person voice and added an impact-focused clause aligned with senior-level job postings.',
  },
  {
    section_name: 'Skills',
    original_text: 'Figma and prototyping',
    suggested_change: 'Figma, prototyping, and UI component libraries',
    reasoning:
      "Adds the keyword 'UI component libraries' that appears in the target job description and expands the current skill string.",
  },
  {
    section_name: 'Education',
    original_text: 'Interaction Design',
    suggested_change: 'Interaction Design (UX specialization track)',
    reasoning:
      'Clarifies the specialization in the education listing to better match UX-focused roles.',
  },
]

