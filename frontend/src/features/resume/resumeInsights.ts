import type {
  AIResponse,
  Improvement,
  Suggestion,
  SummaryOption,
  SummaryTone,
} from '../../types/ai'
import type {
  ResumeProfile,
  ResumeSaveRequest,
} from './resumeData'

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'with', 'to', 'of', 'in', 'on',
  'at', 'by', 'from', 'as', 'is', 'are', 'be', 'been', 'was', 'were',
  'will', 'would', 'should', 'must', 'can', 'could', 'may', 'might',
  'you', 'your', 'ours', 'our', 'we', 'their', 'them', 'this', 'that',
  'these', 'those', 'etc', 'using', 'experience', 'role', 'work', 'job',
  'team', 'company', 'within', 'such', 'than', 'then', 'able', 'ability',
  'including', 'including', 'also', 'well', 'etc', 'via', 'per', 'over',
])

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+(?:[-+#'./][a-z0-9]+)*/g) ?? []
}

function buildKeywordCandidates(jobDescription: string): string[] {
  const tokens = tokenize(jobDescription)
  const meaningful = tokens.filter((token) => token.length >= 3 && !STOP_WORDS.has(token))

  const candidates = new Set<string>()
  for (const token of meaningful) {
    candidates.add(token)
  }
  for (let index = 0; index < meaningful.length - 1; index++) {
    if (meaningful[index + 1].length >= 3) {
      candidates.add(`${meaningful[index]} ${meaningful[index + 1]}`)
    }
  }
  return [...candidates].sort((left, right) => right.length - left.length).slice(0, 60)
}

function flattenResumeToText(resumeData: ResumeSaveRequest): string {
  const chunks: string[] = []

  const append = (value: unknown) => {
    if (typeof value === 'string') chunks.push(value.toLowerCase().trim())
  }

  if (resumeData.resume) {
    append(resumeData.resume.full_name)
    append(resumeData.resume.professional_summary)
    append(resumeData.resume.location)
  }

  for (const entry of resumeData.work_experience ?? []) {
    append(entry.job_title)
    append(entry.company)
    append(entry.description)
    append(String(entry.sort_order ?? ''))
  }
  for (const entry of resumeData.education ?? []) {
    append(entry.school)
    append(entry.degree)
    append(entry.field_of_study)
  }
  for (const entry of resumeData.skills ?? []) {
    append(entry.skill_name)
  }
  for (const entry of resumeData.projects ?? []) {
    append(entry.name)
    append(entry.description)
  }
  for (const entry of resumeData.certifications ?? []) {
    append(entry.name)
    append(entry.issuer)
  }

  return chunks.filter(Boolean).join(' ')
}

export function analyzeResumeForJob(
  resumeData: ResumeSaveRequest,
  jobDescription: string,
): AIResponse {
  const resumeText = flattenResumeToText(resumeData)
  const keywords = buildKeywordCandidates(jobDescription)

  const matched: string[] = []
  const missing: string[] = []
  for (const keyword of keywords) {
    if (resumeText.includes(keyword)) {
      matched.push(keyword)
    } else {
      missing.push(keyword)
    }
  }

  const total = matched.length + missing.length
  const ATS_score = total === 0 ? 0 : Math.round((matched.length / total) * 100)

  const suggestions: Suggestion[] = matched.slice(0, 20).map((keyword) => ({
    suggestion: `Your resume already covers "${keyword}". Keep it prominent in the matching section.`,
    type: 'matched',
    requirement: keyword,
    importance: 2,
    before: '',
    reason: `The job description asks for "${keyword}" and your resume already contains it.`,
    resume_id: '',
  }))

  const improvements: Improvement[] = missing.slice(0, 20).map((keyword) => ({
    improvement: `Add "${keyword}" to the relevant resume section (e.g. skills or experience).`,
    type: 'missing',
    requirement: keyword,
    reason: `The job description lists "${keyword}" but your resume does not mention it.`,
    resume_id: null,
  }))

  return {
    suggestions,
    improvements,
    ATS_score,
    requirements_met: matched.length,
    requirements_missing: missing.length,
  }
}

export type SummarySeed = {
  profile: ResumeProfile
  skills: string[]
  highlights: string[]
}

function pickHighlights(seed: SummarySeed): string[] {
  return [...seed.highlights].slice(0, 2)
}

export function generateSummaryOptions(
  seed: SummarySeed,
  jobDescription: string,
): SummaryOption[] {
  const skills = [...seed.skills].filter(Boolean).slice(0, 5)
  const highlights = pickHighlights(seed)
  const headlineSkill = skills[0] ?? ''
  const highlightSentence = highlights
    .map((highlight) => {
      const sentence = highlight.replace(/\s*\.[\s.]*$/, '').trim()
      return sentence.charAt(0).toUpperCase() + sentence.slice(1)
    })
    .join(' In addition, ')
  const skillsSentence = skills.length
    ? `Skilled in ${skills.join(', ')}.`
    : ''

  const executiveText = [
    `Results-driven professional with a proven track record of delivering measurable outcomes.`,
    highlightSentence ? `${highlightSentence}.` : 'Combines strategic insight with hands-on execution.',
    skillsSentence ? `${skillsSentence}` : '',
  ].filter(Boolean).join(' ')

  const technicalText = [
    `Detail-oriented professional focused on ${headlineSkill ? `${headlineSkill}, ` : ''}technical excellence and continuous improvement.`,
    skillsSentence || 'Brings strong analytical and problem-solving abilities to every project.',
    highlightSentence ? `${highlightSentence}.` : '',
  ].filter(Boolean).join(' ')

  const conciseText = `Professional with skills in ${skills.join(', ') || 'a wide range of areas'}, known for ${firstnameFallback(highlightSentence)}.`

  function firstnameFallback(highlight: string): string {
    if (highlight) return highlight.toLowerCase()
    return 'delivering consistent, high-quality results'
  }

  const options: Array<{ tone: SummaryTone; title: string; description: string; text: string }> = [
    {
      tone: 'executive',
      title: 'Executive / Results-focused',
      description: 'Leadership-oriented tone emphasizing outcomes and impact.',
      text: executiveText,
    },
    {
      tone: 'technical',
      title: 'Technical',
      description: 'Skill-forward tone that highlights your technical strengths.',
      text: technicalText,
    },
    {
      tone: 'concise',
      title: 'Concise',
      description: 'Short and punchy summary perfect for quick scans.',
      text: conciseText,
    },
  ]

  if (jobDescription.trim()) {
    const keywords = buildKeywordCandidates(jobDescription).slice(0, 3)
    if (keywords.length) {
      options.forEach((option) => {
        option.text = `${option.text.replace(/[\s.]+$/, '')} Aligned with ${keywords.join(', ')} expectations.`
      })
    }
  }

  return options
}