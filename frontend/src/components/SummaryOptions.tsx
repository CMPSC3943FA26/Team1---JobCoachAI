import type { SummaryOption, SummaryTone } from '../types/ai'
import './SummaryOptions.css'

export interface SummaryOptionsProps {
  options: SummaryOption[]
  appliedTone: SummaryTone | null
  onApply: (option: SummaryOption) => void
  onRegenerate: () => void
}

export function SummaryOptions({
  options,
  appliedTone,
  onApply,
  onRegenerate,
}: SummaryOptionsProps) {
  return (
    <div className="summary-options-panel">
      <div className="summary-options-header">
        <div>
          <span className="panel-icon">AI SUMMARY</span>
          <h3>Professional summary options</h3>
          <p>
            Pick a tone, review the draft, then apply the summary straight to
            your resume.
          </p>
        </div>

        <button className="summary-regenerate" type="button" onClick={onRegenerate}>
          Regenerate
        </button>
      </div>

      <div className="summary-options-grid">
        {options.map((option) => {
          const isApplied = appliedTone === option.tone
          return (
            <div
              key={option.tone}
              className={`summary-option-card${isApplied ? ' summary-option-applied' : ''}`}
            >
              <span className={`summary-option-badge tone-${option.tone}`}>
                {option.title}
              </span>
              <p className="summary-option-description">{option.description}</p>

              <blockquote className="summary-option-text">{option.text}</blockquote>

              <button
                className="summary-option-apply"
                type="button"
                onClick={() => onApply(option)}
                disabled={isApplied}
              >
                {isApplied ? 'Applied to resume ✓' : 'Use this summary'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default SummaryOptions