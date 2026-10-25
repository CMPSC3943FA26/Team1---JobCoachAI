import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  ResumeRecommendation,
  ResumeSectionLike,
  SuggestionChange,
  SuggestionTarget,
} from '../features/resume/resumeSuggestions'
import { resolveSuggestionTarget } from '../features/resume/resumeSuggestions'
import './ResumeSuggestions.css'

interface ResumeSuggestionsProps {
  recommendations: ResumeRecommendation[]
  keywordAssignments?: readonly { keyword: string; section: string; options: string[] }[]
  sections: ResumeSectionLike[]
  onApplySuggestion: (change: SuggestionChange) => string | null
  onRegenerateSection?: (sectionName: string) => void
  onApplyKeyword?: (keyword: string, section: string, wording: string) => string | null
  onRemoveKeyword?: (keyword: string, section: string) => void
  sectionDrafts?: Record<string, string>
  sectionOriginals?: Record<string, string>
  onChangeSectionDraft?: (section: string, text: string) => void
  onApplySectionDraft?: (section: string) => string | null
}

type DiffKept = Record<number, boolean>

function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

function computeDiff(original: string, suggested: string): {
  original: string[]
  originalKept: DiffKept
  suggested: string[]
  suggestedKept: DiffKept
} {
  const a = splitWords(original)
  const b = splitWords(suggested)
  const n = a.length
  const m = b.length

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  )

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const originalKept: DiffKept = {}
  const suggestedKept: DiffKept = {}

  let i = 0
  let j = 0

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      originalKept[i] = true
      suggestedKept[j] = true
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++
    } else {
      j++
    }
  }

  return { original: a, originalKept, suggested: b, suggestedKept }
}


