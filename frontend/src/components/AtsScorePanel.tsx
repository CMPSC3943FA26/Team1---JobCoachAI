import { useState, type CSSProperties } from 'react'
import type { AIResponse, UserEvidence } from '../types/ai'
import './AtsScorePanel.css'

export interface AtsScorePanelProps {
  response: AIResponse | null
  hiddenKeywords: ReadonlySet<string>
  onRemoveKeyword: (keyword: string) => void
  onAddUserEvidence: (evidence: UserEvidence[]) => Promise<string | null>
  manuallyFoundSkills: readonly string[]
  missingRequirements?: readonly { requirement: string }[]
  educationAvailable?: boolean
  readOnly?: boolean
}

const scoreBand = (score: number): { label: string; className: string } => {
  if (score >= 80) return { label: 'Strong match', className: 'primary' }
  if (score >= 60) return { label: 'Good match', className: 'good' }
  if (score >= 40) return { label: 'Partial match', className: 'fair' }
  return { label: 'Weak match', className: 'weak' }
}

const keywordKey = (keyword: string) => keyword.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
type EvidenceSection = Extract<
  UserEvidence['target_section'],
  | 'Let AI decide'
  | 'Work Experience'
  | 'Professional Summary'
  | 'Projects'
  | 'Education'
  | 'Skills'
>
const baseEvidenceSections: EvidenceSection[] = [
  'Let AI decide',
  'Work Experience',
  'Projects',
  'Professional Summary',
  'Skills',
]

