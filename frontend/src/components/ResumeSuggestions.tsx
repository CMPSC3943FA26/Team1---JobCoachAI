import { useMemo, useState } from 'react'
import type {
  ResumeRecommendation,
  ResumeSectionLike,
  SuggestionChange,
} from '../features/resume/resumeSuggestions'
import { resolveSuggestionTarget } from '../features/resume/resumeSuggestions'
import './ResumeSuggestions.css'

interface ResumeSuggestionsProps {
  recommendations: ResumeRecommendation[]
  sections: ResumeSectionLike[]
  onApplySuggestion: (change: SuggestionChange) => void
  onRegenerateSection?: (sectionName: string) => void
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
  sections,
  onApplySuggestion,
  onRegenerateSection,
}: ResumeSuggestionsProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(),
  )
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [appliedKeys, setAppliedKeys] = useState<Set<string>>(new Set())
  const [applyError, setApplyError] = useState<string | null>(null)

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

    return order.map((name) => ({
      name,
      items: bySection.get(name) ?? [],
    }))
  }, [recommendations])

  if (recommendations.length === 0) {
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
    const target = resolveSuggestionTarget(suggestion, sections)

    if (!target) {
      setApplyError(
        "Couldn't find the original text in your resume. Try adjusting the suggestion or the matching resume text.",
      )
      return
    }

    onApplySuggestion({ suggestion, target, newText })
    setAppliedKeys((prev) => new Set(prev).add(key))
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
                  {group.items.length}
                </span>

                {chevronIcon}
              </button>

              {!isCollapsed && (
                <div className="suggestion-section-body">
                  {onRegenerateSection && <button type="button"
                    className="suggestion-btn suggestion-btn-edit"
                    onClick={() => {
                      onRegenerateSection(group.name)
                      setEditingKey(null)
                      setAppliedKeys(new Set())
                      setApplyError(null)
                    }}>Regenerate {group.name} suggestions</button>}
                  {group.items.map((suggestion, index) => {
                    const key = `${group.name}::${index}`
                    const isEditing = editingKey === key
                    const isApplied = appliedKeys.has(key)

                    const diff = computeDiff(
                      suggestion.original_text,
                      suggestion.suggested_change,
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
                                </span>
                              ))}
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
                                  </span>
                                ))}
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
                                onClick={() =>
                                  applyChange(suggestion, editValue, key)
                                }
                              >
                                Save &amp; Apply to Resume
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
                                  setEditValue(suggestion.suggested_change)
                                  setApplyError(null)
                                }}
                              >
                                Edit Suggestion
                              </button>

                              <button
                                type="button"
                                className="suggestion-btn suggestion-btn-apply"
                                onClick={() =>
                                  applyChange(
                                    suggestion,
                                    suggestion.suggested_change,
                                    key,
                                  )
                                }
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