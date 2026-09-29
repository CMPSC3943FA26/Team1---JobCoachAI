import {
  useState,
  useRef,
  useEffect,
  type FormEvent,
} from 'react'

import { TailorResumeInsights } from './TailorResumeInsights'

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
}

export default function TailorPage({
  onSubmit,
  isGuest = true,
}: TailorPageProps) {
  const [company, setCompany] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [error, setError] = useState('')
  const [tailoredSaveMessage, setTailoredSaveMessage] = useState('')
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

  function handleBackToResume() {
    window.location.hash = '#parsed'
  }

  return (
    <section className="screen" data-screen="tailor">
      <div className="screen-intro">
        <span className="section-kicker">03 / Tailor your resume</span>
        <h2>Tailor smarter.<br /><em>Apply stronger.</em></h2>
        <p>
          Add the company name, job title, and job description, then click{' '}
          <strong>Submit</strong> to see your resume match and expand the summary or suggestion panels.
        </p>
      </div>

      <form className="job-form" noValidate onSubmit={handleSubmit}>
        <section className="tailored-save-card">
          <div className="tailored-save-copy">
            <span className="panel-icon">JOB-SPECIFIC VERSION</span>
            <h3>Save a tailored resume</h3>
            <p>
              Save a copy for this role without changing your main resume.
              The job title you enter below will be used to label the copy.
            </p>
          </div>

          {/* Placeholder until tailored resume saving is implemented. */}
          <button
            className="button button-secondary"
            type="button"
            disabled={isGuest || !jobTitle.trim()}
            onClick={() => {
              if (isGuest) return
              const title = jobTitle.trim()
              if (!title) {
                setTailoredSaveMessage('Add the job title below before saving a tailored resume.')
                return
              }
              setTailoredSaveMessage(`Tailored resume for ${title} is ready for a future save workflow. Saving is not connected yet.`)
            }}
          >
            Save tailored resume
          </button>

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
          <TailorResumeInsights key={submitted.version} jobDescription={submitted.jobDescription} />
        </div>
      )}
    </section>
  )
}
