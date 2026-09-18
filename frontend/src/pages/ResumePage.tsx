import { useState } from 'react'

type ResumePageProps = {
  blankResume?: boolean
}

type SectionName =
  | 'summary'
  | 'education'
  | 'experience'
  | 'skills'
  | 'projects'

type EducationEntry = {
  school: string
  degree: string
  date: string
}

type ExperienceEntry = {
  company: string
  title: string
  date: string
  description: string
}

type ProjectEntry = {
  name: string
  description: string
}

export function ResumePage({
  blankResume = false,
}: ResumePageProps) {
  const [openSections, setOpenSections] = useState<
    Record<SectionName, boolean>
  >({
    summary: false,
    education: false,
    experience: false,
    skills: false,
    projects: false,
  })

  const [firstName, setFirstName] = useState(
    blankResume ? '' : 'Suprit'
  )

  const [lastName, setLastName] = useState(
    blankResume ? '' : 'Bijukshe'
  )

  const [email, setEmail] = useState(
    blankResume ? '' : 'suprit@example.com'
  )

  const [phone, setPhone] = useState(
    blankResume ? '' : '(252) 555-0123'
  )

  const [summary, setSummary] = useState(
    blankResume
      ? ''
      : 'Computer Science student with experience in technical support, software development, and systems administration.'
  )

  const [education, setEducation] = useState<EducationEntry[]>(
    blankResume
      ? []
      : [
          {
            school: 'East Central University',
            degree: 'B.S. Computer Science',
            date: 'Expected May 2027',
          },
        ]
  )

  const [experience, setExperience] = useState<
    ExperienceEntry[]
  >(
    blankResume
      ? []
      : [
          {
            company: 'Dell Technologies',
            title: 'Technical Support Engineer',
            date: '',
            description:
              'Diagnosed and resolved enterprise hardware, storage, RAID, firmware, and operating system issues.',
          },
        ]
  )

  const [skills, setSkills] = useState<string[]>(
    blankResume
      ? []
      : ['JavaScript', 'React', 'Python', 'Linux', 'Git']
  )

  const [projects, setProjects] = useState<ProjectEntry[]>(
    blankResume
      ? []
      : [
          {
            name: 'JobCoachAI',
            description:
              'AI-assisted resume and job application platform built with React and TypeScript.',
          },
        ]
  )

  const toggleSection = (section: SectionName) => {
    const isCurrentlyOpen = openSections[section]

    if (isCurrentlyOpen) {
      setOpenSections((previous) => ({
        ...previous,
        [section]: false,
      }))

      return
    }

    if (
      section === 'education' &&
      education.length === 0
    ) {
      setEducation([
        {
          school: '',
          degree: '',
          date: '',
        },
      ])
    }

    if (
      section === 'experience' &&
      experience.length === 0
    ) {
      setExperience([
        {
          company: '',
          title: '',
          date: '',
          description: '',
        },
      ])
    }

    if (
      section === 'skills' &&
      skills.length === 0
    ) {
      setSkills([''])
    }

    if (
      section === 'projects' &&
      projects.length === 0
    ) {
      setProjects([
        {
          name: '',
          description: '',
        },
      ])
    }

    setOpenSections((previous) => ({
      ...previous,
      [section]: true,
    }))
  }

  const deleteResume = () => {
    const shouldDelete = window.confirm(
      'Are you sure you want to delete this resume?'
    )

    if (!shouldDelete) return

    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setSummary('')
    setEducation([])
    setExperience([])
    setSkills([])
    setProjects([])

    setOpenSections({
      summary: false,
      education: false,
      experience: false,
      skills: false,
      projects: false,
    })
  }

  const exportResume = () => {
    window.print()
  }

  const saveResume = () => {
    window.alert('Resume saved locally.')
  }

  const addEducation = () => {
    setEducation((previous) => [
      ...previous,
      {
        school: '',
        degree: '',
        date: '',
      },
    ])

    setOpenSections((previous) => ({
      ...previous,
      education: true,
    }))
  }

  const addExperience = () => {
    setExperience((previous) => [
      ...previous,
      {
        company: '',
        title: '',
        date: '',
        description: '',
      },
    ])

    setOpenSections((previous) => ({
      ...previous,
      experience: true,
    }))
  }

  const addSkill = () => {
    setSkills((previous) => [
      ...previous,
      '',
    ])

    setOpenSections((previous) => ({
      ...previous,
      skills: true,
    }))
  }

  const addProject = () => {
    setProjects((previous) => [
      ...previous,
      {
        name: '',
        description: '',
      },
    ])

    setOpenSections((previous) => ({
      ...previous,
      projects: true,
    }))
  }

  const Chevron = ({
    section,
  }: {
    section: SectionName
  }) => (
    <span
      className={`resume-section-chevron ${
        openSections[section] ? 'open' : ''
      }`}
      aria-hidden="true"
    >
      ▼
    </span>
  )

  return (
    <section
      className="screen resume-editor-page"
      data-screen="parsed"
    >
      {/* Header */}

      <div className="resume-editor-header">
        <div className="screen-intro">
          <span className="section-kicker">
            03 / Resume
          </span>

          <h2>
            Build resume,
            <br />
            <em>your way.</em>
          </h2>

          <p>
            Edit your information, organize your experience,
            and preview your resume before exporting.
          </p>
        </div>

        <div className="resume-editor-header-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={deleteResume}
          >
            Delete Resume
          </button>

          <button
            type="button"
            className="button button-primary"
            onClick={exportResume}
          >
            Export Resume
            <span aria-hidden="true"> →</span>
          </button>
        </div>
      </div>

      {/* Local Notice */}

      <div className="resume-local-notice">
        <span className="resume-info-icon">
          i
        </span>

        <span>
          Changes stay local until connected to your account.
        </span>
      </div>

      {/* Personal Information */}

      <div className="resume-section">
        <div className="resume-section-header">
          <span className="resume-section-number">
            01
          </span>

          <span className="resume-section-heading">
            <strong>
              Personal Information
            </strong>

            <small>
              Shown at the top of your resume
            </small>
          </span>
        </div>

        <div className="resume-section-content">
          <div className="resume-personal-grid">

            <div className="field-group">
              <label htmlFor="resume-first-name">
                First name
              </label>

              <input
                id="resume-first-name"
                type="text"
                value={firstName}
                placeholder="First name"
                onChange={(event) =>
                  setFirstName(event.target.value)
                }
              />
            </div>

            <div className="field-group">
              <label htmlFor="resume-last-name">
                Last name
              </label>

              <input
                id="resume-last-name"
                type="text"
                value={lastName}
                placeholder="Last name"
                onChange={(event) =>
                  setLastName(event.target.value)
                }
              />
            </div>

            <div className="field-group">
              <label htmlFor="resume-email">
                Email address
              </label>

              <input
                id="resume-email"
                type="email"
                value={email}
                placeholder="you@example.com"
                onChange={(event) =>
                  setEmail(event.target.value)
                }
              />
            </div>

            <div className="field-group">
              <label htmlFor="resume-phone">
                Phone
              </label>

              <input
                id="resume-phone"
                type="tel"
                value={phone}
                placeholder="Phone number"
                onChange={(event) =>
                  setPhone(event.target.value)
                }
              />
            </div>

          </div>
        </div>
      </div>

      {/* Professional Summary */}

      <div className="resume-section">
        <div className="resume-section-header">

          <button
            type="button"
            className="resume-section-main"
            onClick={() =>
              toggleSection('summary')
            }
          >
            <span className="resume-section-number">
              02
            </span>

            <span className="resume-section-heading">
              <strong>
                Professional Summary
              </strong>

              <small>
                A brief overview of your experience
              </small>
            </span>

            <Chevron section="summary" />
          </button>

          <button
            type="button"
            className="button button-secondary resume-section-action"
            onClick={() =>
              setOpenSections((previous) => ({
                ...previous,
                summary: true,
              }))
            }
          >
            Edit Summary
          </button>

        </div>

        {openSections.summary && (
          <div className="resume-section-content">

            <div className="field-group">
              <label htmlFor="resume-summary">
                Professional summary
              </label>

              <textarea
                id="resume-summary"
                rows={6}
                value={summary}
                placeholder="Write a short professional summary..."
                onChange={(event) =>
                  setSummary(event.target.value)
                }
              />
            </div>

          </div>
        )}
      </div>

      {/* Education */}

      <div className="resume-section">
        <div className="resume-section-header">

          <button
            type="button"
            className="resume-section-main"
            onClick={() =>
              toggleSection('education')
            }
          >
            <span className="resume-section-number">
              03
            </span>

            <span className="resume-section-heading">
              <strong>
                Education
              </strong>

              <small>
                Add your educational background
              </small>
            </span>

            <Chevron section="education" />
          </button>

          <button
            type="button"
            className="button button-secondary resume-section-action"
            onClick={addEducation}
          >
            + Add Education
          </button>

        </div>

        {openSections.education && (
          <div className="resume-section-content">

            {education.map((item, index) => (
              <div
                className="resume-entry-card"
                key={index}
              >
                <div className="resume-entry-grid">

                  <div className="field-group">
                    <label
                      htmlFor={`education-school-${index}`}
                    >
                      School
                    </label>

                    <input
                      id={`education-school-${index}`}
                      type="text"
                      value={item.school}
                      placeholder="School or university"
                      onChange={(event) => {
                        const updated = [
                          ...education,
                        ]

                        updated[index] = {
                          ...updated[index],
                          school:
                            event.target.value,
                        }

                        setEducation(updated)
                      }}
                    />
                  </div>

                  <div className="field-group">
                    <label
                      htmlFor={`education-degree-${index}`}
                    >
                      Degree
                    </label>

                    <input
                      id={`education-degree-${index}`}
                      type="text"
                      value={item.degree}
                      placeholder="Degree or program"
                      onChange={(event) => {
                        const updated = [
                          ...education,
                        ]

                        updated[index] = {
                          ...updated[index],
                          degree:
                            event.target.value,
                        }

                        setEducation(updated)
                      }}
                    />
                  </div>

                  <div className="field-group">
                    <label
                      htmlFor={`education-date-${index}`}
                    >
                      Date
                    </label>

                    <input
                      id={`education-date-${index}`}
                      type="text"
                      value={item.date}
                      placeholder="Expected May 2027"
                      onChange={(event) => {
                        const updated = [
                          ...education,
                        ]

                        updated[index] = {
                          ...updated[index],
                          date:
                            event.target.value,
                        }

                        setEducation(updated)
                      }}
                    />
                  </div>

                </div>

                <button
                  type="button"
                  className="text-button resume-remove-entry"
                  onClick={() =>
                    setEducation((previous) =>
                      previous.filter(
                        (_, entryIndex) =>
                          entryIndex !== index
                      )
                    )
                  }
                >
                  Remove entry
                </button>

              </div>
            ))}

          </div>
        )}
      </div>

      {/* Experience */}

      <div className="resume-section">
        <div className="resume-section-header">

          <button
            type="button"
            className="resume-section-main"
            onClick={() =>
              toggleSection('experience')
            }
          >
            <span className="resume-section-number">
              04
            </span>

            <span className="resume-section-heading">
              <strong>
                Experience
              </strong>

              <small>
                Add your work experience
              </small>
            </span>

            <Chevron section="experience" />
          </button>

          <button
            type="button"
            className="button button-secondary resume-section-action"
            onClick={addExperience}
          >
            + Add Experience
          </button>

        </div>

        {openSections.experience && (
          <div className="resume-section-content">

            {experience.map((item, index) => (
              <div
                className="resume-entry-card"
                key={index}
              >
                <div className="resume-entry-grid">

                  <div className="field-group">
                    <label
                      htmlFor={`experience-title-${index}`}
                    >
                      Job title
                    </label>

                    <input
                      id={`experience-title-${index}`}
                      type="text"
                      value={item.title}
                      placeholder="Job title"
                      onChange={(event) => {
                        const updated = [
                          ...experience,
                        ]

                        updated[index] = {
                          ...updated[index],
                          title:
                            event.target.value,
                        }

                        setExperience(updated)
                      }}
                    />
                  </div>

                  <div className="field-group">
                    <label
                      htmlFor={`experience-company-${index}`}
                    >
                      Company
                    </label>

                    <input
                      id={`experience-company-${index}`}
                      type="text"
                      value={item.company}
                      placeholder="Company"
                      onChange={(event) => {
                        const updated = [
                          ...experience,
                        ]

                        updated[index] = {
                          ...updated[index],
                          company:
                            event.target.value,
                        }

                        setExperience(updated)
                      }}
                    />
                  </div>

                  <div className="field-group">
                    <label
                      htmlFor={`experience-date-${index}`}
                    >
                      Date
                    </label>

                    <input
                      id={`experience-date-${index}`}
                      type="text"
                      value={item.date}
                      placeholder="2024 – Present"
                      onChange={(event) => {
                        const updated = [
                          ...experience,
                        ]

                        updated[index] = {
                          ...updated[index],
                          date:
                            event.target.value,
                        }

                        setExperience(updated)
                      }}
                    />
                  </div>

                </div>

                <div className="field-group">
                  <label
                    htmlFor={`experience-description-${index}`}
                  >
                    Description
                  </label>

                  <textarea
                    id={`experience-description-${index}`}
                    rows={5}
                    value={item.description}
                    placeholder="Describe your responsibilities and accomplishments..."
                    onChange={(event) => {
                      const updated = [
                        ...experience,
                      ]

                      updated[index] = {
                        ...updated[index],
                        description:
                          event.target.value,
                      }

                      setExperience(updated)
                    }}
                  />
                </div>

                <button
                  type="button"
                  className="text-button resume-remove-entry"
                  onClick={() =>
                    setExperience((previous) =>
                      previous.filter(
                        (_, entryIndex) =>
                          entryIndex !== index
                      )
                    )
                  }
                >
                  Remove entry
                </button>

              </div>
            ))}

          </div>
        )}
      </div>

      {/* Skills */}

      <div className="resume-section">
        <div className="resume-section-header">

          <button
            type="button"
            className="resume-section-main"
            onClick={() =>
              toggleSection('skills')
            }
          >
            <span className="resume-section-number">
              05
            </span>

            <span className="resume-section-heading">
              <strong>
                Skills
              </strong>

              <small>
                Add your key skills
              </small>
            </span>

            <Chevron section="skills" />
          </button>

          <button
            type="button"
            className="button button-secondary resume-section-action"
            onClick={addSkill}
          >
            + Add Skill
          </button>

        </div>

        {openSections.skills && (
          <div className="resume-section-content">

            <div className="resume-skills-editor">

              {skills.map((skill, index) => (
                <div
                  className="resume-skill-field"
                  key={index}
                >
                  <div className="field-group">
                    <label
                      htmlFor={`resume-skill-${index}`}
                    >
                      Skill
                    </label>

                    <input
                      id={`resume-skill-${index}`}
                      type="text"
                      value={skill}
                      placeholder="e.g. Python"
                      onChange={(event) => {
                        const updated = [
                          ...skills,
                        ]

                        updated[index] =
                          event.target.value

                        setSkills(updated)
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setSkills((previous) =>
                        previous.filter(
                          (_, skillIndex) =>
                            skillIndex !== index
                        )
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}

            </div>

          </div>
        )}
      </div>

      {/* Projects */}

      <div className="resume-section">
        <div className="resume-section-header">

          <button
            type="button"
            className="resume-section-main"
            onClick={() =>
              toggleSection('projects')
            }
          >
            <span className="resume-section-number">
              06
            </span>

            <span className="resume-section-heading">
              <strong>
                Projects
              </strong>

              <small>
                Showcase your notable projects
              </small>
            </span>

            <Chevron section="projects" />
          </button>

          <button
            type="button"
            className="button button-secondary resume-section-action"
            onClick={addProject}
          >
            + Add Project
          </button>

        </div>

        {openSections.projects && (
          <div className="resume-section-content">

            {projects.map((project, index) => (
              <div
                className="resume-entry-card"
                key={index}
              >

                <div className="field-group">
                  <label
                    htmlFor={`project-name-${index}`}
                  >
                    Project name
                  </label>

                  <input
                    id={`project-name-${index}`}
                    type="text"
                    value={project.name}
                    placeholder="Project name"
                    onChange={(event) => {
                      const updated = [
                        ...projects,
                      ]

                      updated[index] = {
                        ...updated[index],
                        name:
                          event.target.value,
                      }

                      setProjects(updated)
                    }}
                  />
                </div>

                <div className="field-group">
                  <label
                    htmlFor={`project-description-${index}`}
                  >
                    Description
                  </label>

                  <textarea
                    id={`project-description-${index}`}
                    rows={5}
                    value={project.description}
                    placeholder="Describe the project..."
                    onChange={(event) => {
                      const updated = [
                        ...projects,
                      ]

                      updated[index] = {
                        ...updated[index],
                        description:
                          event.target.value,
                      }

                      setProjects(updated)
                    }}
                  />
                </div>

                <button
                  type="button"
                  className="text-button resume-remove-entry"
                  onClick={() =>
                    setProjects((previous) =>
                      previous.filter(
                        (_, projectIndex) =>
                          projectIndex !== index
                      )
                    )
                  }
                >
                  Remove entry
                </button>

              </div>
            ))}

          </div>
        )}
      </div>

      {/* Tip */}

      <div className="resume-tip">
        <strong>
          Tip
        </strong>

        <p>
          Review your information before exporting your
          resume.
        </p>
      </div>

      {/* Preview */}

      <section className="resume-preview-section">

        <div className="resume-preview-heading">

          <div>
            <span className="section-kicker">
              Preview
            </span>

            <h3>
              Resume Preview
            </h3>

            <p>
              Changes made above appear here automatically.
            </p>
          </div>

          <button
            type="button"
            className="button button-secondary"
            onClick={exportResume}
          >
            Print Preview
          </button>

        </div>

        <div className="resume-preview-background">

          <article className="resume-preview-page-frame">

            <header className="preview-header">
              <h1>
                {firstName || 'First'}{' '}
                {lastName || 'Last'}
              </h1>

              <p>
                {email || 'email@example.com'}

                {phone && (
                  <>
                    {' '}| {phone}
                  </>
                )}
              </p>
            </header>

            {summary && (
              <section className="preview-section">
                <h3>
                  Professional Summary
                </h3>

                <p>
                  {summary}
                </p>
              </section>
            )}

            {education.length > 0 && (
              <section className="preview-section">
                <h3>
                  Education
                </h3>

                {education.map((item, index) => (
                  <div
                    className="preview-entry"
                    key={index}
                  >
                    <div className="preview-entry-heading">

                      <strong>
                        {item.school || 'School'}
                      </strong>

                      <span>
                        {item.date}
                      </span>

                    </div>

                    <p>
                      {item.degree}
                    </p>
                  </div>
                ))}
              </section>
            )}

            {experience.length > 0 && (
              <section className="preview-section">
                <h3>
                  Experience
                </h3>

                {experience.map((item, index) => (
                  <div
                    className="preview-entry"
                    key={index}
                  >

                    <div className="preview-entry-heading">

                      <strong>
                        {item.title || 'Job Title'}
                      </strong>

                      <span>
                        {item.date}
                      </span>

                    </div>

                    {item.company && (
                      <p className="preview-company">
                        {item.company}
                      </p>
                    )}

                    {item.description && (
                      <p>
                        {item.description}
                      </p>
                    )}

                  </div>
                ))}
              </section>
            )}

            {skills.filter(
              (skill) =>
                skill.trim() !== ''
            ).length > 0 && (
              <section className="preview-section">
                <h3>
                  Skills
                </h3>

                <p>
                  {skills
                    .filter(
                      (skill) =>
                        skill.trim() !== ''
                    )
                    .join(' • ')}
                </p>
              </section>
            )}

            {projects.length > 0 && (
              <section className="preview-section">
                <h3>
                  Projects
                </h3>

                {projects.map((project, index) => (
                  <div
                    className="preview-entry"
                    key={index}
                  >
                    <strong>
                      {project.name || 'Project'}
                    </strong>

                    {project.description && (
                      <p>
                        {project.description}
                      </p>
                    )}
                  </div>
                ))}
              </section>
            )}

          </article>

        </div>

      </section>

      {/* Bottom Actions */}

      <div className="resume-bottom-actions">

        <button
          type="button"
          className="button button-secondary"
          onClick={saveResume}
        >
          Save Resume
        </button>

        <button
          type="button"
          className="button button-primary"
          onClick={exportResume}
        >
          Export Resume
          <span aria-hidden="true"> →</span>
        </button>

      </div>

    </section>
  )
}