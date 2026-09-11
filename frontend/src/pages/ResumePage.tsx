import { useRef, useState } from 'react'
import { Button } from '../components/Button'

type ResumePageProps = {
  blankResume?: boolean
}

const defaultEditorHtml = `
  <h1>Your Name</h1>
  <p class="editor-contact">you@example.com · City, State · portfolio.example.com</p>

  <h2>Professional Summary</h2>
  <p>Product-minded designer who turns complex problems into clear, intuitive experiences.</p>

  <h2>Experience</h2>
  <p><strong>Product Designer</strong><br />Company Name · 2022 - Present</p>

  <h2>Skills</h2>
  <p>Figma · UX research · Prototyping · Design systems</p>
`

const blankEditorHtml = `
  <h1>Your Name</h1>
  <p class="editor-contact">Add your contact information</p>

  <h2>Professional Summary</h2>
  <p>Add your professional summary.</p>

  <h2>Experience</h2>
  <p>Add your experience.</p>

  <h2>Skills</h2>
  <p>Add your skills.</p>
`

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      }[character] ?? character)
  )
}

function buildResumePreview(
  form: HTMLFormElement | null
) {
  if (!form) {
    return blankEditorHtml
  }

  const firstName =
    (
      form.querySelector(
        '#first-name'
      ) as HTMLInputElement | null
    )?.value ?? ''

  const lastName =
    (
      form.querySelector(
        '#last-name'
      ) as HTMLInputElement | null
    )?.value ?? ''

  const phone =
    (
      form.querySelector(
        '#phone'
      ) as HTMLInputElement | null
    )?.value ?? ''

  const email =
    (
      form.querySelector(
        '#email'
      ) as HTMLInputElement | null
    )?.value ?? ''

  const summaryFields = Array.from(
    form.querySelectorAll(
      '[name="summary[]"]'
    )
  ) as HTMLTextAreaElement[]

  const experienceFields = Array.from(
    form.querySelectorAll(
      '[name="experience[]"]'
    )
  ) as HTMLTextAreaElement[]

  const skillsFields = Array.from(
    form.querySelectorAll(
      '[name="skills[]"]'
    )
  ) as HTMLInputElement[]

  const summary = summaryFields
    .map((field) => field.value.trim())
    .filter(Boolean)

  const experience = experienceFields
    .map((field) => field.value.trim())
    .filter(Boolean)

  const skills = skillsFields
    .map((field) => field.value.trim())
    .filter(Boolean)

  const fullName =
    `${firstName} ${lastName}`.trim() ||
    'Your Name'

  const contact = [email, phone]
    .filter(Boolean)
    .join(' · ')

  const summaryHtml = summary.length
    ? summary
        .map(
          (item) =>
            `<p>${escapeHtml(item)}</p>`
        )
        .join('')
    : '<p>Add your professional summary.</p>'

  const experienceHtml = experience.length
    ? experience
        .map(
          (item) =>
            `<p>${escapeHtml(item).replace(
              /\n/g,
              '<br>'
            )}</p>`
        )
        .join('')
    : '<p>Add your experience.</p>'

  const skillText = skills.length
    ? skills.join(' · ')
    : 'Add your skills.'

  return `
    <h1>${escapeHtml(fullName)}</h1>

    <p class="editor-contact">
      ${escapeHtml(
        contact ||
          'Add your contact information'
      )}
    </p>

    <h2>Professional Summary</h2>
    ${summaryHtml}

    <h2>Experience</h2>
    ${experienceHtml}

    <h2>Skills</h2>
    <p>${escapeHtml(skillText)}</p>
  `
}

