import {
  useState,
  useRef,
  useEffect,
  type FormEvent,
} from 'react'

import { TailorResumeInsights, TAILORED_PAYLOAD_KEY } from './TailorResumeInsights'
import type { ResumeSaveRequest } from '../features/resume/resumeData'
import {loadResumeFromDatabase, saveResumeToDatabase, setSavedResumeDisplayMeta, updateResumeToDatabase } from '../services/resumeService'

/**
 * Tailor / intake page (Page 3).
 * Users enter the target company, job title, and job description.
 * Analysis uses a separate in-memory copy of their locally drafted resume.
 */

export type ResumeSource = 'uploaded' | 'scratch'

export interface TailorSubmission {
  jobTitle: string
  jobDescription: string
  resumeFile: File | null
  source: ResumeSource
}

export interface TailorPageProps {
  onOpenResume: (source: ResumeSource, file: File | null) => void
  onSubmit: (submission: TailorSubmission) => void
  onBack?: () => void
  hasSavedResume?: boolean
  isGuest?: boolean
  onResumePreviewed?: (resume: Record<string, any>) => void
}

export default function TailorPage({
  onSubmit,
  isGuest = true,
  onResumePreviewed,
}: TailorPageProps) {
  const [company, setCompany] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [error, setError] = useState('')
  const [tailoredSaveMessage, setTailoredSaveMessage] = useState('')
  const [savingTailoredResume, setSavingTailoredResume] = useState(false)
  const [previewingTailoredResume, setPreviewingTailoredResume] = useState(false)
  const [tailoredReady, setTailoredReady] = useState(false)
  const [tailoredResumeId, setTailoredResumeId] = useState<string | null>(null)
  const [showNewCopyConfirmation, setShowNewCopyConfirmation] = useState(false)

  const cancelConfirmationRef = useRef<HTMLButtonElement>(null)

  const [submitted, setSubmitted] = useState<{
    company: string
    jobTitle: string
    jobDescription: string
    version: number
  } | null>(null)

  useEffect(() => {
    if (!showNewCopyConfirmation) return
    cancelConfirmationRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowNewCopyConfirmation(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showNewCopyConfirmation])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!company.trim() || !jobTitle.trim() || !jobDescription.trim()) {
      setError('Please enter the company name, job title and job description to proceed.')
      return
    }

    if (submitted) {
      setShowNewCopyConfirmation(true)
      return
    }
    createTailoredCopy()
  }

  function createTailoredCopy() {
    setError('')
    setShowNewCopyConfirmation(false)
    setTailoredResumeId(null)
    setTailoredReady(false)
    sessionStorage.removeItem(TAILORED_PAYLOAD_KEY)
    setSubmitted((previous) => ({
      company: company.trim(),
      jobTitle: jobTitle.trim(),
      jobDescription: jobDescription.trim(),
      version: (previous?.version ?? 0) + 1,
    }))
    // Keep the existing parent callback without changing the current screen.
    onSubmit({
      jobTitle: jobTitle.trim(),
      jobDescription: jobDescription.trim(),
      resumeFile: null,
      source: 'scratch',
    })
  }

  function toApiDate(value: string): string {
    const trimmed = String(value ?? '').trim()
    if (!trimmed) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
    if (/^\d{4}$/.test(trimmed)) return `${trimmed}-01-01`
    if (trimmed.toLowerCase() === 'present' || trimmed.toLowerCase() === 'current') {
      return new Date().toISOString().slice(0, 10)
    }
    return ''
  }

  function normalizeTailoredPayload(payload: ResumeSaveRequest): ResumeSaveRequest {
    return {
      ...payload,
      work_experience: payload.work_experience.map((entry, index) => ({
        ...entry,
        start_date: toApiDate(entry.start_date),
        end_date: toApiDate(entry.end_date),
        sort_order: index,
      })),
      education: payload.education.map((entry, index) => ({
        ...entry,
        start_date: toApiDate(entry.start_date),
        end_date: toApiDate(entry.end_date),
        sort_order: index,
      })),
      skills: payload.skills.map((entry, index) => ({ ...entry, sort_order: index })),
      projects: payload.projects.map((entry, index) => ({ ...entry, sort_order: index })),
      certifications: payload.certifications.map((entry, index) => ({
        ...entry,
        date_earned: toApiDate(entry.date_earned),
        sort_order: index,
      })),
    }
  }

  async function handleSaveTailoredResume() {
    if (isGuest || savingTailoredResume) return

    const title = jobTitle.trim()
    if (!title) {
      setTailoredSaveMessage('Add the job title below before saving a tailored resume.')
      return
    }
    if (!submitted) {
      setTailoredSaveMessage('Submit the job details first so the tailored copy can be generated.')
      return
    }
    if (!tailoredReady) {
      setTailoredSaveMessage('Apply at least one AI suggestion or generated summary before saving the tailored resume.')
      return
    }

    const raw = sessionStorage.getItem(TAILORED_PAYLOAD_KEY)
    if (!raw) {
      setTailoredSaveMessage('The tailored copy is not ready yet. Submit the job details again, then save.')
      return
    }

    setSavingTailoredResume(true)
    setTailoredSaveMessage('Saving tailored resume…')

    try {
      const payload = normalizeTailoredPayload(JSON.parse(raw) as ResumeSaveRequest)
      let baseFilename = jobTitle.trim() || 'resume'
      try {
        const draftRaw = sessionStorage.getItem('jobcoachai.resumeDraft')
        if (draftRaw) {
          const draft = JSON.parse(draftRaw) as { filename?: string }
          if (draft.filename?.trim()) baseFilename = draft.filename.trim()
        }
      } catch {
        // Keep the job-title fallback if the local draft is unavailable.
      }
      const tailoredDisplayFilename = baseFilename.replace(/-(original|tailored)$/i, '')

      const createTailoredCopy = async () => {
        const result = await saveResumeToDatabase(payload)
        const savedId = result.id ?? result.resume_id ?? result.resume?.id
        if (typeof savedId !== 'string') {
          throw new Error('The saved tailored resume response did not include an ID.')
        }
        setTailoredResumeId(savedId)
        setSavedResumeDisplayMeta(savedId, {
          filename: tailoredDisplayFilename,
          kind: 'tailored',
        })
      }

      if (tailoredResumeId) {
        try {
          await updateResumeToDatabase(tailoredResumeId, payload)
          setSavedResumeDisplayMeta(tailoredResumeId, {
            filename: tailoredDisplayFilename,
            kind: 'tailored',
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : ''
          if (message.toLowerCase().includes('issue with updating resume')) {
            setTailoredResumeId(null)
            await createTailoredCopy()
          } else {
            throw error
          }
        }
      } else {
        await createTailoredCopy()
      }

      setTailoredSaveMessage(`Tailored resume for ${title} saved to your account.`)
    } catch (error) {
      setTailoredSaveMessage(error instanceof Error ? error.message : 'Unable to save the tailored resume.')
      console.error('Error saving tailored resume:', error)
    } finally {
      setSavingTailoredResume(false)
    }
  }

  async function handleViewTailoredResume() {
    if (!tailoredResumeId || previewingTailoredResume) return

    setPreviewingTailoredResume(true)
    setTailoredSaveMessage('')

    try {
      const response = await loadResumeFromDatabase(tailoredResumeId)
      const databaseResume = response?.resume ?? response

      if (!databaseResume || databaseResume.error) {
        throw new Error(
          databaseResume?.error ?? 'Unable to preview the tailored resume.',
        )
      }

      onResumePreviewed?.(databaseResume)
    } catch (error) {
      console.error('Preview tailored resume error:', error)

      setTailoredSaveMessage(
        error instanceof Error
          ? error.message
          : 'Unable to preview the tailored resume.',
      )
    } finally {
      setPreviewingTailoredResume(false)
    }
  }

  function handleBackToResume() {
    window.location.hash = '#parsed'
  }

  return (
    <section className="screen" data-screen="tailor">
      <div className="screen-intro">
        <h2>Tailor smarter.<br /><em>Apply stronger.</em></h2>
      </div>

      <form className="job-form" noValidate onSubmit={handleSubmit}>
        <section className="tailored-save-card">
          <div className="tailored-save-copy">
            <span className="panel-icon">JOB-SPECIFIC VERSION</span>
            <h3>Save a tailored resume</h3>
            <p>
              Save the AI-tailored copy for this role without changing your main resume.
              Apply at least one AI suggestion or generated summary first.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: '8px',
            }}
          >
            <button
              className="button button-secondary"
              type="button"
              disabled={
                isGuest ||
                !jobTitle.trim() ||
                !tailoredReady ||
                savingTailoredResume
              }
              onClick={() => void handleSaveTailoredResume()}
            >
              {savingTailoredResume ? 'Saving…' : 'Save tailored resume'}
            </button>

            <button
              className="button button-secondary"
              type="button"
              disabled={!tailoredResumeId || previewingTailoredResume}
              onClick={() => void handleViewTailoredResume()}
            >
              {previewingTailoredResume
                ? 'Opening preview…'
                : 'View tailored resume'}
            </button>
          </div>

          {(isGuest || tailoredSaveMessage) && (
            <p className="tailored-save-message" role="status">
              {isGuest
                ? 'Create an account or sign in to use this feature.'
                : tailoredSaveMessage}
            </p>
          )}
        </section>

        <div className="field-group">
          <label htmlFor="company">Company <span>*</span></label>
          <input
            id="company"
            name="company"
            type="text"
            placeholder="Enter company name here"
            value={company}
            onChange={(event) => {
              setCompany(event.target.value)
              if (error) setError('')
            }}
            required
          />
        </div>

        <div className="field-group">
          <label htmlFor="job-title">Job title <span>*</span></label>
          <input
            id="job-title"
            name="job-title"
            type="text"
            placeholder="e.g. Product Designer"
            value={jobTitle}
            onChange={(event) => {
              setJobTitle(event.target.value)
              if (error) setError('')
              if (tailoredSaveMessage) setTailoredSaveMessage('')
            }}
            required
          />
        </div>

        <div className="field-group">
          <div className="label-row">
            <label htmlFor="job-description">Job description <span>*</span></label>
            <span className="field-hint">Paste the full listing</span>
          </div>
          <textarea
            id="job-description"
            name="job-description"
            rows={8}
            placeholder="Paste the job description here..."
            value={jobDescription}
            onChange={(event) => {
              setJobDescription(event.target.value)
              if (error) setError('')
            }}
            required
          />
        </div>

        {error && <p className="field-error" role="alert">{error}</p>}

        <div className="form-footer">
          <button className="text-button" type="button" onClick={handleBackToResume}>
            <span aria-hidden="true">&larr;</span>{' '}Back
          </button>
          <button className="button button-primary" type="submit">
            Submit <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </form>

      {showNewCopyConfirmation && (
        <div className="tailor-confirm-backdrop">
          <div className="tailor-confirm-dialog" role="alertdialog" aria-modal="true"
            aria-labelledby="tailor-confirm-title" aria-describedby="tailor-confirm-description">
            <span className="panel-icon">START OVER?</span>
            <h3 id="tailor-confirm-title">Start a new tailored copy?</h3>
            <p id="tailor-confirm-description">
              Submitting again will discard edits to the current tailored copy. Your original resume
              and saved database record will not change.
            </p>
            <div className="tailor-confirm-actions">
              <button ref={cancelConfirmationRef} className="button button-secondary" type="button"
                onClick={() => setShowNewCopyConfirmation(false)}>Keep Current Copy</button>
              <button className="button button-primary" type="button" onClick={createTailoredCopy}>
                Start New Tailored Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {submitted && (
        <div className="tailor-submitted-results" aria-live="polite">
          <div className="resume-suggestions-toolbar-copy">
            <span className="panel-icon">YOUR TAILORING RESULTS</span>
            <h3>{submitted.jobTitle} — {submitted.company}</h3>
            <p>Review the compatibility score, then open either panel to improve your tailored copy.</p>
            {(company.trim() !== submitted.company || jobTitle.trim() !== submitted.jobTitle ||
              jobDescription.trim() !== submitted.jobDescription) && (
              <p role="status">Job details changed. Submit again to update these results.</p>
            )}
          </div>
          <TailorResumeInsights
            key={submitted.version}
            jobDescription={submitted.jobDescription}
            onTailoredReadyChange={setTailoredReady}
          />
        </div>
      )}
    </section>
  )
}
