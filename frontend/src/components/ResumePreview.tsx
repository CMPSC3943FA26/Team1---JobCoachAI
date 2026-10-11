import type { ReactNode } from 'react'

// Shared by the Page 2 editor and the Page 3 tailored preview.
export type PreviewSection = {
  key: string
  title?: string
  entries: (string | Record<string, unknown>)[]
}

type PreviewProfile = {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  location?: string
}

type PreviewProps = {
  profile: PreviewProfile
  sections: PreviewSection[]
  renderField?: (section: string, index: number, key: string, value: string) => ReactNode
}

const sectionLabels: Record<string, string> = {
  summary: 'Professional Summary',
  work_experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  certifications: 'Certifications',
}

export function ResumePreview({ profile, sections, renderField }: PreviewProps) {
  const show = (section: string, index: number, key: string, value: unknown): ReactNode => {
    if (typeof value !== 'string' || !value.trim()) return null
    return renderField ? renderField(section, index, key, value) : value
  }
  const str = (entry: Record<string, unknown>, key: string) =>
    typeof entry[key] === 'string' ? (entry[key] as string) : ''
  const pair = (section: string, index: number, entry: Record<string, unknown>, keys: string[], separator: string) =>
    keys.filter((key) => str(entry, key).trim()).map((key, i) => (
      <span key={key}>{i > 0 ? separator : ''}{show(section, index, key, entry[key])}</span>
    ))
  const sectionHasContent = (section: PreviewSection) => section.entries.some((entry) =>
    typeof entry === 'string' ? !!entry.trim() : Object.entries(entry).some(([key, value]) =>
      key !== 'id' && key !== 'sort_order' && typeof value === 'string' && !!value.trim()))

  return (
    <div className="resume-preview-page-frame">
      <div className="preview-header">
        <h1>{[profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Your name'}</h1>
        <p>{[profile.email, profile.phone, profile.location].filter(Boolean).join(' • ')}</p>
      </div>
      {sections.filter(sectionHasContent).map((section) => (
        <div className="preview-section" key={section.key}>
          <h2>{section.title ?? sectionLabels[section.key] ?? section.key.replace(/_/g, ' ')}</h2>
          {section.key === 'skills' ? (
            <p className="preview-skills-line">
              {section.entries.map((entry, index) => {
                const value = typeof entry === 'string' ? entry : str(entry, 'skill_name')
                if (!value.trim()) return null
                return <span key={index}>{index > 0 ? ' • ' : ''}{show(section.key, index, typeof entry === 'string' ? 'value' : 'skill_name', value)}</span>
              })}
            </p>
          ) : section.entries.map((entry, index) => {
            if (typeof entry === 'string') return entry.trim() ? (
              <p className="preview-body-text" key={index}>{show(section.key, index, 'value', entry)}</p>
            ) : null
            const titleKey = section.key === 'work_experience' ? 'job_title'
              : section.key === 'education' ? 'school'
              : section.key === 'projects' || section.key === 'certifications' ? 'name' : ''
            const subtitleKeys = section.key === 'work_experience' ? ['company', 'location']
              : section.key === 'education' ? ['degree', 'field_of_study']
              : section.key === 'certifications' ? ['issuer', 'date_earned'] : []
            const dateKeys = section.key === 'work_experience' || section.key === 'education'
              ? ['start_date', 'end_date'] : []
            const hasText = Object.entries(entry).some(([key, value]) => key !== 'id' && key !== 'sort_order' && typeof value === 'string' && value.trim())
            if (!hasText) return null
            const handled = new Set(['id', 'sort_order', 'description', titleKey, ...subtitleKeys, ...dateKeys])
            const extras = Object.keys(entry).filter((key) => !handled.has(key) && str(entry, key).trim())
            return (
              <div key={index} className="preview-entry-block">
                {(str(entry, titleKey).trim() || dateKeys.some((key) => str(entry, key).trim())) && (
                  <div className="preview-entry-heading-row">
                    {titleKey && str(entry, titleKey).trim() && (
                      <h3 className="preview-entry-title">{show(section.key, index, titleKey, entry[titleKey])}</h3>
                    )}
                    {dateKeys.some((key) => str(entry, key).trim()) && (
                      <span className="preview-entry-dates">{pair(section.key, index, entry, dateKeys, ' – ')}</span>
                    )}
                  </div>
                )}
                {subtitleKeys.some((key) => str(entry, key).trim()) && (
                  <p className="preview-entry-subtitle">{pair(section.key, index, entry, subtitleKeys, ' • ')}</p>
                )}
                {str(entry, 'description').trim() && (
                  <p className="preview-entry-description">{show(section.key, index, 'description', entry.description)}</p>
                )}
                {extras.length > 0 && (
                  <p className="preview-entry-details">{pair(section.key, index, entry, extras, ' • ')}</p>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
