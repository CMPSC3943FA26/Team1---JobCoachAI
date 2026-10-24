import { useState, type CSSProperties } from 'react'
import type { AIResponse } from '../types/ai'
import './AtsScorePanel.css'

export interface AtsScorePanelProps {
  response: AIResponse | null
  hiddenKeywords: ReadonlySet<string>
  onRemoveKeyword: (keyword: string) => void
  onAddSkill: (skill: string, section: string) => string | null
  manuallyFoundSkills: readonly string[]
  missingRequirements?: readonly { requirement: string }[]
  readOnly?: boolean
}

const scoreBand = (score: number): { label: string; className: string } => {
  if (score >= 80) return { label: 'Strong match', className: 'primary' }
  if (score >= 60) return { label: 'Good match', className: 'good' }
  if (score >= 40) return { label: 'Partial match', className: 'fair' }
  return { label: 'Weak match', className: 'weak' }
}

const keywordKey = (keyword: string) => keyword.trim().replace(/\s+/g, ' ').toLocaleLowerCase()

export function AtsScorePanel({ response, hiddenKeywords, onRemoveKeyword, onAddSkill, manuallyFoundSkills, missingRequirements, readOnly = false }: AtsScorePanelProps) {
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null)
  const [selectedSection, setSelectedSection] = useState('Skills')
  const [feedback, setFeedback] = useState('')
  if (!response) return null

  const band = scoreBand(response.ATS_score)
  const matchedKeywords = [...new Set(response.requirements_met
    .map((item) => item.requirement).filter(Boolean))]
    .filter((keyword) => !hiddenKeywords.has(keywordKey(keyword)))
  const displayedFound = [...matchedKeywords,
    ...manuallyFoundSkills.filter((skill) => !matchedKeywords.some((keyword) => keywordKey(keyword) === keywordKey(skill))
      && !hiddenKeywords.has(keywordKey(skill)))]
  const missingKeywords = [...new Set((missingRequirements ?? response.improvements)
    .map((item) => item.requirement).filter(Boolean))]
    .filter((keyword) =>
      !manuallyFoundSkills.some((skill) => keywordKey(skill) === keywordKey(keyword)))

  const chips = (keywords: string[], kind: 'matched' | 'missing') => (
    <div className="ats-chip-list">
      {keywords.map((keyword) => (
        <span key={keyword} className={`ats-chip ats-chip-${kind}`}>
          <span>{keyword}</span>
          {!readOnly && (kind === 'missing' ? (
            <button type="button" className="ats-chip-add"
              aria-label={`Choose a section for ${keyword}`}
              title="Choose an AI Suggestions section"
              onClick={() => { setSelectedKeyword(keyword); setSelectedSection('Skills') }}>+</button>
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
          <div className="ats-stat ats-stat-met"><strong>{displayedFound.length}</strong><span>requirements met</span></div>
          <div className="ats-stat ats-stat-missing"><strong>{missingKeywords.length}</strong><span>requirements missing</span></div>
        </div>
      </div>
      <div className="ats-keywords">
        <div className="ats-keyword-group">
          <span className="ats-keyword-label">{readOnly ? 'Supported requirements in AI suggestions' : 'Found in your resume'}</span>
          {displayedFound.length ? chips(displayedFound, 'matched') :
            <p className="ats-no-keywords">No matching keywords displayed.</p>}

        </div>
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
            <h3 id="keyword-section-dialog-title" style={{ marginTop: 0 }}>Add keyword to AI suggestions</h3>
            <p>Keyword: <strong>{selectedKeyword}</strong></p>
            <label htmlFor="keyword-section-choice" style={{ display: 'block', marginBottom: 8 }}>Choose resume section</label>
            <select id="keyword-section-choice" value={selectedSection}
              onChange={(event) => setSelectedSection(event.target.value)}
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #adb5bd', marginBottom: 18 }}>
              {['Work Experience', 'Skills', 'Education', 'Projects', 'Certifications', 'Professional Summary']
                .map((section) => <option key={section} value={section}>{section}</option>)}
            </select>
            <p style={{ fontSize: 13, opacity: .8 }}>This adds a suggestion only. Review the wording before applying it to your resume.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="button button-secondary" onClick={() => setSelectedKeyword(null)}>Cancel</button>
              <button type="button" className="button button-primary" onClick={() => {
                const error = onAddSkill(selectedKeyword, selectedSection)
                setFeedback(error ?? `“${selectedKeyword}” added to ${selectedSection} in AI Suggestions.`)
                if (!error) setSelectedKeyword(null)
              }}>Add to suggestions</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AtsScorePanel
