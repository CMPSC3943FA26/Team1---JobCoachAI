import type {
    Certification,
    Education,
    Project,
    Skill,
    WorkExperience,
  } from './resumeData'
  
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
  
  export type SuggestionTarget = {
    sectionKey: SectionKey
    entryIndex: number
    fieldKey: string
  }
  
  export type SuggestionChange = {
    suggestion: ResumeRecommendation
    target: SuggestionTarget
    newText: string
  }
  
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
  
  function overlapLength(left: string, right: string): number {
    const a = left.trim()
    const b = right.trim()
  
    if (!a || !b) return 0
    if (a === b) return Number.MAX_SAFE_INTEGER
    if (a.includes(b)) return b.length
    if (b.includes(a)) return a.length
  
    return 0
  }
  
  export function resolveSuggestionTarget(
    suggestion: ResumeRecommendation,
    sections: ResumeSectionLike[],
  ): SuggestionTarget | null {
    const sectionKey = normalizeSectionKey(suggestion.section_name)
  
    if (!sectionKey) return null
  
    const section = sections.find(
      (candidate) => candidate.key === sectionKey,
    )
  
    if (!section) return null
  
    let bestEntryIndex = -1
    let bestFieldKey = ''
    let bestScore = 0
  
    for (
      let entryIndex = 0;
      entryIndex < section.entries.length;
      entryIndex++
    ) {
      const entry = section.entries[entryIndex]
  
      const candidates: Array<[string, string]> =
        typeof entry === 'string'
          ? [['value', entry]]
          : Object.entries(entry).filter(
              (entryFields): entryFields is [string, string] =>
                typeof entryFields[1] === 'string',
            )
  
      for (const [fieldKey, value] of candidates) {
        const score = overlapLength(
          value,
          suggestion.original_text,
        )
  
        if (score > bestScore) {
          bestScore = score
          bestEntryIndex = entryIndex
          bestFieldKey = fieldKey
        }
      }
    }
  
    if (bestEntryIndex === -1) return null
  
    return {
      sectionKey,
      entryIndex: bestEntryIndex,
      fieldKey: bestFieldKey,
    }
  }
  
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