export function AtsScorePanel({ response, hiddenKeywords, onRemoveKeyword, onAddUserEvidence, manuallyFoundSkills, missingRequirements, educationAvailable = false, readOnly = false }: AtsScorePanelProps) {
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null)
  const [selectedSections, setSelectedSections] = useState<EvidenceSection[]>(['Let AI decide'])
  const [dialogStep, setDialogStep] = useState<'sections' | 'explain' | 'review'>('sections')
  const [experience, setExperience] = useState('')
  const [reviewSections, setReviewSections] = useState<EvidenceSection[]>([])
  const [feedback, setFeedback] = useState('')
  const [generationError, setGenerationError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  if (!response) return null

  const band = scoreBand(response.ATS_score)
  const matchedKeywords = [...new Set(response.requirements_met
    .map((item) => item.requirement).filter(Boolean))]
    .filter((keyword) => !hiddenKeywords.has(keywordKey(keyword)))
  const displayedFound = [...matchedKeywords,
    ...manuallyFoundSkills.filter((skill) => !matchedKeywords.some((keyword) => keywordKey(keyword) === keywordKey(skill))
      && !hiddenKeywords.has(keywordKey(skill)))]
  const partialKeywords = [...new Set((response.evidence ?? [])
    .filter((item) => item.group_classification === 'partial')
    .map((item) => item.group || item.requirement)
    .filter(Boolean))]
    .filter((keyword) =>
      !hiddenKeywords.has(keywordKey(keyword))
      && !displayedFound.some((found) => keywordKey(found) === keywordKey(keyword))
      && !manuallyFoundSkills.some((skill) => keywordKey(skill) === keywordKey(keyword)))
  const missingKeywords = [...new Set((missingRequirements ?? response.improvements)
    .map((item) => item.requirement).filter(Boolean))]
    .filter((keyword) =>
      !manuallyFoundSkills.some((skill) => keywordKey(skill) === keywordKey(keyword)))
  const evidenceSections = educationAvailable
    ? [...baseEvidenceSections.slice(0, 4), 'Education' as const, 'Skills' as const]
    : baseEvidenceSections

  const chips = (keywords: string[], kind: 'matched' | 'missing') => (
    <div className="ats-chip-list">
      {keywords.map((keyword) => (
        <span key={keyword} className={`ats-chip ats-chip-${kind}`}>
          <span>{keyword}</span>
          {!readOnly && (kind === 'missing' ? (
            <button type="button" className="ats-chip-add"
              aria-label={`Choose a section for ${keyword}`}
              title="Choose an AI Suggestions section"
              onClick={() => { setSelectedKeyword(keyword); setSelectedSections(['Let AI decide']); setDialogStep('sections'); setExperience(''); setGenerationError(''); setReviewSections([]); setFeedback('') }}>+</button>
          ) : (
            <button type="button" className="ats-chip-remove"
              aria-label={`Remove ${keyword} from found keywords`}
              onClick={() => { onRemoveKeyword(keyword); setFeedback(`“${keyword}” removed from the ATS keyword display.`) }}>×</button>
          ))}
        </span>
      ))}
    </div>
  )

  return (
    <div className="ats-panel" data-testid="ats-score-panel">
      <div className="ats-panel-header">
        <span className="ats-panel-icon" aria-hidden="true">✔</span>
        <div><h3>ATS compatibility score</h3><p>How well your resume matches this job description.</p></div>
      </div>
      <div className="ats-score-row">
        <div className={`ats-score-ring score-${band.className}`}
          style={{ '--score': `${response.ATS_score}%` } as CSSProperties}
          role="img" aria-label={`ATS compatibility score ${response.ATS_score} percent`}>
          <div className="ats-score-ring-inner"><strong>{response.ATS_score}%</strong><span>{band.label}</span></div>
        </div>
        <div className="ats-score-stats">
          <div className="ats-stat ats-stat-met"><strong>{displayedFound.length}</strong><span>requirements supported</span></div>
          <div className="ats-stat ats-stat-partial"><strong>{partialKeywords.length}</strong><span>related evidence</span></div>
          <div className="ats-stat ats-stat-missing"><strong>{missingKeywords.length}</strong><span>requirements missing</span></div>
        </div>
      </div>
      <div className="ats-keywords">
        <div className="ats-keyword-group">
          <span className="ats-keyword-label">{readOnly ? 'Confirmed requirements in AI suggestions' : 'Supported by your resume'}</span>
          {displayedFound.length ? chips(displayedFound, 'matched') :
            <p className="ats-no-keywords">No matching keywords displayed.</p>}

        </div>
        {!!partialKeywords.length && (
          <div className="ats-keyword-group">
            <span className="ats-keyword-label">Related evidence — not confirmed</span>
            <div className="ats-chip-list">
              {partialKeywords.map((keyword) => (
                <span key={keyword} className="ats-chip ats-chip-partial">{keyword}</span>
              ))}
            </div>
          </div>
        )}
        <div className="ats-keyword-group">
          <span className="ats-keyword-label">Missing from your resume</span>
          {missingKeywords.length ? chips(missingKeywords, 'missing') :
            <p className="ats-no-keywords">No missing keywords displayed.</p>}
        </div>
        {feedback && <p className="ats-keyword-feedback" role="status">{feedback}</p>}
      </div>
      {selectedKeyword && (
        <div role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedKeyword(null)
        }} style={{ position: 'fixed', inset: 0, background: 'rgba(10, 18, 30, .62)', zIndex: 1100,
          display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <div role="dialog" aria-modal="true" aria-labelledby="keyword-section-dialog-title"
            style={{ width: 'min(100%, 440px)', background: 'var(--card-bg, #fff)', color: 'var(--text-primary, #172033)',
              borderRadius: 14, padding: 24, boxShadow: '0 16px 48px rgba(0,0,0,.25)' }}>
            <h3 id="keyword-section-dialog-title" style={{ marginTop: 0 }}>Review missing keyword</h3>
            <p>Keyword: <strong>{selectedKeyword}</strong></p>
            {dialogStep === 'sections' && <>
              <p>Choose where to use this evidence. Work, project, education, and skill suggestions are added for your review; the professional summary can be updated. You can select multiple sections.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', rowGap: 12, margin: '16px 0 22px', width: '100%' }}>
              {evidenceSections.map((section) => (
                <label key={section} style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 12, width: '100%', margin: 0, padding: '8px 0', cursor: 'pointer', textAlign: 'left' }}>
                  <input type="checkbox" style={{ width: 17, height: 17, margin: 0, flex: '0 0 17px' }} checked={selectedSections.includes(section)}
                    onChange={(event) => setSelectedSections((current) => event.target.checked
                      ? section === 'Let AI decide' ? [section] : [...current.filter((value) => value !== 'Let AI decide'), section]
                      : current.filter((value) => value !== section))} />
                  <span style={{ textAlign: 'left', flex: 1 }}>{section}</span>
                </label>
              ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="button button-secondary" onClick={() => setSelectedKeyword(null)}>Cancel</button>
                <button type="button" className="button button-primary" disabled={!selectedSections.length}
                  onClick={() => setDialogStep('explain')}>Continue</button>
              </div>
            </>}
            {dialogStep === 'explain' && <>
              <p role="alert"><strong>Have you used or learned {selectedKeyword}?</strong></p>
              <p>Only describe genuine experience or learning. Do not claim employment, duties, or qualifications you do not have.</p>
              <label htmlFor="keyword-evidence">Please provide more information related to keyword</label>
              <textarea id="keyword-evidence" rows={4} value={experience} style={{ width: '100%', boxSizing: 'border-box', padding: 10 }}
                onChange={(event) => { setExperience(event.target.value); setGenerationError('') }}
                placeholder="Explain a real project, class, task, or job where you used or learned this skill." />
              <p style={{ fontSize: 12 }}>Enter a short explanation to enable Generate Description. Only your own experience or learning should be described.</p>
              {generationError && <p role="alert" style={{ color: '#b42318', fontSize: 13 }}>{generationError}</p>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="button button-secondary" onClick={() => setDialogStep('sections')}>Return</button>
                <button type="button" className="button button-primary"
                  onClick={() => {
                    const userExplanation = experience.trim()
                    if (!userExplanation) {
                      setGenerationError('Please briefly explain how you used or learned this keyword.')
                      return
                    }
                    if (!selectedSections.length) {
                      setGenerationError('Select at least one resume section before generating a description.')
                      setDialogStep('sections')
                      return
                    }
                    setReviewSections([...selectedSections])
                    setGenerationError('')
                    setFeedback('')
                    setDialogStep('review')
                  }}>
                  Review Evidence</button>
              </div>
            </>}
            {dialogStep === 'review' && <>
              <h4 style={{ margin: '8px 0' }}>Review your evidence</h4>
              <div style={{ padding: 12, background: '#f3f6fb', borderRadius: 8, margin: '12px 0' }}>
                <strong style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Evidence you provided</strong>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{experience.trim()}</p>
              </div>
              <p style={{ fontSize: 13 }}>The AI will create only new suggestions for the selected sections. It may add work, project, or skill entries, update an education description or professional summary, or replace a related description. Your text will not be pasted into the resume, and existing suggestions will remain unchanged.</p>
              <div style={{ display: 'grid', gap: 14, maxHeight: '46vh', overflowY: 'auto', margin: '14px 0' }}>
                {reviewSections.map((section) => (
                  <p key={section}><strong>Target section:</strong> {section}</p>
                ))}
              </div>
              <p style={{ fontSize: 12 }}>Nothing is applied to your tailored resume until you review and apply the AI's new suggestion.</p>
              {feedback && <p role="alert">{feedback}</p>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" className="button button-secondary" onClick={() => { setFeedback(''); setDialogStep('explain') }}>Return</button>
                <button type="button" className="button button-primary" disabled={!reviewSections.length || submitting} onClick={async () => {
                  setSubmitting(true)
                  try {
                    const evidence = reviewSections.map((target_section): UserEvidence => ({
                      requirement: selectedKeyword,
                      evidence: experience.trim(),
                      target_section,
                      source: 'user',
                    }))
                    const problem = await onAddUserEvidence(evidence)
                    if (problem) setFeedback(problem)
                    else {
                      setSelectedKeyword(null)
                      setFeedback(`New targeted suggestions added for “${selectedKeyword}”. Existing suggestions were kept.`)
                    }
                  } finally {
                    setSubmitting(false)
                  }
                }}>{submitting ? 'Generating AI suggestions…' : 'Generate AI Suggestions'}</button>
              </div>
            </>}
          </div>
        </div>
      )}
    </div>
  )
}

export default AtsScorePanel
