import {
  useState,
  type ChangeEvent,
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
  onOpenResume,
  onSubmit,
  onBack,
  hasSavedResume = false,
}: TailorPageProps) {
  const [resumeFile, setResumeFile] =
    useState<File | null>(null)

  const [jobTitle, setJobTitle] =
    useState('')

  const [
    jobDescription,
    setJobDescription,
  ] = useState('')

  const [error, setError] =
    useState('')

  const hasResume =
    resumeFile !== null ||
    hasSavedResume

  /* Upload resume */
  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0] ?? null

    setResumeFile(file)
    setError('')
  }

  /*
   * Create Resume / Edit Resume
   * Opens Page 3.
   */
  function handleOpenResume() {
    setError('')

    const source: ResumeSource =
      resumeFile
        ? 'uploaded'
        : 'scratch'

    onOpenResume(
      source,
      resumeFile
    )
  }

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
        'Please enter the job title and job description to proceed.'

      setError(message)
      return
    }

    if (!hasResume) {
      const message =
        'Please create or upload a resume to proceed.'

      setError(message)
      return
    }

    setError('')

    const source: ResumeSource =
      resumeFile
        ? 'uploaded'
        : 'scratch'

    onSubmit({
      jobTitle:
        jobTitle.trim(),

      jobDescription:
        jobDescription.trim(),

      resumeFile,

      source,
    })
  }

  return (
    <section
      className="screen"
      data-screen="tailor"
    >
      <div className="screen-intro">
        <span className="section-kicker">
          02 / Tailor
        </span>

        <h2>
          Tailor smarter.
          <br />

          <em>
            Apply stronger.
          </em>
        </h2>

        <p>
          Upload or create your resume,
          add the job description, then
          click{' '}
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
        <div className="tailor-actions">
          <button
            className="button button-primary"
            type="button"
            onClick={handleOpenResume}
          >
            {hasResume
              ? 'Edit Resume'
              : 'Create Resume'}

            <span aria-hidden="true">
              &rarr;
            </span>
          </button>

          <input
            id="resume-upload"
            name="resume"
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleFileChange}
          />

          <label
            className="button button-secondary upload-button"
            htmlFor="resume-upload"
          >
            Upload resume

            <span aria-hidden="true">
              &uarr;
            </span>
          </label>
        </div>

        <p className="file-name">
          {resumeFile
            ? resumeFile.name
            : 'No resume selected'}
        </p>

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
