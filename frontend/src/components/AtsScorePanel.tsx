import { useState, type CSSProperties, type FormEvent } from 'react'
import type { AIResponse } from '../types/ai'
import './AtsScorePanel.css'

export interface AtsScorePanelProps {
  response: AIResponse | null
  hiddenKeywords: ReadonlySet<string>
  onRemoveKeyword: (keyword: string) => void
  onAddSkill: (skill: string) => string | null
  manuallyFoundSkills: readonly string[]
}

const scoreBand = (score: number): { label: string; className: string } => {
  if (score >= 80) return { label: 'Strong match', className: 'primary' }
  if (score >= 60) return { label: 'Good match', className: 'good' }
  if (score >= 40) return { label: 'Partial match', className: 'fair' }
  return { label: 'Weak match', className: 'weak' }
}

const keywordKey = (keyword: string) => keyword.trim().replace(/\s+/g, ' ').toLocaleLowerCase()

export function AtsScorePanel({ response, hiddenKeywords, onRemoveKeyword, onAddSkill, manuallyFoundSkills }: AtsScorePanelProps) {
  const [skill, setSkill] = useState('')
  const [feedback, setFeedback] = useState('')
  if (!response) return null

  const band = scoreBand(response.ATS_score)
  const matchedKeywords = [...new Set(response.suggestions.map((item) => item.requirement).filter(Boolean))]
    .filter((keyword) => !hiddenKeywords.has(keywordKey(keyword)))
  const displayedFound = [...matchedKeywords,
    ...manuallyFoundSkills.filter((skill) => !matchedKeywords.some((keyword) => keywordKey(keyword) === keywordKey(skill))
      && !hiddenKeywords.has(keywordKey(skill)))]
  const missingKeywords = [...new Set(response.improvements.map((item) => item.requirement).filter(Boolean))]
    .filter((keyword) => !hiddenKeywords.has(keywordKey(keyword))
      && !manuallyFoundSkills.some((skill) => keywordKey(skill) === keywordKey(keyword)))

  const submitSkill = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = skill.trim().replace(/\s+/g, ' ')
    if (!trimmed) {
      setFeedback('Enter a skill before adding it.')
      return
    }
    const error = onAddSkill(trimmed)
    setFeedback(error ?? `“${trimmed}” added under Found in your resume. AI professional summaries will use your updated keywords when generated.`)
    if (!error) setSkill('')
  }

  const chips = (keywords: string[], kind: 'matched' | 'missing') => (
    <div className="ats-chip-list">
      {keywords.map((keyword) => (
        <span key={keyword} className={`ats-chip ats-chip-${kind}`}>
          <span>{keyword}</span>
          <button type="button" className="ats-chip-remove"
            aria-label={`Remove ${keyword} from ${kind === 'matched' ? 'found' : 'missing'} keywords`}
            onClick={() => { onRemoveKeyword(keyword); setFeedback(`“${keyword}” removed from the ATS keyword display.`) }}>×</button>
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
          <div className="ats-stat ats-stat-met"><strong>{response.requirements_met}</strong><span>requirements met</span></div>
          <div className="ats-stat ats-stat-missing"><strong>{response.requirements_missing}</strong><span>requirements missing</span></div>
        </div>
      </div>
      <div className="ats-keywords">
        <div className="ats-keyword-group">
          <span className="ats-keyword-label">Found in your resume</span>
          {displayedFound.length ? chips(displayedFound, 'matched') :
            <p className="ats-no-keywords">No matching keywords displayed.</p>}
          <form className="ats-skill-add-form" onSubmit={submitSkill}>
            <label htmlFor="ats-add-missed-skill">Add a keyword</label>
            <div className="ats-skill-add-row">
              <input id="ats-add-missed-skill" type="text" value={skill} maxLength={100}
                placeholder="e.g., Linux" onChange={(event) => setSkill(event.target.value)} />
              <button type="submit">Add keyword</button>
            </div>
          </form>
        </div>
        <div className="ats-keyword-group">
          <span className="ats-keyword-label">Missing from your resume</span>
          {missingKeywords.length ? chips(missingKeywords, 'missing') :
            <p className="ats-no-keywords">No missing keywords displayed.</p>}
        </div>
        <p className="ats-keyword-hint">Manually added keywords appear only in this ATS list and inform regenerated professional summary options. They do not change your resume preview, exported resume, or ATS score. Removing a keyword hides it from this display. Add only keywords that accurately describe your background.</p>
        {feedback && <p className="ats-keyword-feedback" role="status">{feedback}</p>}
      </div>
    </div>
  )
}

export default AtsScorePanel
