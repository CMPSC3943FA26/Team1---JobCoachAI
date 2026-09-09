// TailorPage.tsx
// Screen 02: Tailor the resume around the target role.
// This page reflects the upload + job description entry workflow from the design.
// It keeps the form fields and file upload interaction separated from the resume review
// screen so the flow stays close to the original static prototype.

import { Button } from '../components/Button'

export function TailorPage() {
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
          Paste the role you’re aiming for. We’ll pull out what matters and shape your strongest angle.
        </p>
      </div>

      <form className="job-form" id="job-form">
        <div className="tailor-actions">
          <Button variant="primary" type="button" id="create-resume-button">
            Create Resume <span aria-hidden="true">→</span>
          </Button>

          <input id="resume-upload" name="resume" type="file" accept=".pdf,.doc,.docx" />

          <label className="button button-secondary upload-button" htmlFor="resume-upload">
            Upload resume <span aria-hidden="true">↑</span>
          </label>
        </div>

        <p className="file-name" id="file-name">
          No resume selected
        </p>

        <div className="field-group">
          <label htmlFor="job-title">
            Job title <span>*</span>
          </label>
          <input id="job-title" name="job-title" type="text" placeholder="e.g. Product Designer" required />
        </div>

        <div className="field-group">
          <div className="label-row">
            <label htmlFor="job-description">
              Job description <span>*</span>
            </label>
            <span className="field-hint">Paste the full listing</span>
          </div>
          <textarea id="job-description" name="job-description" rows={8} placeholder="Paste the job description here..." required />
        </div>

        <div className="form-footer">
          <a className="text-button" href="#welcome">
            <span aria-hidden="true">←</span> Back
          </a>
        </div>
      </form>
    </section>
  )
}
