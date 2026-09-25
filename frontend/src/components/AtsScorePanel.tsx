import type { CSSProperties } from 'react'
import type { AIResponse } from '../types/ai'
import './AtsScorePanel.css'

export interface AtsScorePanelProps {
  response: AIResponse | null
}

const scoreBand = (score: number): { label: string; className: string } => {
  if (score >= 80) return { label: 'Strong match', className: 'primary' }
  if (score >= 60) return { label: 'Good match', className: 'good' }
  if (score >= 40) return { label: 'Partial match', className: 'fair' }
  return { label: 'Weak match', className: 'weak' }
}

export function AtsScorePanel({ response }: AtsScorePanelProps) {
  if (!response) {
    return null
  }

  const band = scoreBand(response.ATS_score)
  const matchedKeywords = response.suggestions
    .filter((item) => item.requirement)
    .map((item) => item.requirement)
  const missingKeywords = response.improvements
    .filter((item) => item.requirement)
    .map((item) => item.requirement)
  const feedback = response.improvements
    .filter((item) => item.improvement || item.reason)
    .map((item) => (item.improvement ? item.improvement : item.reason))

  return (
    <div className="ats-panel" data-testid="ats-score-panel">
      <div className="ats-panel-header">
        <span className="ats-panel-icon" aria-hidden="true">
          ✔
        </span>
        <div>
          <h3>ATS compatibility score</h3>
          <p>How well your resume matches this job description.</p>
        </div>
      </div>

      <div className="ats-score-row">
        <div
          className={`ats-score-ring score-${band.className}`}
          style={{ '--score': `${response.ATS_score}%` } as CSSProperties}
          role="img"
          aria-label={`ATS compatibility score ${response.ATS_score} percent`}
        >
          <div className="ats-score-ring-inner">
            <strong>{response.ATS_score}%</strong>
            <span>{band.label}</span>
          </div>
        </div>

        <div className="ats-score-stats">
          <div className="ats-stat ats-stat-met">
            <strong>{response.requirements_met}</strong>
            <span>requirements met</span>
          </div>
          <div className="ats-stat ats-stat-missing">
            <strong>{response.requirements_missing}</strong>
            <span>requirements missing</span>
          </div>
        </div>
      </div>

      <div className="ats-keywords">
        <div className="ats-keyword-group">
          <span className="ats-keyword-label">Found in your resume</span>
          {matchedKeywords.length ? (
            <div className="ats-chip-list">
              {matchedKeywords.map((keyword) => (
                <span key={keyword} className="ats-chip ats-chip-matched">
                  {keyword}
                </span>
              ))}
            </div>
          ) : (
            <p className="ats-no-keywords">No matching keywords detected.</p>
          )}
        </div>

        <div className="ats-keyword-group">
          <span className="ats-keyword-label">Missing from your resume</span>
          {missingKeywords.length ? (
            <div className="ats-chip-list">
              {missingKeywords.map((keyword) => (
                <span key={keyword} className="ats-chip ats-chip-missing">
                  {keyword}
                </span>
              ))}
            </div>
          ) : (
            <p className="ats-no-keywords">Nothing missing — great alignment!</p>
          )}
        </div>
      </div>

      {feedback.length > 0 && (
        <div className="ats-feedback">
          <span className="ats-feedback-title">How to improve</span>
          <ul>
            {feedback.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default AtsScorePanel