const chevronIcon = (
  <svg
    className="suggestion-chevron"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

export function ResumeSuggestions({
  recommendations,
  keywordAssignments = [],
  sections,
  onApplySuggestion,
  onRegenerateSection,
  onApplyKeyword,
  onRemoveKeyword,
  sectionDrafts = {},
  sectionOriginals = {},
  onChangeSectionDraft,
  onApplySectionDraft,
}: ResumeSuggestionsProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(),
  )
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [appliedChanges, setAppliedChanges] = useState<Record<string, {
    target: SuggestionTarget
    text: string
  }>>({})
  const [applyError, setApplyError] = useState<string | null>(null)

  // New recommendations invalidate the prior cards' applied indicators without
  // remounting the list or collapsing the section the user is viewing.
  useEffect(() => {
    setAppliedChanges({})
    setEditingKey(null)
    setApplyError(null)
  }, [recommendations])

  const groups = useMemo(() => {
    const order: string[] = []
    const bySection = new Map<string, ResumeRecommendation[]>()

    for (const rec of recommendations) {
      const name = rec.section_name || 'Other'
      const list = bySection.get(name)

      if (list) {
        list.push(rec)
      } else {
        bySection.set(name, [rec])
        order.push(name)
      }
    }

    for (const assignment of keywordAssignments) {
      if (!bySection.has(assignment.section)) {
        bySection.set(assignment.section, [])
        order.push(assignment.section)
      }
    }
    return order.map((name) => ({
      name,
      items: bySection.get(name) ?? [],
      keywords: keywordAssignments.filter((item) => item.section === name),
    }))
  }, [recommendations, keywordAssignments])

  if (recommendations.length === 0 && keywordAssignments.length === 0) {
    return (
      <div className="resume-suggestions">
        <div className="suggestions-empty">
          <span className="suggestions-empty-icon">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3l1.9 5.6L19 10l-5.1 1.4L12 17l-1.9-5.6L5 10l5.1-1.4z" />
              <path d="M19 15l.7 2.1L22 18l-2.3.9L19 21l-.7-2.1L16 18l2.3-.9z" />
            </svg>
          </span>

          <h3>No AI suggestions yet</h3>

          <p>
            Tailor your resume or load sample suggestions to review and apply
            recommended wording changes.
          </p>
        </div>
      </div>
    )
  }

  const toggleSection = (name: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)

      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }

      return next
    })
  }

  const applyChange = (
    suggestion: ResumeRecommendation,
    newText: string,
    key: string,
  ) => {
    // Keep the field location after applying: its original wording is now gone.
    const target = appliedChanges[key]?.target ?? resolveSuggestionTarget(suggestion, sections)

    if (!target) {
      setApplyError(
        "Couldn't find the original text in your resume. Try adjusting the suggestion or the matching resume text.",
      )
      return
    }

    const error = onApplySuggestion({
      suggestion,
      target,
      previousText: appliedChanges[key]?.text ?? suggestion.original_text,
      newText,
    })
    if (error) {
      setApplyError(error)
      return
    }
    setAppliedChanges((prev) => ({ ...prev, [key]: { target, text: newText.trim() } }))
    setEditingKey(null)
    setApplyError(null)
  }

  return (
    <div className="resume-suggestions">
      <div className="suggestion-sections">
        {groups.map((group) => {
          const isCollapsed = collapsedSections.has(group.name)

          return (
            <div key={group.name} className="suggestion-section">
              <button
                type="button"
                className="suggestion-section-header"
                aria-expanded={!isCollapsed}
                onClick={() => toggleSection(group.name)}
              >
                <span className="suggestion-section-title">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 3l1.9 5.6L19 10l-5.1 1.4L12 17l-1.9-5.6L5 10l5.1-1.4z" />
                  </svg>

                  <span className="suggestion-section-name">
                    {group.name}
                  </span>
                </span>

                <span className="suggestion-section-count">
                  {group.items.length + group.keywords.length}
                </span>

                {chevronIcon}
              </button>

              {!isCollapsed && (
                <div className="suggestion-section-body">
                  {group.keywords.map(({ keyword, section, options }) => (
                    <KeywordDraftSelection key={`${keyword}:${section}`} keyword={keyword} section={section}
                      options={options} onApply={onApplyKeyword ?? (() => 'Applying keyword suggestions is not available.')}
                      onRemove={() => onRemoveKeyword?.(keyword, section)} />
                  ))}
                  {(group.items.length ? group.items : (sectionDrafts[group.name] !== undefined ? [{
                    section_name: group.name,
                    original_text: sectionOriginals[group.name] ?? '',
                    suggested_change: sectionDrafts[group.name] ?? '',
                    reasoning: 'Review this keyword-supported wording for accuracy before applying it.',
                  } as ResumeRecommendation] : [])).map((suggestion, index) => {
                    const key = `${group.name}::${index}`
                    const isEditing = editingKey === key
                    const appliedChange = appliedChanges[key]
                    const isApplied = Boolean(appliedChange)
                    const stagedDraft = index === 0 ? sectionDrafts[group.name] : undefined
                    const suggestedText = stagedDraft ?? appliedChange?.text ?? suggestion.suggested_change
                    const originalText = stagedDraft !== undefined ? (sectionOriginals[group.name] ?? suggestion.original_text) : suggestion.original_text

                    const diff = computeDiff(
                      originalText,
                      suggestedText,
                    )

                    return (
                      <div
                        key={key}
                        className={`suggestion-card${
                          isApplied ? ' suggestion-card-applied' : ''
                        }`}
                      >
                        <div className="suggestion-diff">
                          <div className="suggestion-diff-block suggestion-diff-original">
                            <span className="suggestion-diff-label">
                              Original
                            </span>

                            <p className="suggestion-diff-text">
                              {diff.original.map((word, wordIndex) => (
                                <span
                                  key={wordIndex}
                                  className={`diff-token ${
                                    diff.originalKept[wordIndex]
                                      ? 'diff-token-kept'
                                      : 'diff-token-removed'
                                  }`}
                                >
                                  {word}
                                  {wordIndex < diff.original.length - 1 ? ' ' : ''}
                                </span>
                              )).reduce<ReactNode[]>((nodes, node, index) => {
                                if (index > 0) nodes.push(' ')
                                nodes.push(node)
                                return nodes
                              }, [])}
                            </p>
                          </div>

                          {isEditing ? (
                            <div className="suggestion-edit">
                              <span className="suggestion-edit-label">
                                Edited suggestion
                              </span>

                              <textarea
                                className="suggestion-edit-textarea"
                                rows={4}
                                value={editValue}
                                onChange={(event) =>
                                  setEditValue(event.target.value)
                                }
                              />
                            </div>
                          ) : (
                            <div className="suggestion-diff-block suggestion-diff-suggested">
                              <span className="suggestion-diff-label">
                                Suggested
                              </span>

                              <p className="suggestion-diff-text">
                                {diff.suggested.map((word, wordIndex) => (
                                  <span
                                    key={wordIndex}
                                    className={`diff-token ${
                                      diff.suggestedKept[wordIndex]
                                        ? 'diff-token-kept'
                                        : 'diff-token-added'
                                    }`}
                                  >
                                    {word}
                                    {wordIndex < diff.suggested.length - 1 ? ' ' : ''}
                                  </span>
                                )).reduce<ReactNode[]>((nodes, node, index) => {
                                  if (index > 0) nodes.push(' ')
                                  nodes.push(node)
                                  return nodes
                                }, [])}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="suggestion-reasoning">
                          <span className="suggestion-reasoning-title">
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="16" x2="12" y2="12" />
                              <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>

                            Why this change
                          </span>

                          <p>{suggestion.reasoning}</p>
                        </div>

                        {applyError && (
                          <p className="suggestion-apply-error">
                            {applyError}
                          </p>
                        )}

                        <div className="suggestion-actions">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                className="suggestion-btn suggestion-btn-save"
                                onClick={() => {
                                  if (stagedDraft !== undefined) {
                                    onChangeSectionDraft?.(group.name, editValue)
                                    setEditingKey(null)
                                    setApplyError(null)
                                  } else {
                                    applyChange(suggestion, editValue, key)
                                  }
                                }}
                              >
                                {stagedDraft !== undefined ? "Save Suggestion" : "Save & Apply to Resume"}
                              </button>

                              <button
                                type="button"
                                className="suggestion-btn suggestion-btn-cancel"
                                onClick={() => {
                                  setEditingKey(null)
                                  setApplyError(null)
                                }}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="suggestion-btn suggestion-btn-edit"
                                onClick={() => {
                                  setEditingKey(key)
                                  setEditValue(suggestedText)
                                  setApplyError(null)
                                }}
                              >
                                Edit Suggestion
                              </button>

                              {onRegenerateSection && (
                                <button
                                  type="button"
                                  className="suggestion-btn suggestion-btn-edit"
                                  onClick={() => {
                                    onRegenerateSection(group.name)
                                    setEditingKey(null)
                                    setApplyError(null)
                                  }}
                                >
                                  Regenerate
                                </button>
                              )}

                              <button
                                type="button"
                                className="suggestion-btn suggestion-btn-apply"
                                onClick={() => {
                                  if (stagedDraft !== undefined) {
                                    const issue = onApplySectionDraft ? onApplySectionDraft(group.name) : 'Section apply action unavailable.'
                                    setApplyError(issue)
                                  } else {
                                    applyChange(suggestion, suggestedText, key)
                                  }
                                }}
                              >
                                Apply to Resume
                              </button>
                            </>
                          )}
                        </div>

                        {isApplied && (
                          <div className="suggestion-applied">
                            <svg
                              width="15"
                              height="15"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>

                            Applied to your resume
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ResumeSuggestions

// Each approved keyword/section has independent wording choices. Only the
// explicit Apply action modifies the tailored copy.
function KeywordDraftSelection({ keyword, section, options, onApply, onRemove }: {
  keyword: string
  section: string
  options: string[]
  onApply: (keyword: string, section: string, wording: string) => string | null
  onRemove: () => void
}) {
  const [selected, setSelected] = useState(0)
  const [wording, setWording] = useState(options[0] ?? '')
  const [error, setError] = useState('')
  const [applied, setApplied] = useState(false)

  return (
    <article className="suggestion-card keyword-draft-card">
      <div className="keyword-draft-header">
        <span className="suggestion-diff-label">Keyword to incorporate</span>
        <h4>{keyword}</h4>
        <p><strong>Add to section:</strong> {section}</p>
        <p className="keyword-draft-caption">Added from Missing Keywords · Draft wording only · Not applied automatically</p>
      </div>

      <fieldset className="keyword-draft-options">
        <legend>Choose wording</legend>
        {options.map((option, index) => (
          <label key={index} className="keyword-draft-option">
            <input type="radio" name={`wording-${keyword}-${section}`} checked={selected === index}
              onChange={() => { setSelected(index); setWording(option); setApplied(false); setError('') }} />
            <span>{option}</span>
          </label>
        ))}
      </fieldset>

      <label className="keyword-draft-edit-label" htmlFor={`edit-${keyword}-${section}`}>Edit selected wording</label>
      <textarea id={`edit-${keyword}-${section}`} rows={3} value={wording}
        onChange={(event) => { setWording(event.target.value); setApplied(false) }}
        className="keyword-draft-textarea" />
      {error && <p role="alert" className="suggestion-apply-error">{error}</p>}
      <div className="suggestion-actions keyword-draft-actions">
        <button type="button" className="suggestion-btn suggestion-btn-apply"
          disabled={!wording.trim() || applied} onClick={() => {
            const issue = onApply(keyword, section, wording.trim())
            if (issue) setError(issue)
            else { setApplied(true); setError('') }
          }}>{applied ? `Added to ${section} suggestions` : `Apply to ${section}`}</button>
        <button type="button" className="suggestion-btn suggestion-btn-cancel" onClick={onRemove}
          aria-label={`Remove ${keyword} suggestion for ${section}`}>
          Remove
        </button>
      </div>
      {applied && <p className="keyword-draft-caption">Wording added to this section’s suggested text above. It has not been applied to your tailored resume.</p>}
    </article>
  )
}