export function ResumePage({
  blankResume = false,
}: ResumePageProps) {

  const formRef =
    useRef<HTMLFormElement | null>(null)

  const editorRef =
    useRef<HTMLDivElement | null>(null)

  const [editorVisible, setEditorVisible] =
    useState(false)

  const [editorHtml, setEditorHtml] =
    useState(
      blankResume
        ? blankEditorHtml
        : defaultEditorHtml
    )

  const [isEditing, setIsEditing] =
    useState(false)

  const [showWarning, setShowWarning] =
    useState(false)

  const updatePageWarning = () => {
    const formText =
      formRef.current?.textContent ?? ''

    const editorText =
      editorRef.current?.textContent ?? ''

    const contentLength =
      `${formText}${editorText}`.replace(
        /\s/g,
        ''
      ).length

    setShowWarning(contentLength >= 1200)
  }

  const openResumeEditor = (
    importFields: boolean
  ) => {

    if (
      importFields &&
      formRef.current
    ) {
      setEditorHtml(
        buildResumePreview(
          formRef.current
        )
      )
    }

    setEditorVisible(true)
    setIsEditing(true)

    setTimeout(
      updatePageWarning,
      0
    )
  }

  const handleExportDocx = () => {
    const documentHtml =
      `<html><body>${editorHtml}</body></html>`

    const file = new Blob(
      [documentHtml],
      {
        type:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }
    )

    const link =
      document.createElement('a')

    link.href =
      URL.createObjectURL(file)

    link.download =
      'jobcoach-resume.docx'

    link.click()

    URL.revokeObjectURL(
      link.href
    )
  }

  const handleExportPdf = () => {
    updatePageWarning()
    window.print()
  }

  return (
    <section
      className="screen"
      data-screen="parsed"
    >

      {/* PAGE HEADER */}
      <div className="parsed-header">

        <div className="screen-intro">

          <span className="section-kicker">
            03 / Your fit
          </span>

          <h2>
            Your resume,
            <br />
            <em>in focus.</em>
          </h2>

          <p>
            {blankResume
              ? 'Start building your resume by entering your information below.'
              : 'Review the parsed details below. Guests can manually populate these fields before moving on.'}
          </p>

        </div>


        {/* Only show match score when resume isn't blank */}
        {!blankResume && (
          <div className="match-score">

            <span>
              Role match
            </span>

            <strong>
              84<span>%</span>
            </strong>

            <small>
              Strong foundation
            </small>

          </div>
        )}

      </div>


      {/* TOOLBAR */}
      <div className="parsed-toolbar">

        <div className="edit-actions">

          <Button
            variant="secondary"
            type="button"
            id="edit-uploaded-button"
            disabled
          >
            Edit uploaded resume
            <span aria-hidden="true">
              ↗
            </span>
          </Button>

          <Button
            variant="primary"
            type="button"
            id="edit-parsed-button"
            onClick={() =>
              openResumeEditor(true)
            }
          >
            {isEditing
              ? 'Save changes'
              : 'Edit resume'}

            <span aria-hidden="true">
              ↗
            </span>
          </Button>

        </div>


        <div className="export-actions">

          <button
            className="text-button"
            type="button"
            id="export-docx-button"
            onClick={handleExportDocx}
          >
            Export DOCX
          </button>

          <button
            className="text-button"
            type="button"
            id="export-pdf-button"
            onClick={handleExportPdf}
          >
            Export PDF
          </button>

        </div>

      </div>


      <p
        className="page-warning"
        id="page-warning"
        hidden={!showWarning}
      >
        Some content may exceed one page.
        Shorten the resume before exporting.
      </p>


      {/* RESUME FORM */}
      <form
        ref={formRef}
        className="parsed-form"
        id="parsed-form"
        onInput={updatePageWarning}
        onSubmit={(event) => {
          event.preventDefault()
          window.location.hash =
            '#tailor'
        }}
      >

        {/* USER INFO */}
        <section className="resume-section user-info-section">

          <div className="collection-header">

            <div>
              <span className="card-index">
                00
              </span>

              <h3>
                User information
              </h3>
            </div>

            <span className="field-hint">
              Shown at the top of your resume
            </span>

          </div>


          <div className="user-info-grid">

            <div className="field-group">

              <label htmlFor="first-name">
                First name
              </label>

              <input
                id="first-name"
                name="first-name"
                type="text"
                defaultValue={
                  blankResume
                    ? ''
                    : 'Jordan'
                }
                placeholder="First name"
              />

            </div>


            <div className="field-group">

              <label htmlFor="last-name">
                Last name
              </label>

              <input
                id="last-name"
                name="last-name"
                type="text"
                defaultValue={
                  blankResume
                    ? ''
                    : 'Lee'
                }
                placeholder="Last name"
              />

            </div>


            <div className="field-group">

              <label htmlFor="phone">
                Phone
              </label>

              <input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={
                  blankResume
                    ? ''
                    : '(415) 555-0148'
                }
                placeholder="(555) 555-5555"
              />

            </div>


            <div className="field-group">

              <label htmlFor="email">
                Email
              </label>

              <input
                id="email"
                name="email"
                type="email"
                defaultValue={
                  blankResume
                    ? ''
                    : 'jordan.lee@example.com'
                }
                placeholder="you@example.com"
              />

            </div>

          </div>

        </section>


        {/* PROFESSIONAL SUMMARY */}
        <section
          className="resume-section"
          data-collection="summary"
        >

          <div className="collection-header">

            <div>

              <span className="card-index">
                01
              </span>

              <h3>
                Professional summary
              </h3>

            </div>

            <button
              className="add-button"
              type="button"
              data-add="summary"
            >
              + Add summary
            </button>

          </div>


          <div
            className="collection-list"
            id="summary-fields"
          >

            <div className="editable-row">

              <textarea
                name="summary[]"
                rows={4}
                placeholder="Write a short professional summary..."
                defaultValue={
                  blankResume
                    ? ''
                    : 'Product-minded designer who turns complex problems into clear, intuitive experiences. You bring a thoughtful balance of user empathy, sharp visual craft, and cross-functional momentum.'
                }
              />

              <button
                className="remove-button"
                type="button"
                data-remove
                aria-label="Remove professional summary"
              >
                Remove
              </button>

            </div>

          </div>

        </section>


        {/* EXPERIENCE */}
        <section
          className="resume-section"
          data-collection="experience"
        >

          <div className="collection-header">

            <div>

              <span className="card-index">
                02
              </span>

              <h3>
                Experience
              </h3>

            </div>

            <button
              className="add-button"
              type="button"
              data-add="experience"
            >
              + Add experience
            </button>

          </div>


          <div
            className="collection-list"
            id="experience-fields"
          >

            <div className="editable-row">

              <textarea
                name="experience[]"
                rows={4}
                placeholder="Role, company, dates, and key accomplishments..."
                defaultValue={
                  blankResume
                    ? ''
                    : `Senior Product Designer | Northstar Labs | 2022 - Present
Led a redesign of the onboarding experience that improved activation by 28% and created a reusable design system with product and engineering.`
                }
              />

              <button
                className="remove-button"
                type="button"
                data-remove
                aria-label="Remove experience"
              >
                Remove
              </button>

            </div>

            {!blankResume && (
              <div className="editable-row">

                <textarea
                  name="experience[]"
                  rows={4}
                  placeholder="Role, company, dates, and key accomplishments..."
                  defaultValue={`UX Designer | Brightline Studio | 2019 - 2022
Planned user research, built interactive prototypes, and partnered with clients to launch accessible web products.`}
                />

                <button
                  className="remove-button"
                  type="button"
                  data-remove
                  aria-label="Remove experience"
                >
                  Remove
                </button>

              </div>
            )}

          </div>

        </section>


        {/* SKILLS */}
        <section
          className="resume-section"
          data-collection="skills"
        >

          <div className="collection-header">

            <div>

              <span className="card-index">
                03
              </span>

              <h3>
                Skills
              </h3>

            </div>

            <button
              className="add-button"
              type="button"
              data-add="skills"
            >
              + Add skill
            </button>

          </div>


          <div
            className="collection-list"
            id="skills-fields"
          >

            <div className="editable-row">

              <input
                name="skills[]"
                type="text"
                defaultValue={
                  blankResume
                    ? ''
                    : 'Product strategy'
                }
                placeholder="e.g. Figma, UX research, prototyping"
              />

              <button
                className="remove-button"
                type="button"
                data-remove
                aria-label="Remove skill"
              >
                Remove
              </button>

            </div>


            {!blankResume && (
              <>
                <div className="editable-row">

                  <input
                    name="skills[]"
                    type="text"
                    defaultValue="UX research"
                    placeholder="e.g. Figma, UX research, prototyping"
                  />

                  <button
                    className="remove-button"
                    type="button"
                    data-remove
                    aria-label="Remove skill"
                  >
                    Remove
                  </button>

                </div>


                <div className="editable-row">

                  <input
                    name="skills[]"
                    type="text"
                    defaultValue="Figma and prototyping"
                    placeholder="e.g. Figma, UX research, prototyping"
                  />

                  <button
                    className="remove-button"
                    type="button"
                    data-remove
                    aria-label="Remove skill"
                  >
                    Remove
                  </button>

                </div>


                <div className="editable-row">

                  <input
                    name="skills[]"
                    type="text"
                    defaultValue="Design systems"
                    placeholder="e.g. Figma, UX research, prototyping"
                  />

                  <button
                    className="remove-button"
                    type="button"
                    data-remove
                    aria-label="Remove skill"
                  >
                    Remove
                  </button>

                </div>


                <div className="editable-row">

                  <input
                    name="skills[]"
                    type="text"
                    defaultValue="Cross-functional leadership"
                    placeholder="e.g. Figma, UX research, prototyping"
                  />

                  <button
                    className="remove-button"
                    type="button"
                    data-remove
                    aria-label="Remove skill"
                  >
                    Remove
                  </button>

                </div>
              </>
            )}

          </div>


          <p className="field-hint manual-hint">
            Add each skill as its own field.
          </p>

        </section>

      </form>


      {/* FULL RESUME EDITOR */}
      {editorVisible && (
        <section
          className="document-editor"
          id="document-editor"
        >

          <div className="editor-header">

            <div>

              <span className="card-index">
                04
              </span>

              <h3>
                Full resume editor
              </h3>

            </div>

            <span className="field-hint">
              Guest document workspace
            </span>

          </div>


          <div
            ref={editorRef}
            className={`editor-paper ${
              isEditing
                ? 'editing'
                : ''
            }`}
            id="resume-editor"
            contentEditable={isEditing}
            role="textbox"
            aria-label="Full resume editor"
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{
              __html: editorHtml,
            }}
            onInput={() =>
              updatePageWarning()
            }
          />

        </section>
      )}


      {/* PAGE FOOTER */}
      <div className="parsed-footer">

        <a
          className="text-button"
          href="#tailor"
        >
          <span aria-hidden="true">
            ←
          </span>

          Change role
        </a>


        <Button
          variant="primary"
          type="submit"
          form="parsed-form"
        >
          Save resume details

          <span aria-hidden="true">
            →
          </span>
        </Button>

      </div>

    </section>
  )
}