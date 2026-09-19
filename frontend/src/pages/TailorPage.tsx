import {
  useState,
  type FormEvent,
} from 'react'

/**
 * Tailor / intake page (page 2).
 *   #1  Add/Upload Resume
 *   #2  Paste Job Description
 *   #11 Create Resume from Scratch
 */

export type ResumeSource =
  | 'uploaded'
  | 'scratch'

export interface TailorSubmission {
  jobTitle: string
  jobDescription: string
  resumeFile: File | null
  source: ResumeSource
}

export interface TailorPageProps {
  onOpenResume: (
    source: ResumeSource,
    file: File | null
  ) => void

  onSubmit: (
    submission: TailorSubmission
  ) => void

  onBack?: () => void

  hasSavedResume?: boolean
}

export default function TailorPage({
  onSubmit,
  onBack,
}: TailorPageProps) {

  const [company, setCompany] =
    useState('')

  const [jobTitle, setJobTitle] =
    useState('')

  const [
    jobDescription,
    setJobDescription,
  ] = useState('')

  const [error, setError] =
    useState('')

  const [tailoredSaveMessage, setTailoredSaveMessage] =
    useState('')



  /*
   * Submit Tailor form.
   * Validation happens here first.
   * If successful, App.tsx navigates to Page 3.
   */
  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    /*
     * Job title and job description are required.
     * Show a browser alert if either field is empty.
     */
    if (
      !jobTitle.trim() ||
      !jobDescription.trim()
    ) {
      const message =
        'Please enter the company name, job title and job description to proceed.'

      setError(message)
      return
    }


    setError('')

    onSubmit({
      jobTitle:
        jobTitle.trim(),

      jobDescription:
        jobDescription.trim(),

      resumeFile: null,

      source: 'scratch',
    })
  }

  return (
    <section
      className="screen"
      data-screen="tailor"
    >
      <div className="screen-intro">
        <span className="section-kicker">
          03 / Tailor your resume
        </span>

        <h2>
          Tailor smarter.
          <br />

          <em>
            Apply stronger.
          </em>
        </h2>

        <p>
          Add the company, job title, and
          job description, then click{' '}
          <strong>
            Submit
          </strong>
          . JobCoachAI will analyze the
          match and help you strengthen
          your resume.
        </p>
      </div>

      <form
        className="job-form"
        noValidate
        onSubmit={handleSubmit}
      >

        <section className="tailored-save-card">
          <div className="tailored-save-copy">
            <span className="panel-icon">
              JOB-SPECIFIC VERSION
            </span>

            <h3>Save a tailored resume</h3>

            <p>
              Save a copy for this role without changing your main resume.
              The job title you enter below will be used to label the copy.
            </p>
          </div>

          <button
            className="button button-secondary"
            type="button"
            disabled={!jobTitle.trim()}
            onClick={() => {
              const title = jobTitle.trim()

              if (!title) {
                setTailoredSaveMessage(
                  'Add the job title below before saving a tailored resume.'
                )
                return
              }

              setTailoredSaveMessage(
                `Tailored resume ready to save for ${title}.`
              )
            }}
          >
            Save tailored resume
          </button>

          {tailoredSaveMessage && (
            <p
              className="tailored-save-message"
              role="status"
            >
              {tailoredSaveMessage}
            </p>
          )}
        </section>

        <div className="field-group">
          <label htmlFor="company">
            Company
          </label>

          <input
            id="company"
            name="company"
            type="text"
            placeholder="Enter company name here"
            value={company}
            onChange={(event) => {
              setCompany(
                event.target.value
              )
              setError('')
            }}
          />
        </div>

        <div className="field-group">
          <label htmlFor="job-title">
            Job title{' '}
            <span>*</span>
          </label>

          <input
            id="job-title"
            name="job-title"
            type="text"
            placeholder="e.g. Product Designer"
            value={jobTitle}
            onChange={(event) => {
              setJobTitle(
                event.target.value
              )

              if (error) {
                setError('')
              }

              if (tailoredSaveMessage) {
                setTailoredSaveMessage('')
              }
            }}
          />
        </div>

        <div className="field-group">
          <div className="label-row">
            <label htmlFor="job-description">
              Job description{' '}
              <span>*</span>
            </label>

            <span className="field-hint">
              Paste the full listing
            </span>
          </div>

          <textarea
            id="job-description"
            name="job-description"
            rows={8}
            placeholder="Paste the job description here..."
            value={jobDescription}
            onChange={(event) => {
              setJobDescription(
                event.target.value
              )

              if (error) {
                setError('')
              }
            }}
          />
        </div>

        {error && (
          <p
            className="field-error"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="form-footer">
          <button
            className="text-button"
            type="button"
            onClick={onBack}
          >
            <span aria-hidden="true">
              &larr;
            </span>{' '}
            Back
          </button>

          <button
            className="button button-primary"
            type="submit"
          >
            Submit

            <span aria-hidden="true">
              &rarr;
            </span>
          </button>
        </div>
      </form>
    </section>
  )
}
