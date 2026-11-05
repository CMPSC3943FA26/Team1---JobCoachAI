/**
 * JobCoachAI — Tailor-only analysis and suggestion panels.
 *
 *
 * ATS score is local keyword matching, NOT an official ATS score.
 * Suggestions are returned by the backend AI tailoring service.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { buildDownloadResume, downloadSavedResumeDocx, downloadSavedResumePdf } from './ProfilePage'
import { AtsScorePanel } from '../components/AtsScorePanel'
import { ResumePreview, type PreviewSection } from '../components/ResumePreview'
import { SummaryOptions } from '../components/SummaryOptions'
import { ResumeSuggestions } from '../components/ResumeSuggestions'
import { TailoringLoading } from '../components/TailoringLoading'
import { replaceTextInField } from '../features/resume/resumeSuggestions'
import { addedWordMask } from '../features/resume/addedWords'
import {
  analyze_resume,
  generate_evidence_section_suggestions,
  generate_professional_summary_options,
  generate_tailoring_suggestions,
  setSavedResumeDisplayMeta,
} from '../services/resumeService'
import type {
  Project,
  ResumeProfile,
  ResumeSaveRequest,
  WorkExperience,
} from '../features/resume/resumeData'
import type { ResumeRecommendation, SuggestionChange } from '../features/resume/resumeSuggestions'
import type {
  ResumeAnalysisResponse,
  Improvement,
  SummaryGenerationResponse,
  SummaryOption,
  SummaryTone,
  TailoringResponse,
  UserEvidence,
} from '../types/ai'

// Matches the exact prop type expected by the existing Kiran component.
type Sections = ComponentProps<typeof ResumeSuggestions>['sections']
// The saved ResumePage draft includes a display title; Kiran's component only
// requires the key and entries, so preserve the optional draft-only field.
type TailorSection = Sections[number] & { title?: string }
type Draft = {
  profile: ResumeProfile
  sections: TailorSection[]
  filename: string
  jobTitle?: string
}
const DRAFT_KEY = 'jobcoachai.resumeDraft'
export const TAILORED_PAYLOAD_KEY = 'jobcoachai.tailoredResumePayload'
export const TAILORED_DISPLAY_META_KEY = 'jobcoachai.tailoredResumeDisplayMeta'
// TailorPage must call this helper AFTER its Save Tailored Resume request succeeds,
// passing the returned tailored resume ID; resume title and job title are stored separately.
export function rememberSavedTailoredResume(savedTailoredResumeId: string): void {
  const raw = sessionStorage.getItem(TAILORED_DISPLAY_META_KEY)
  if (!raw) return
  try {
    const meta = JSON.parse(raw) as { filename?: string; jobTitle?: string }
    setSavedResumeDisplayMeta(savedTailoredResumeId, {
      filename: (meta.filename ?? 'resume').trim().replace(/-(original|tailored)$/i, '') || 'resume',
      jobTitle: (meta.jobTitle ?? '').trim(),
      kind: 'tailored',
    })
  } catch (error) {
    console.warn('Could not restore tailored resume display metadata:', error)
  }
}
const skillKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
const summaryToneCopy: Record<SummaryTone, Pick<SummaryOption, 'title' | 'description'>> = {
  executive: {
    title: 'Executive / Results-focused',
    description: 'Leadership-oriented tone emphasizing outcomes and impact.',
  },
  technical: {
    title: 'Technical',
    description: 'Skill-forward tone that highlights your technical strengths.',
  },
  concise: {
    title: 'Concise',
    description: 'Short and punchy summary perfect for quick scans.',
  },
}
function mapSummaryOptions(response: SummaryGenerationResponse): SummaryOption[] {
  return response.options.map((option) => ({
    ...summaryToneCopy[option.tone],
    ...option,
  }))
}
function readDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const draft: unknown = JSON.parse(raw)
    if (!draft || typeof draft !== 'object') return null
    const d = draft as Partial<Draft>
    if (!d.profile || !Array.isArray(d.sections)) return null
    // Do not share object references with the original draft.
    return JSON.parse(JSON.stringify(d)) as Draft
  } catch {
    return null
  }
}
function asEntries<K extends 'work_experience' | 'education' | 'skills' | 'projects' | 'certifications'>(
  sections: Sections,
  key: K,
): ResumeSaveRequest[K] {
  const entries = sections.find((section) => section.key === key)?.entries ?? []
  // Stored resume sections are the same typed records ResumePage saves.
  return entries.filter((entry) => typeof entry !== 'string' &&
    Object.values(entry).some((value) => typeof value === 'string' && value.trim() !== '')) as ResumeSaveRequest[K]
}
function payloadFromDraft(draft: Draft): ResumeSaveRequest {
  const summaryEntry = draft.sections.find((section) => section.key === 'summary')?.entries[0]
  return {
    resume: {
      title: draft.filename.trim() || undefined,
      job_title: draft.jobTitle?.trim() || null,
      full_name: `${draft.profile.first_name} ${draft.profile.last_name}`.trim(),
      email: draft.profile.email,
      phone: draft.profile.phone,
      location: draft.profile.location,
      professional_summary: typeof summaryEntry === 'string'
        ? summaryEntry : draft.profile.professional_summary,
    },
    section_order: draft.sections.map((section, index) => ({
      section_name: section.key as ResumeSaveRequest['section_order'][number]['section_name'],
      section_order: index,
    })),
    work_experience: asEntries(draft.sections, 'work_experience'),
    education: asEntries(draft.sections, 'education'),
    skills: asEntries(draft.sections, 'skills'),
    projects: asEntries(draft.sections, 'projects'),
    certifications: asEntries(draft.sections, 'certifications'),
  }
}
function sectionNameFromPath(path: string): string {
  const section = path.replace(/^resume\./, '').split(/[.\[]/)[0]
  const labels: Record<string, string> = {
    professional_summary: 'Professional Summary',
    work_experience: 'Work Experience',
    education: 'Education',
    skills: 'Skills',
    projects: 'Projects',
    certifications: 'Certifications',
  }
  return labels[section] ?? 'Other'
}
function recommendationKey(recommendation: ResumeRecommendation): string {
  return JSON.stringify([
    recommendation.section_name,
    recommendation.original_text,
    recommendation.suggested_change,
  ])
}
function createRecommendation(
  recommendation: Omit<ResumeRecommendation, 'id'>,
): ResumeRecommendation {
  return {
    ...recommendation,
    id: crypto.randomUUID(),
  }
}
function jobRequirementsKey(job: { title: string; company: string; description: string }): string {
  return JSON.stringify([job.title, job.company, job.description])
}
function analysisInputKey(
  resume: object,
  job: { title: string; company: string; description: string },
  userEvidence: UserEvidence[],
): string {
  return JSON.stringify([resume, job, userEvidence])
}
export interface TailorResumeInsightsProps {
  jobDescription: string
  title: string
  company: string
  resume_id: string
  onTailoredReadyChange?: (ready: boolean) => void
}
export function TailorResumeInsights({ jobDescription,title,company,resume_id, onTailoredReadyChange }: TailorResumeInsightsProps) {
  const [tailored, setTailored] = useState<Draft | null>(readDraft)
  const [baseDraft, setBaseDraft] = useState<Draft | null>(readDraft)
  const [changedFields, setChangedFields] = useState<Set<string>>(() => new Set())
  const [summaryOptions, setSummaryOptions] = useState<SummaryOption[]>([])
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState('')
  const [appliedTone, setAppliedTone] = useState<SummaryTone | null>(null)
  const [recommendations, setRecommendations] = useState<ResumeRecommendation[]>([])
  const [analysis, setAnalysis] = useState<ResumeAnalysisResponse | null>(null)
  const [analysisKey, setAnalysisKey] = useState<string | null>(null)
  const [requirementsJobKey, setRequirementsJobKey] = useState<string | null>(null)
  const [appliedRecommendationKeys, setAppliedRecommendationKeys] = useState<Set<string>>(
    () => new Set(),
  )
  const [message, setMessage] = useState('')
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [showResetConfirmation, setShowResetConfirmation] = useState(false)
  const [hiddenAtsKeywords, setHiddenAtsKeywords] = useState<Set<string>>(() => new Set())
  const [manuallyFoundSkills, setManuallyFoundSkills] = useState<string[]>([])
  const [userEvidence, setUserEvidence] = useState<UserEvidence[]>([])
  const [evidenceImprovement, setEvidenceImprovement] = useState<Improvement | null>(null)
  const [improvementEvidenceText, setImprovementEvidenceText] = useState('')
  const [improvementEvidenceSection, setImprovementEvidenceSection] =
    useState<
      Extract<
        UserEvidence['target_section'],
        'Work Experience' | 'Projects' | 'Professional Summary'
      >
    >('Work Experience')
  const [loading,setLoading]=useState(false)
  const [loadingStage, setLoadingStage] = useState<'analysis' | 'suggestions'>('analysis')
  const [regenerating, setRegenerating] = useState(false)
  const [addingEvidence, setAddingEvidence] = useState(false)
  const [updatingRequirements, setUpdatingRequirements] = useState<string[]>([])
  const [error,setError]=useState<string>('')
  const [result, setResult] = useState<TailoringResponse | null>(null)
  const activeAiRequests = useRef(new Set<AbortController>())
  const summaryRequestVersion = useRef(0)
  const manualSummaryKey = useRef(JSON.stringify([]))
  const cancelAiRequests = () => {
    summaryRequestVersion.current += 1
    for (const controller of activeAiRequests.current) controller.abort()
    activeAiRequests.current.clear()
    setLoading(false)
    setSummaryLoading(false)
    setRegenerating(false)
    setAddingEvidence(false)
    setUpdatingRequirements([])
  }
  const requestSummaryOptions = useCallback(async (
    currentResume: object,
    job: { title: string; company: string; description: string },
    clientRequestId: string,
    signal: AbortSignal,
  ): Promise<boolean> => {
    const requestVersion = ++summaryRequestVersion.current
    setSummaryLoading(true)
    setSummaryError('')
    try {
      const response = await generate_professional_summary_options(
        currentResume,
        job,
        clientRequestId,
        signal,
      )
      if (signal.aborted || requestVersion !== summaryRequestVersion.current) return false
      setSummaryOptions(mapSummaryOptions(response))
      setAppliedTone(null)
      return true
    } catch (error) {
      if (!signal.aborted && requestVersion === summaryRequestVersion.current) {
        setSummaryError(
          error instanceof Error ? error.message : 'Could not generate professional summaries.',
        )
      }
      return false
    } finally {
      if (requestVersion === summaryRequestVersion.current) setSummaryLoading(false)
    }
  }, [])
  // Keyword changes affect the local ATS estimate immediately. AI suggestions
  // are regenerated explicitly using the requirements from the first response.
  // Keep the latest live tailored copy available to TailorPage's Save button.
  // This stores a save-ready payload, not the original base resume draft.
  useEffect(() => {
    if (!tailored) {
      sessionStorage.removeItem(TAILORED_PAYLOAD_KEY)
      sessionStorage.removeItem(TAILORED_DISPLAY_META_KEY)
      return
    }
    sessionStorage.setItem(TAILORED_PAYLOAD_KEY, JSON.stringify(payloadFromDraft(tailored)))
    // Keep display metadata local as a fallback; the save payload persists this
    // associated job title separately from the resume name.
    sessionStorage.setItem(TAILORED_DISPLAY_META_KEY, JSON.stringify({
      filename: tailored.filename,
      jobTitle: title.trim(),
    }))
  }, [tailored, title])
  // Return the Stage 2 ATS result before awaiting Stage 3 suggestions.
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const summaryController = new AbortController()
    activeAiRequests.current.add(controller)
    activeAiRequests.current.add(summaryController)
    async function tailoring_resume() {
      setLoading(true)
      setLoadingStage('analysis')
      setError('')
      setSummaryOptions([])
      setSummaryError('')
      setResult(null)
      setAnalysis(null)
      setAnalysisKey(null)
      setRecommendations([])
      setAppliedRecommendationKeys(new Set())
      setRequirementsJobKey(null)
      setUserEvidence([])
      setSuggestionsOpen(true)
      try {
        const draft = readDraft()
        if (!draft) throw new Error('No local resume draft found.')
        const currentResume = payloadFromDraft(draft)
        const job = { title, company, description: jobDescription }
        const clientRequestId = crypto.randomUUID()
        manualSummaryKey.current = JSON.stringify([])
        void requestSummaryOptions(
          currentResume,
          job,
          clientRequestId,
          summaryController.signal,
        ).finally(() => activeAiRequests.current.delete(summaryController))
        const matched = await analyze_resume(
          currentResume, job, undefined, [], clientRequestId, controller.signal,
        )
        if (cancelled || controller.signal.aborted) return
        setAnalysis(matched)
        setAnalysisKey(analysisInputKey(currentResume, job, []))
        setResult(matched)
        setRequirementsJobKey(jobRequirementsKey(job))
        setAppliedRecommendationKeys(new Set())
        setManuallyFoundSkills([])
        setHiddenAtsKeywords(new Set())

        setLoadingStage('suggestions')
        const response = await generate_tailoring_suggestions(
          currentResume,
          job,
          matched.requirements,
          matched,
          [],
          [],
          clientRequestId,
          '',
          controller.signal,
        )
        if (cancelled || controller.signal.aborted) return
        setResult({ ...matched, ...response })
        setRecommendations(response.suggestions.map((item) => createRecommendation({
          section_name: sectionNameFromPath(item.resume_id),
          original_text: item.before,
          suggested_change: item.suggestion,
          reasoning: item.reason,
        })))
      } catch (error) {
        if (!cancelled && !controller.signal.aborted) {
          setError(error instanceof Error ? error.message : 'Tailoring failed.')
        }
      } finally {
        activeAiRequests.current.delete(controller)
        if (!cancelled && !controller.signal.aborted) setLoading(false)
      }
    }
    // StrictMode runs an extra setup/cleanup cycle in development. Defer the
    // request so that the discarded first effect can be cancelled before it
    // starts any backend work.
    const startTimer = window.setTimeout(() => {
      void tailoring_resume()
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(startTimer)
      controller.abort()
      summaryController.abort()
      activeAiRequests.current.delete(controller)
      activeAiRequests.current.delete(summaryController)
    }
  }, [resume_id, title, company, jobDescription, requestSummaryOptions])
  async function regenerateSuggestions(
    evidenceForGeneration = userEvidence,
    targetedRequirement?: string,
  ) {
    if (!tailored || !result) return
    const controller = new AbortController()
    activeAiRequests.current.add(controller)
    setRegenerating(true)
    setUpdatingRequirements(targetedRequirement ? [skillKey(targetedRequirement)] : [])
    setError('')
    try {
      const confirmed = manuallyFoundSkills
      const removed = [...hiddenAtsKeywords]
      const candidateContext = confirmed.length || removed.length
        ? `\n\nCandidate ATS review notes (unverified UI selections, not job requirements):` +
          (confirmed.length ? `\nUser marked as found: ${confirmed.join(', ')}.` : '') +
          (removed.length ? `\nUser removed from found: ${removed.join(', ')}.` : '') +
          `\nOnly suggest experience supported by the actual resume. Do not invent skills.`
        : ''
      const job = { title, company, description: jobDescription }
      const currentResume = payloadFromDraft(tailored)
      const clientRequestId = crypto.randomUUID()
      const cachedRequirements = requirementsJobKey === jobRequirementsKey(job)
        ? result.requirements
        : undefined
      const currentAnalysisKey = analysisInputKey(currentResume, job, evidenceForGeneration)
      const matched = analysis && analysisKey === currentAnalysisKey
        ? analysis
        : await analyze_resume(
          currentResume,
          job,
          cachedRequirements,
          evidenceForGeneration,
          clientRequestId,
          controller.signal,
        )
      if (controller.signal.aborted) return
      setAnalysis(matched)
      setAnalysisKey(currentAnalysisKey)
      setRequirementsJobKey(jobRequirementsKey(job))
      const response = await generate_tailoring_suggestions(
        currentResume,
        job,
        matched.requirements,
        matched,
        evidenceForGeneration,
        recommendations.filter(
          (recommendation) =>
            !appliedRecommendationKeys.has(recommendationKey(recommendation)),
        ),
        clientRequestId,
        candidateContext,
        controller.signal,
      )
      if (controller.signal.aborted) return
      if (!Array.isArray(response.suggestions)) {
        throw new Error('Invalid tailoring response.')
      }
      setResult({ ...matched, ...response })
      setRequirementsJobKey(jobRequirementsKey(job))
      setAppliedRecommendationKeys(new Set())
      setRecommendations(response.suggestions.map((item) => createRecommendation({
        section_name: sectionNameFromPath(item.resume_id),
        original_text: item.before,
        suggested_change: item.suggestion,
        reasoning: item.reason,
      })))
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(error instanceof Error ? error.message : 'Tailoring failed.')
      }
    } finally {
      activeAiRequests.current.delete(controller)
      if (!controller.signal.aborted) {
        setRegenerating(false)
        setUpdatingRequirements([])
      }
    }
  }
  function saveImprovementEvidence(regenerate: boolean) {
    if (!evidenceImprovement || !improvementEvidenceText.trim()) return
    const newEvidence: UserEvidence = {
      requirement: evidenceImprovement.requirement,
      evidence: improvementEvidenceText.trim(),
      target_section: improvementEvidenceSection,
      source: 'user',
    }
    const nextEvidence = userEvidence.some((item) =>
      item.requirement === newEvidence.requirement &&
      item.evidence === newEvidence.evidence &&
      item.target_section === newEvidence.target_section)
      ? userEvidence
      : [...userEvidence, newEvidence]
    setUserEvidence(nextEvidence)
    setEvidenceImprovement(null)
    setImprovementEvidenceText('')
    setMessage(regenerate
      ? 'Evidence saved. Regenerating AI suggestions…'
      : 'Evidence saved for the next time you regenerate AI suggestions.')
    if (regenerate) {
      void regenerateSuggestions(nextEvidence, newEvidence.requirement)
    }
  }
  useEffect(() => {
    onTailoredReadyChange?.(changedFields.size > 0)
  }, [changedFields, onTailoredReadyChange])
  // Keyword dismissals are display-only and reset for a new job description.
  useEffect(() => {
    setHiddenAtsKeywords(new Set())
    setManuallyFoundSkills([])
    setUserEvidence([])
    setEvidenceImprovement(null)
    setImprovementEvidenceText('')
    setAnalysis(null)
    setAnalysisKey(null)
  }, [jobDescription])

  // Interactive ATS display: a moved/added keyword appears under Found, while
  // clicking X moves it out of Found and into Missing. Recompute the local
  // compatibility estimate from the currently visible keyword classifications.
  // The score is a user-adjusted estimate, not a new backend AI assessment.
  const interactiveatsresponse = useMemo((): TailoringResponse | null => {
    if (!result) return null

    const found = new Map<string, TailoringResponse['requirements_met'][number]>()
    const missing = new Map<string, TailoringResponse['missing_requirements'][number]>()

    for (const item of result.requirements_met) {
      const key = skillKey(item.requirement)
      if (key && !hiddenAtsKeywords.has(key)) found.set(key, item)
    }
    for (const item of result.missing_requirements) {
      const key = skillKey(item.requirement)
      if (key) missing.set(key, item)
    }
    for (const keyword of manuallyFoundSkills) {
      const key = skillKey(keyword)
      if (!key || hiddenAtsKeywords.has(key)) continue
      if (!found.has(key)) found.set(key, {
        requirement: keyword,
      })
      missing.delete(key)
    }
    for (const keyword of hiddenAtsKeywords) {
      const original = result.requirements_met.find(
        (item) => skillKey(item.requirement) === keyword,
      )
      const evidence = result.evidence?.find(
        (item) => skillKey(item.group || item.requirement) === keyword,
      )
      if (original || evidence) {
        missing.set(keyword, {
          requirement: original?.requirement
            ?? evidence?.group
            ?? evidence?.requirement
            ?? keyword,
        })
      }
      found.delete(keyword)
    }
    // Treat each visible keyword once, even when the raw analyzer overlaps.
    for (const keyword of found.keys()) missing.delete(keyword)
    const requirements_met = found.size
    const requirements_missing = missing.size
    const requirementKeys = new Set(
      result.requirements.requirements.map((item) =>
        skillKey(item.group || item.requirement)),
    )
    const partial = new Set(
      (result.evidence ?? [])
        .filter((item) => item.group_classification === 'partial')
        .map((item) => skillKey(item.group || item.requirement))
        .filter((key) => requirementKeys.has(key)
          && !missing.has(key)
          && !manuallyFoundSkills.some((skill) => skillKey(skill) === key)
          && !hiddenAtsKeywords.has(key)),
    )
    const total = requirementKeys.size
    const hasKeywordChanges =
      manuallyFoundSkills.length > 0 || hiddenAtsKeywords.size > 0
    return {
      ...result,
      requirements_met: [...found.values()],
      missing_requirements: [...missing.values()],
      requirements_missing,
      ATS_score: hasKeywordChanges
        ? (total
          ? Math.round((requirements_met + 0.5 * partial.size) / total * 100)
          : 0)
        : result.ATS_score,
    }
  }, [result, hiddenAtsKeywords, manuallyFoundSkills])

  const refreshBaseResume = () => {
    cancelAiRequests()
    setTailored(readDraft())
    setBaseDraft(readDraft())
    setChangedFields(new Set())
    setHiddenAtsKeywords(new Set())
    setManuallyFoundSkills([])
    setUserEvidence([])
    setAnalysis(null)
    setAnalysisKey(null)
    setSummaryOptions([])
    setSummaryError('')
    setAppliedTone(null)
    setRecommendations([])
    setAppliedRecommendationKeys(new Set())
    setError('')
    setMessage('A fresh tailored copy was loaded. Your original resume was not changed.')
  }
  const addUserEvidence = async (items: UserEvidence[]): Promise<string | null> => {
    if (!tailored || !result) return 'No tailored resume is available.'
    if (!items.length || items.some((item) => !item.evidence.trim())) {
      return 'Please provide evidence before generating suggestions.'
    }
    const controller = new AbortController()
    activeAiRequests.current.add(controller)
    const nextEvidence = [...userEvidence]
    for (const item of items) {
      if (!nextEvidence.some((existing) =>
        existing.requirement === item.requirement &&
        existing.evidence === item.evidence &&
        existing.target_section === item.target_section)) {
        nextEvidence.push(item)
      }
    }
    setUserEvidence(nextEvidence)
    setAddingEvidence(true)
    setUpdatingRequirements([...new Set(items.map((item) => skillKey(item.requirement)))])
    setError('')
    try {
      const currentResume = payloadFromDraft(tailored)
      const job = { title, company, description: jobDescription }
      const clientRequestId = crypto.randomUUID()
      const cachedRequirements = requirementsJobKey === jobRequirementsKey(job)
        ? result.requirements
        : undefined
      const matched = await analyze_resume(
        currentResume,
        job,
        cachedRequirements,
        nextEvidence,
        clientRequestId,
        controller.signal,
      )
      if (controller.signal.aborted) return 'Evidence generation was canceled.'
      setAnalysis(matched)
      setAnalysisKey(analysisInputKey(currentResume, job, nextEvidence))
      setRequirementsJobKey(jobRequirementsKey(job))
      setResult((current) => current ? {
        ...matched,
        suggestions: current.suggestions,
        improvements: current.improvements,
        removals: current.removals,
      } : matched)
      setManuallyFoundSkills((current) => [...new Set([
        ...current,
        ...items.map((item) => item.requirement),
      ])])
      setHiddenAtsKeywords((current) => {
        const updated = new Set(current)
        for (const item of items) updated.delete(skillKey(item.requirement))
        return updated
      })
      const suggestions = await generate_evidence_section_suggestions(
        currentResume,
        job,
        matched.requirements,
        items,
        clientRequestId,
        controller.signal,
      )
      if (controller.signal.aborted) return 'Evidence generation was canceled.'
      const additions = suggestions.suggestions.map((item) => {
        const newEntry: WorkExperience | Project | undefined =
          item.new_entry && item.section_name === 'Work Experience'
            ? {
              job_title: item.new_entry.job_title ?? '',
              company: item.new_entry.company ?? '',
              location: item.new_entry.location ?? '',
              start_date: item.new_entry.start_date ?? '',
              end_date: item.new_entry.end_date ?? '',
              description: item.new_entry.description,
            }
            : item.new_entry && item.section_name === 'Projects'
              ? {
                name: item.new_entry.name ?? '',
                description: item.new_entry.description,
                link: item.new_entry.link ?? '',
              }
              : undefined
        return createRecommendation({
          section_name: item.section_name,
          original_text: item.original_text,
          suggested_change: item.suggestion || newEntry?.description || '',
          reasoning: item.reason || 'Based on the experience you provided.',
          ...(newEntry ? { new_entry: newEntry } : {}),
        })
      })
      setRecommendations((current) => [...current, ...additions])
      const evidenceKeywords = items.map((item) => skillKey(item.requirement))
      const addressedRequirements = new Set(
        matched.requirements.requirements
          .filter((requirement) => [
            requirement.requirement,
            ...requirement.direct_search_terms,
          ].some((term) => {
            const normalizedTerm = skillKey(term)
            return evidenceKeywords.some((keyword) =>
              normalizedTerm === keyword ||
              normalizedTerm.startsWith(`${keyword} `) ||
              normalizedTerm.includes(` ${keyword} `))
          }))
          .map((requirement) => skillKey(requirement.requirement)),
      )
      setResult((current) => current ? {
        ...current,
        improvements: current.improvements.filter(
          (improvement) => !addressedRequirements.has(skillKey(improvement.requirement)),
        ),
      } : current)
      setSuggestionsOpen(true)
      return null
    } catch (error) {
      if (controller.signal.aborted) return 'Evidence generation was canceled.'
      const message = error instanceof Error ? error.message : 'Could not generate AI suggestions.'
      setError(message)
      return message
    } finally {
      activeAiRequests.current.delete(controller)
      if (!controller.signal.aborted) {
        setAddingEvidence(false)
        setUpdatingRequirements([])
      }
    }
  }
  const removeAtsKeyword = (keyword: string) => {
    const key = skillKey(keyword)
    setManuallyFoundSkills((current) => current.filter((item) => skillKey(item) !== key))
    setHiddenAtsKeywords((current) => new Set(current).add(key))
  }
  // Keep the summary request in sync with manually confirmed ATS keywords.
  useEffect(() => {
    const key = JSON.stringify(manuallyFoundSkills)
    if (key === manualSummaryKey.current) return
    manualSummaryKey.current = key
    if (!tailored || !jobDescription.trim()) return
    const payload = payloadFromDraft(tailored)
    const skills = [...payload.skills.map((item) => item.skill_name).filter(Boolean)]
    const known = new Set(skills.map(skillKey))
    for (const keyword of manuallyFoundSkills) {
      if (!known.has(skillKey(keyword))) {
        skills.push(keyword)
        known.add(skillKey(keyword))
      }
    }
    const controller = new AbortController()
    activeAiRequests.current.add(controller)
    void requestSummaryOptions({
      ...payload,
      skills: skills.map((skill_name, index) => ({
        skill_name,
        sort_order: index,
      })),
    }, { title, company, description: jobDescription }, crypto.randomUUID(), controller.signal)
      .finally(() => activeAiRequests.current.delete(controller))
    return () => {
      controller.abort()
      activeAiRequests.current.delete(controller)
    }
  // Updates when ATS keyword additions/removals change, not on every preview edit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manuallyFoundSkills, jobDescription, requestSummaryOptions])
  const regenerateSummaries = async () => {
    if (!tailored) {
      setMessage('Build a resume first, then return to this page.')
      return
    }
    if (!jobDescription.trim()) {
      setMessage('Paste a job description before analyzing.')
      return
    }
    const controller = new AbortController()
    activeAiRequests.current.add(controller)
    try {
      const payload = payloadFromDraft(tailored)
      const existing = new Set(payload.skills.map((skill) => skillKey(skill.skill_name)))
      const additionalSkills = manuallyFoundSkills
        .filter((keyword) => !existing.has(skillKey(keyword)))
        .map((skill_name, index) => ({ skill_name, sort_order: payload.skills.length + index }))
      const refreshed = await requestSummaryOptions({
        ...payload,
        skills: [...payload.skills, ...additionalSkills],
      }, { title, company, description: jobDescription }, crypto.randomUUID(), controller.signal)
      if (refreshed) {
        setMessage('Professional summary options refreshed for your tailored copy.')
      }
    } finally {
      activeAiRequests.current.delete(controller)
    }
  }
  const editSummaryOption = (option: SummaryOption) => {
    setSummaryOptions((current) => current.map((item) =>
      item.tone === option.tone ? option : item))
    setAppliedTone(null)
    setMessage('Edited summary saved. Select Use this summary to apply it to the tailored preview.')
  }
  const markChanged = (sectionKey: string, entryIndex: number, fieldKey: string) => {
    setChangedFields((current) => new Set(current).add(`${sectionKey}:${entryIndex}:${fieldKey}`))
  }
  const renderPreviewField = (before: string, after: string, fieldId: string) => {
    if (!changedFields.has(fieldId) || before === after) return after
    const words = after.match(/\S+\s*/g) ?? []
    const mask = addedWordMask(before, after)
    return words.map((word, index) => mask[index]
      ? <mark className="tailor-ai-added" key={index}>{word}</mark>
      : <span key={index}>{word}</span>)
  }
  const applySummary = (option: SummaryOption) => {
    markChanged('summary', 0, 'value')
    setTailored((current) => {
      if (!current) return current
      const existing = current.sections.find((section) => section.key === 'summary')
      const sections: TailorSection[] = existing
        ? current.sections.map((section) => section.key === 'summary'
          ? { ...section, entries: [option.text] } : section)
        : [{ key: 'summary', title: 'Professional summary', entries: [option.text] }, ...current.sections]
      return { ...current, sections }
    })
    setAppliedTone(option.tone)
    setMessage('Summary applied to the tailored copy only. Regenerate AI suggestions to reassess the edited resume.')
  }
  const deleteAppliedSummary = () => {
    if (!baseDraft) {
      setMessage('No original parsed resume was found to restore.')
      return
    }
    const originalSummarySection = baseDraft.sections.find((section) => section.key === 'summary')
    const originalText = typeof originalSummarySection?.entries[0] === 'string'
      ? originalSummarySection.entries[0]
      : baseDraft.profile.professional_summary ?? ''
    setTailored((current) => {
      if (!current) return current
      const sections = current.sections.filter((section) => section.key !== 'summary')
      if (originalSummarySection) {
        const originalPosition = baseDraft.sections.findIndex((section) => section.key === 'summary')
        sections.splice(Math.min(originalPosition, sections.length), 0,
          { ...originalSummarySection, entries: [...originalSummarySection.entries] })
      } else if (originalText) {
        sections.unshift({ key: 'summary', title: 'Professional summary', entries: [originalText] })
      }
      return { ...current, sections }
    })
    setChangedFields((current) => {
      const next = new Set(current)
      next.delete('summary:0:value')
      return next
    })
    setAppliedTone(null)
    setMessage('Original parsed professional summary restored to the tailored preview.')
  }
  const applySuggestion = (change: SuggestionChange): string | null => {
    const target = change.target
    if (!target) return 'This suggestion does not target an existing resume field.'
    const section = tailored?.sections.find((item) => item.key === target.sectionKey)
    const entry = section?.entries[target.entryIndex]
    if (entry === undefined || (typeof entry !== 'string' && !(target.fieldKey in entry))) {
      return 'This suggestion targets a field not present in the tailored resume.'
    }
    let updatedText: string
    try {
      const currentText = typeof entry === 'string'
        ? entry
        : String(entry[target.fieldKey as keyof typeof entry] ?? '')
      updatedText = replaceTextInField(currentText, change.previousText, change.newText)
    } catch (cause) {
      return cause instanceof Error ? cause.message : 'Unable to safely apply this suggestion.'
    }
    markChanged(target.sectionKey, target.entryIndex, target.fieldKey)
    setTailored((current) => current && ({
      ...current,
      sections: current.sections.map((item) => item.key !== target.sectionKey
        ? item
        : {
          ...item,
          entries: item.entries.map((oldEntry, index) => index !== target.entryIndex
            ? oldEntry
            : typeof oldEntry === 'string'
              ? updatedText
              : { ...oldEntry, [target.fieldKey]: updatedText }),
        }),
    }))
    setAppliedTone(null)
    setMessage('Suggestion applied to the tailored copy only. Regenerate AI suggestions to reassess the edited resume.')
    return null
  }
  const applyRecommendation = (change: SuggestionChange): string | null => {
    if (change.newEntry) {
      const newEntry = {
        ...change.newEntry,
        description: change.newText.trim(),
      }
      const newSection: TailorSection = 'job_title' in newEntry
        ? {
          key: 'work_experience',
          title: 'Work Experience',
          entries: [newEntry],
        }
        : {
          key: 'projects',
          title: 'Projects',
          entries: [newEntry],
        }
      const sectionKey = newSection.key
      if (sectionNameFromPath(sectionKey) !== change.suggestion.section_name) {
        return 'This suggestion targets an invalid resume section.'
      }
      if (!tailored) return 'No tailored resume is available.'
      const section = tailored.sections.find((item) => item.key === sectionKey)
      const entryIndex = section?.entries.length ?? 0
      markChanged(sectionKey, entryIndex, 'description')
      setTailored((current) => {
        if (!current) return current
        const exists = current.sections.some((item) => item.key === sectionKey)
        const sections = exists
          ? current.sections.map((item) => item.key === sectionKey
            ? { ...item, entries: [...item.entries, newEntry] }
            : item)
          : [...current.sections, newSection]
        return { ...current, sections }
      })
      setAppliedRecommendationKeys((current) => new Set(current).add(
        recommendationKey(change.suggestion),
      ))
      setAppliedTone(null)
      setMessage('New entry applied to the tailored copy only.')
      return null
    }
    const error = applySuggestion(change)
    if (!error) {
      setAppliedRecommendationKeys((current) => new Set(current).add(
        recommendationKey(change.suggestion),
      ))
    }
    return error
  }
  // Export the live tailored state, never the original sessionStorage draft.
  const tailoredFilename = () => {
    const base = (tailored?.filename || 'resume').replace(/\.docx?$/i, '')
      .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '-').trim() || 'resume'
    return `${base}-tailored`
  }
  // Export the current tailored draft using Page 2's JobCoachAI profile CSV format.
  const exportTailoredAsCsv = () => {
    if (!tailored) return
    const rows: string[][] = [['kind', 'section', 'entry', 'field', 'value']]
    const filename = tailoredFilename()
    rows.push(['meta', 'profile', '0', 'filename', filename])
    rows.push(['meta', 'profile', '0', 'section_order',
      JSON.stringify(tailored.sections.map((section) => section.key))])
    const summary = tailored.sections.find((section) => section.key === 'summary')?.entries[0]
    const exportProfile = {
      ...tailored.profile,
      professional_summary: typeof summary === 'string'
        ? summary : tailored.profile.professional_summary,
    }
    Object.entries(exportProfile).forEach(([field, value]) => {
      rows.push(['profile', 'profile', '0', field, value])
    })
    tailored.sections.forEach((section) => {
      section.entries.forEach((entry, index) => {
        if (typeof entry === 'string') {
          rows.push(['entry', section.key, String(index), 'value', entry])
        } else {
          Object.entries(entry).forEach(([field, value]) => {
            rows.push(['entry', section.key, String(index), field, String(value ?? '')])
          })
        }
      })
    })
    const csvEscape = (value: string) => `"${value.replace(/"/g, '""')}"`
    const blob = new Blob([rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')],
      { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = window.document.createElement('a')
    link.href = url
    link.download = `${filename}-profile.csv`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMessage('Tailored resume CSV download started.')
  }
  const exportTailoredAsDocx = async () => {
    if (!tailored || exportBusy) return
    setExportBusy(true)
    try {
      await downloadSavedResumeDocx(buildDownloadResume(tailored.profile, tailored.sections, tailoredFilename()))
      setMessage('Tailored resume DOCX download started.')
    } catch (error) {
      console.error('Tailored DOCX export failed:', error)
      setMessage('Could not export the tailored resume as DOCX. Please try again.')
    } finally {
      setExportBusy(false)
    }
  }
  const exportTailoredAsPdf = () => {
    if (!tailored) return
    try {
      downloadSavedResumePdf(buildDownloadResume(tailored.profile, tailored.sections, tailoredFilename()))
      setMessage('Tailored resume PDF download started.')
    } catch (error) {
      console.error('Tailored PDF export failed:', error)
      setMessage('Could not export the tailored resume as PDF. Please try again.')
    }
  }
  return (
    <section className="resume-suggestions-region tailor-results" aria-label="Tailor resume analysis">
      {!tailored ? (
        <p role="status">No locally saved resume draft found. Build your resume first, then return to Tailor.</p>
      ) : (
        <>
          {result?.missing_requirements && (
            <section aria-label="ATS compatibility analysis" className="tailor-match-section">
              <div className="resume-suggestions-toolbar-copy">
                <span className="panel-icon">RESUME ANALYSIS</span>
                <h3>ATS Compatibility Score</h3>
                <p>Initial score comes from the AI assessment. Changing Found or Missing keywords recalculates the estimate locally.</p>
              </div>
              <AtsScorePanel
                response={interactiveatsresponse}
                missingRequirements={interactiveatsresponse?.missing_requirements}
                hiddenKeywords={hiddenAtsKeywords}
                onRemoveKeyword={removeAtsKeyword}
                onAddUserEvidence={addUserEvidence}
                manuallyFoundSkills={manuallyFoundSkills}
              />
              {result?.requirements && (
                <details className="tailor-requirements-debug">
                  <summary>
                    Exact AI-extracted requirements ({result.requirements.requirements.length})
                  </summary>
                  <pre>{JSON.stringify(result.requirements, null, 2)}</pre>
                </details>
              )}
            </section>
          )}
          {loading && <TailoringLoading stage={loadingStage} />}
          <section className="tailor-dropdown" aria-label="AI Professional Summary">
            <button type="button" className="tailor-dropdown-trigger" aria-expanded={summaryOpen}
              aria-controls="tailor-summary-content" onClick={() => setSummaryOpen((open) => !open)}>
              <span className="tailor-dropdown-label">
                <span className="panel-icon">AI SUMMARY</span>
                <strong>AI Professional Summary</strong>
                <small>Review summary options and apply a tone to your tailored resume.</small>
              </span>
              <span className={`tailor-dropdown-chevron${summaryOpen ? ' open' : ''}`} aria-hidden="true">⌄</span>
            </button>
            {summaryOpen && (
              <div id="tailor-summary-content" className="tailor-dropdown-body">
                {summaryLoading && (
                  <p role="status">Generating professional summary options…</p>
                )}
                {summaryError && <p role="alert">{summaryError}</p>}
                {summaryOptions.length > 0 ? (
                  <SummaryOptions options={summaryOptions} appliedTone={appliedTone}
                    onApply={applySummary} onRegenerate={regenerateSummaries}
                    onEdit={editSummaryOption} onDelete={deleteAppliedSummary}
                    isLoading={summaryLoading} />
                ) : !summaryLoading && !summaryError
                  ? <p>Submit a job description to generate summary options.</p>
                  : null}
              </div>
            )}
          </section>
          <section className="tailor-dropdown" aria-label="AI Suggestions">
            <button type="button" className="tailor-dropdown-trigger" aria-expanded={suggestionsOpen}
              aria-controls="tailor-suggestions-content" onClick={() => setSuggestionsOpen((open) => !open)}>
              <span className="tailor-dropdown-label">
                <span className="panel-icon">AI SUGGESTIONS</span>
                <strong>AI Suggestions</strong>
                <small>AI may add embellishments or inaccurate experience. Review suggestions before adding them to your resume.</small>
              </span>
              <span className={`tailor-dropdown-chevron${suggestionsOpen ? ' open' : ''}`} aria-hidden="true">⌄</span>
            </button>
            {suggestionsOpen && (
              <div id="tailor-suggestions-content" className="tailor-dropdown-body">
                <div className="tailor-suggestions-toolbar" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={loading || regenerating || addingEvidence || !tailored || !result}
                    onClick={() => void regenerateSuggestions()}
                  >
                    {regenerating || addingEvidence
                      ? 'Updating AI suggestions…'
                      : loading ? 'Generating AI suggestions…' : 'Regenerate AI suggestions'}
                  </button>
                </div>
                {(regenerating || addingEvidence) && (
                  <p role="status" aria-live="polite">
                    {updatingRequirements.length
                      ? `Updating ${updatingRequirements.join(', ')}…`
                      : 'Refreshing suggestions…'}
                  </p>
                )}
                {error && <p role="alert">{error}</p>}
                {!loading && result && (
                  recommendations.length > 0 ? (
                    <ResumeSuggestions recommendations={recommendations}
                      sections={tailored.sections} onApplySuggestion={applyRecommendation} />
                  ) : <p>No wording changes were recommended.</p>
                )}
                {!loading && result && (
                  <section aria-label="AI improvements">
                    <h3>Improvements and clarifications</h3>
                    {result.improvements.map((item, index) => (
                      <article
                        className="suggestion-card"
                        key={`${item.requirement}:${index}`}
                        aria-busy={updatingRequirements.includes(skillKey(item.requirement))}
                      >
                        <h4>{item.requirement}</h4>
                        <p>{item.improvement}</p>
                        <div className="suggestion-reasoning">
                          <span className="suggestion-reasoning-title">Why this matters</span>
                          <p>{item.reason}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="button button-secondary"
                            disabled={loading || regenerating || addingEvidence}
                            onClick={() => {
                              setEvidenceImprovement(item)
                              setImprovementEvidenceText('')
                              setImprovementEvidenceSection('Work Experience')
                            }}
                          >
                            Add evidence
                          </button>
                          {updatingRequirements.includes(skillKey(item.requirement)) && (
                            <small role="status">Updating this requirement…</small>
                          )}
                          {userEvidence.some((evidence) =>
                            skillKey(evidence.requirement) === skillKey(item.requirement),
                          ) && <small>Evidence saved for regeneration</small>}
                        </div>
                      </article>
                    ))}
                  </section>
                )}
              </div>
            )}
          </section>
          <div className="tailor-insight-actions" style={{ justifyContent: 'flex-end' }}>
            <button className="button button-primary" type="button"
              onClick={() => {
                cancelAiRequests()
                setError('')
                setShowResetConfirmation(true)
              }}>Reset All Tailored Changes</button>
          </div>
          <section className="resume-preview-section" aria-label="Tailored resume preview">
            <div className="resume-preview-heading">
              <h3>Tailored copy preview</h3>
              <p>Your original resume remains unchanged. Highlighted words were added in applied summary or suggestion edits; highlights are preview-only and do not appear in exports.</p>
            </div>
            <div className="resume-preview-background">
              <ResumePreview
                profile={tailored.profile}
                sections={tailored.sections as unknown as PreviewSection[]}
                renderField={(sectionKey, index, fieldKey, value) => {
                  const originalSection = baseDraft?.sections.find((section) => section.key === sectionKey)
                  const originalEntry = originalSection?.entries[index]
                  const originalValue = typeof originalEntry === 'string'
                    ? (fieldKey === 'value' ? originalEntry : '')
                    : originalEntry && typeof originalEntry === 'object'
                      ? String((originalEntry as unknown as Record<string, unknown>)[fieldKey] ?? '')
                      : ''
                  return renderPreviewField(originalValue, value, `${sectionKey}:${index}:${fieldKey}`)
                }}
              />
            </div>
          </section>
          {evidenceImprovement && (
            <div
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setEvidenceImprovement(null)
              }}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(10, 18, 30, .62)',
                zIndex: 1100,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 16,
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="improvement-evidence-title"
                style={{
                  width: 'min(100%, 480px)',
                  background: 'var(--card-bg, #fff)',
                  color: 'var(--text-primary, #172033)',
                  borderRadius: 14,
                  padding: 24,
                  boxShadow: '0 16px 48px rgba(0,0,0,.25)',
                }}
              >
                <h3 id="improvement-evidence-title" style={{ marginTop: 0 }}>Add evidence</h3>
                <p>Requirement: <strong>{evidenceImprovement.requirement}</strong></p>
                <label htmlFor="improvement-evidence-section">Relevant resume section</label>
                <select
                  id="improvement-evidence-section"
                  value={improvementEvidenceSection}
                  onChange={(event) => setImprovementEvidenceSection(
                    event.target.value as typeof improvementEvidenceSection,
                  )}
                  style={{ display: 'block', width: '100%', margin: '8px 0 16px', padding: 10 }}
                >
                  <option value="Work Experience">Work Experience</option>
                  <option value="Projects">Projects</option>
                  <option value="Professional Summary">Professional Summary</option>
                </select>
                <label htmlFor="improvement-evidence-text">Your evidence</label>
                <textarea
                  id="improvement-evidence-text"
                  rows={5}
                  value={improvementEvidenceText}
                  onChange={(event) => setImprovementEvidenceText(event.target.value)}
                  placeholder="Describe genuine experience, coursework, or projects relevant to this requirement."
                  style={{
                    display: 'block',
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: 10,
                    marginTop: 8,
                  }}
                />
                <p style={{ fontSize: 12 }}>
                  Your evidence will be saved for AI regeneration. It will not be added to your resume automatically.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setEvidenceImprovement(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={!improvementEvidenceText.trim()}
                    onClick={() => saveImprovementEvidence(false)}
                  >
                    Continue editing
                  </button>
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={!improvementEvidenceText.trim() || loading}
                    onClick={() => saveImprovementEvidence(true)}
                  >
                    Regenerate
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="resume-bottom-action-buttons">
            <div className="resume-export-actions">
              <button className="button button-primary" type="button"
                aria-haspopup="dialog" aria-expanded={exportMenuOpen}
                onClick={() => setExportMenuOpen(true)}>
                Export Tailored Resume
              </button>
            </div>
          </div>
        </>
      )}
      {message && <p role="status">{message}</p>}
      {exportMenuOpen && tailored && (
        <div className="export-dialog-backdrop" role="presentation">
          <div className="export-dialog" role="dialog" aria-modal="true"
            aria-labelledby="tailored-export-title"
            aria-describedby="tailored-export-description">
            <span className="panel-icon">SAVE AS</span>
            <h3 id="tailored-export-title">Choose a file type</h3>
            <p id="tailored-export-description">
              Download your tailored resume as PDF, DOCX, or CSV.
            </p>
            <div className="export-dialog-options">
              <button className="button button-primary" type="button"
                disabled={exportBusy}
                onClick={() => {
                  setExportMenuOpen(false)
                  exportTailoredAsPdf()
                }}>
                Save as PDF <span aria-hidden="true">↓</span>
              </button>
              <button className="button button-primary" type="button"
                disabled={exportBusy}
                onClick={() => {
                  setExportMenuOpen(false)
                  void exportTailoredAsDocx()
                }}>
                {exportBusy ? 'Preparing DOCX…' : 'Save as DOCX'} <span aria-hidden="true">↓</span>
              </button>
              <button className="button button-primary" type="button"
                disabled={exportBusy}
                onClick={() => {
                  setExportMenuOpen(false)
                  exportTailoredAsCsv()
                }}>
                Save as CSV <span aria-hidden="true">↓</span>
              </button>
            </div>
            <button className="export-dialog-cancel" type="button"
              disabled={exportBusy}
              onClick={() => setExportMenuOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
      {showResetConfirmation && (
        <div className="tailor-confirm-backdrop">
          <div className="tailor-confirm-dialog" role="alertdialog" aria-modal="true"
            aria-labelledby="tailor-reset-title" aria-describedby="tailor-reset-description">
            <span className="panel-icon">RESET TAILORED COPY?</span>
            <h3 id="tailor-reset-title">Discard tailored changes?</h3>
            <p id="tailor-reset-description">This reloads your original resume into the tailored preview.
              Your original resume and database record remain unchanged.</p>
            <div className="tailor-confirm-actions">
              <button className="button button-secondary" type="button"
                onClick={() => setShowResetConfirmation(false)}>Keep Current Copy</button>
              <button className="button button-primary" type="button" onClick={() => {
                setShowResetConfirmation(false)
                refreshBaseResume()
              }}>Reset Tailored Copy</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
export default TailorResumeInsights
