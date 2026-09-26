import { useState } from 'react'
import type { SummaryOption, SummaryTone } from '../types/ai'
import './SummaryOptions.css'

export interface SummaryOptionsProps {
  options: SummaryOption[]
  appliedTone: SummaryTone | null
  onApply: (option: SummaryOption) => void
  onRegenerate: () => void
  onEdit: (option: SummaryOption) => void
  onDelete: (option: SummaryOption) => void
}

export function SummaryOptions({
  options,
  appliedTone,
  onApply,
  onRegenerate,
  onEdit,
  onDelete,
}: SummaryOptionsProps) {
  const [editingTone, setEditingTone] = useState<SummaryTone | null>(null)
  const [editValue, setEditValue] = useState('')
  const [restoredTone, setRestoredTone] = useState<SummaryTone | null>(null)

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

        <button className="summary-regenerate" type="button" onClick={() => {
          setRestoredTone(null)
          onRegenerate()
        }}>
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

              {editingTone === option.tone ? (
                <textarea className="summary-option-text summary-option-editor"
                  aria-label={`Edit ${option.title} summary`} rows={7}
                  value={editValue} onChange={(event) => setEditValue(event.target.value)} />
              ) : <blockquote className="summary-option-text">{option.text}</blockquote>}
              <button
                className="summary-option-apply"
                type="button"
                onClick={() => {
                  setRestoredTone(null)
                  onApply(option)
                }}
                disabled={isApplied}
              >
                {isApplied ? 'Applied to resume ✓' : 'Use this summary'}
              </button>
              <div className="summary-option-edit-actions">
                {editingTone === option.tone ? (
                  <>
                    <button type="button" className="summary-regenerate"
                      disabled={!editValue.trim()}
                      onClick={() => {
                        onEdit({ ...option, text: editValue.trim() })
                        setRestoredTone(null)
                        setEditingTone(null)
                      }}>Save edit</button>
                    <button type="button" className="summary-regenerate"
                      onClick={() => setEditingTone(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="summary-regenerate"
                      onClick={() => {
                        setEditingTone(option.tone)
                        setRestoredTone(null)
                        setEditValue(option.text)
                      }}>Edit</button>
                    <button type="button" className="summary-regenerate summary-option-delete"
                      onClick={() => {
                        onDelete(option)
                        setRestoredTone(option.tone)
                        setEditingTone(null)
                      }}>Delete</button>
                  </>
                )}
              </div>
              {restoredTone === option.tone && (
                <p className="summary-option-description" role="status">
                  Professional summary restored to the original parsed version.
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default SummaryOptions