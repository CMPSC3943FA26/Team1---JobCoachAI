import { useState, type ChangeEvent, type FormEvent } from 'react';

/**
 * Tailor / intake page (page 2).
 *   #1  Add/Upload Resume
 *   #2  Paste Job Description
 *   #11 Create Resume from Scratch
 */

export type ResumeSource = 'uploaded' | 'scratch';

export interface TailorSubmission {
  jobTitle: string;
  jobDescription: string;
  resumeFile: File | null;
  source: ResumeSource;
}

export interface TailorPageProps {
  /** Opens the resume form (page 3): empty for 'scratch', pre-filled for 'uploaded'. */
  onOpenResume?: (source: ResumeSource, file: File | null) => void;
  onSubmit?: (submission: TailorSubmission) => void;
  onBack?: () => void;
  /** True once a from-scratch resume has been saved on page 3. */
  hasSavedResume?: boolean;
}

export default function TailorPage({
  onOpenResume,
  onSubmit,
  onBack,
  hasSavedResume = false,
}: TailorPageProps) {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [error, setError] = useState('');

  const hasResume = resumeFile !== null || hasSavedResume;

  /* #1 Add/Upload Resume */
  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setResumeFile(event.target.files?.[0] ?? null);
    setError('');
  }

  /* #11 Create Resume from Scratch, or edit the uploaded one */
  function handleOpenResume() {
    setError('');
    onOpenResume?.(resumeFile ? 'uploaded' : 'scratch', resumeFile);
  }

  /* #2 Paste Job Description */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasResume) {
      setError('Please create a resume.');
      return;
    }
    if (!jobTitle.trim() || !jobDescription.trim()) {
      setError('Add the job title and paste the job description before submitting.');
      return;
    }

    setError('');
    onSubmit?.({
      jobTitle: jobTitle.trim(),
      jobDescription: jobDescription.trim(),
      resumeFile,
      source: resumeFile ? 'uploaded' : 'scratch',
    });
  }

  return (
    <section className="screen" data-screen="tailor">
      <div className="screen-intro">
        <span className="section-kicker">02 / Tailor</span>
        <h2>
          Tell us about
          <br />
          <em>the opportunity.</em>
        </h2>
        <p>
          Paste the role you&rsquo;re aiming for. We&rsquo;ll pull out what matters and shape your
          strongest angle.
        </p>
      </div>

      <form className="job-form" noValidate onSubmit={handleSubmit}>
        <div className="tailor-actions">
          <button className="button button-primary" type="button" onClick={handleOpenResume}>
            {resumeFile ? 'Edit Resume' : 'Create Resume'} <span aria-hidden="true">&rarr;</span>
          </button>
          <input
            id="resume-upload"
            name="resume"
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleFileChange}
          />
          <label className="button button-secondary upload-button" htmlFor="resume-upload">
            Upload resume <span aria-hidden="true">&uarr;</span>
          </label>
        </div>

        <p className="file-name">{resumeFile ? resumeFile.name : 'No resume selected'}</p>

        <div className="field-group">
          <label htmlFor="job-title">
            Job title <span>*</span>
          </label>
          <input
            id="job-title"
            name="job-title"
            type="text"
            placeholder="e.g. Product Designer"
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
          />
        </div>

        <div className="field-group">
          <div className="label-row">
            <label htmlFor="job-description">
              Job description <span>*</span>
            </label>
            <span className="field-hint">Paste the full listing</span>
          </div>
          <textarea
            id="job-description"
            name="job-description"
            rows={8}
            placeholder="Paste the job description here..."
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
          />
        </div>

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}

        <div className="form-footer">
          <button className="text-button" type="button" onClick={onBack}>
            <span aria-hidden="true">&larr;</span> Back
          </button>
          <button className="button button-primary" type="submit">
            Submit <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </form>
    </section>
  );
}
