import { useEffect, useMemo, useState } from 'react'
import { supabase, updateCurrentUserProfile } from '../lib/supabase'
import {
  deleteResumeFromDatabase,
  getSavedResumeDisplayMeta,
  removeSavedResumeDisplayMeta,
  listResumesFromDatabase,
  loadResumeFromDatabase,
  type SavedResumeSummary,
} from '../services/resumeService'
const resumeDraftStorageKey = 'jobcoachai.resumeDraft'
const resumeIdStorageKey = 'jobcoachai.resumeId'
import { Document, Packer, Paragraph, TextRun } from 'docx'

type SavedResume = Record<string, any>
type ExportPart = { kind: 'title' | 'contact' | 'section' | 'heading' | 'dates' | 'subtitle' | 'body' | 'skills'; text: string }

const exportSections = [
  ['summary', 'Professional Summary'], ['work_experience', 'Experience'],
  ['education', 'Education'], ['skills', 'Skills'], ['projects', 'Projects'],
  ['certifications', 'Certifications'],
] as const
const safeFilename = (value: string) => value.replace(/[\\/:*?"<>|]/g, '_').trim() || 'resume'
const asText = (value: unknown) => typeof value === 'string' ? value.trim().replace(/[•·]/g, ' | ').replace(/\s+\|\s+/g, ' | ') : ''

// Keep section, field, and entry order consistent with the shared Page 2 / Page 3 ResumePreview.
function resumeContent(resume: SavedResume) {
  const filename = safeFilename(asText(resume.exportFilename) || getSavedResumeDisplayMeta(String(resume.id))?.filename || `${resume.full_name || 'resume'}-resume`)
  const parts: ExportPart[] = [
    { kind: 'title', text: asText(resume.full_name) || 'Resume' },
    { kind: 'contact', text: [resume.email, resume.phone, resume.location].map(asText).filter(Boolean).join(' | ') },
  ]
  for (const [key, label] of exportSections) {
    const entries: unknown[] = key === 'summary' ? [resume.professional_summary] :
      Array.isArray(resume[key]) ? [...resume[key]].sort((a, b) => Number(a?.sort_order ?? 0) - Number(b?.sort_order ?? 0)) : []
    const rendered: ExportPart[] = []
    if (key === 'skills') {
      const names = entries.map((entry) => typeof entry === 'string' ? entry : asText((entry as Record<string, unknown> | null)?.skill_name)).filter(Boolean)
      if (names.length) rendered.push({ kind: 'skills', text: names.join(' | ') })
    } else for (const entry of entries) {
      if (typeof entry === 'string') {
        if (entry.trim()) rendered.push({ kind: 'body', text: entry.trim() })
        continue
      }
      if (!entry || typeof entry !== 'object') continue
      const fields = entry as Record<string, unknown>
      const titleKey = key === 'work_experience' ? 'job_title' : key === 'education' ? 'school' :
        key === 'projects' || key === 'certifications' ? 'name' : ''
      const subtitleKeys = key === 'work_experience' ? ['company', 'location'] : key === 'education' ? ['degree', 'field_of_study'] :
        key === 'certifications' ? ['issuer', 'date_earned'] : []
      const dateKeys = key === 'work_experience' || key === 'education' ? ['start_date', 'end_date'] : []
      const title = asText(fields[titleKey])
      const dates = dateKeys.map((field) => asText(fields[field])).filter(Boolean).join(' – ')
      const subtitle = subtitleKeys.map((field) => asText(fields[field])).filter(Boolean).join(' | ')
      const description = asText(fields.description)
      const used = new Set(['id', 'resume_id', 'sort_order', 'description', titleKey, ...dateKeys, ...subtitleKeys])
      const extra = Object.entries(fields).filter(([field, value]) => !used.has(field) && asText(value)).map(([, value]) => asText(value)).join(' | ')
      if (title) rendered.push({ kind: 'heading', text: title })
      if (dates) rendered.push({ kind: 'dates', text: dates })
      if (subtitle) rendered.push({ kind: 'subtitle', text: subtitle })
      if (description) rendered.push({ kind: 'body', text: description })
      if (extra) rendered.push({ kind: 'body', text: extra })
    }
    if (rendered.length) parts.push({ kind: 'section', text: label }, ...rendered)
  }
  return { filename, parts }
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export async function downloadSavedResumeDocx(resume: SavedResume) {
  const { filename, parts } = resumeContent(resume)
  const spacing = { title: 0, contact: 250, section: 110, heading: 25, dates: 70, subtitle: 55, body: 145, skills: 150 }
  const children = parts.filter((part) => part.text).map((part) => {
    const kind = part.kind
    const isHeader = kind === 'title' || kind === 'section' || kind === 'heading'
    return new Paragraph({
      children: [new TextRun({ text: part.text, bold: isHeader, color: kind === 'heading' ? '182C4E' : kind === 'dates' ? '475569' : '171717',
        size: kind === 'title' ? 34 : kind === 'section' ? 22 : kind === 'heading' ? 20 : kind === 'dates' ? 17 : 19,
        font: 'Georgia' })],
      alignment: kind === 'title' || kind === 'contact' ? 'center' : 'left',
      spacing: { before: kind === 'section' ? 230 : 0, after: spacing[kind], line: kind === 'body' || kind === 'skills' ? 330 : 275 },
      border: kind === 'section' ? { bottom: { color: 'D5D9DF', space: 5, size: 5, style: 'single' } } :
        kind === 'contact' ? { bottom: { color: '64748B', space: 14, size: 6, style: 'single' } } : undefined,
      keepNext: kind === 'section' || kind === 'heading',
    })
  })
  const document = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 780, right: 780 } } }, children }] })
  saveBlob(await Packer.toBlob(document), `${filename}.docx`)
}

// Generate the file directly in the current tab. No print window, print dialog, or preview page.
// Uses PDF's built-in Helvetica font, supporting standard Western characters.
export function downloadSavedResumePdf(resume: SavedResume) {
  const { filename, parts } = resumeContent(resume)
  const pageWidth = 612, pageHeight = 792, margin = 46, usableWidth = pageWidth - 2 * margin
  const pages: string[][] = [[]]
  let y = pageHeight - margin
  const page = () => pages[pages.length - 1]
  const newPage = () => { pages.push([]); y = pageHeight - margin }
  const plain = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[•·]/g, ' | ').replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[^\x20-\x7e]/g, '?')
  const pdfText = (s: string) => plain(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const fontSize: Record<ExportPart['kind'], number> = { title: 18, contact: 9.5, section: 11.5, heading: 10.5, dates: 8.8, subtitle: 9.4, body: 9.5, skills: 9.5 }
  const estimate = (s: string, size: number) => [...plain(s)].reduce((n, c) => n + (c === ' ' ? 0.26 : 'il.,:;!|'.includes(c) ? 0.25 : 'MW@'.includes(c) ? 0.85 : 0.52) * size, 0)
  const wrap = (s: string, size: number) => s.split('\n').flatMap((line) => {
    const words = line.split(/\s+/).filter(Boolean), out: string[] = []
    let row = ''
    for (const word of words) {
      const next = row ? row + ' ' + word : word
      if (estimate(next, size) > usableWidth && row) { out.push(row); row = word } else row = next
    }
    out.push(row)
    return out
  })
  const drawText = (line: string, size: number, bold: boolean, center = false, color = '0.09 0.09 0.09') => {
    const x = center ? Math.max(margin, (pageWidth - estimate(line, size)) / 2) : margin
    page().push(`${color} rg BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfText(line)}) Tj ET`)
  }
  for (const part of parts) {
    if (!part.text) continue
    const size = fontSize[part.kind]
    const lines = wrap(part.text, size)
    const leading = part.kind === 'body' || part.kind === 'skills' ? 15 : 13
    const before = part.kind === 'section' ? 18 : part.kind === 'heading' ? 8 : part.kind === 'body' ? 5 : 2
    const after = part.kind === 'title' ? 5 : part.kind === 'contact' ? 20 : part.kind === 'section' ? 9 : 2
    const required = before + Math.min(lines.length, 2) * leading + after + (part.kind === 'section' ? 20 : 0)
    if (y - required < margin) newPage()
    y -= before
    const bold = ['title', 'section', 'heading'].includes(part.kind)
    for (const line of lines) {
      if (y - leading < margin) newPage()
      drawText(line, size, bold, part.kind === 'title' || part.kind === 'contact', part.kind === 'dates' ? '0.27 0.33 0.41' : '0.09 0.09 0.09')
      y -= leading
    }
    if (part.kind === 'section' || part.kind === 'contact') {
      page().push(`0.72 0.76 0.81 RG 0.6 w ${margin} ${y + 3} m ${pageWidth - margin} ${y + 3} l S`)
    }
    y -= after
  }
  const objects: string[] = ['']
  const add = (body: string) => { objects.push(body); return objects.length - 1 }
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')
  const pagesObj = add('')
  const refs = pages.map((commands) => {
    const content = commands.join('\n')
    const stream = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
    return add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${stream} 0 R >>`)
  })
  objects[pagesObj] = `<< /Type /Pages /Kids [${refs.map((id) => `${id} 0 R`).join(' ')}] /Count ${refs.length} >>`
  const root = add(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`)
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (let i = 1; i < objects.length; i++) {
    offsets.push(pdf.length)
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`
  }
  const start = pdf.length
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length} /Root ${root} 0 R >>\nstartxref\n${start}\n%%EOF`
  saveBlob(new Blob([pdf], { type: 'application/pdf' }), `${filename}.pdf`)
}

type ProfilePageProps = {
  focusSection?: 'profile' | 'resumes'
  onNameChange?: (firstName: string, lastName: string) => void
  onResumeOpened?: (destination: 'parsed' | 'tailor') => void
  onResumePreviewed?: (resume: Record<string, any>) => void
}

type ProfileForm = {
  firstName: string
  lastName: string
  email: string
  phone: string
  location: string
}

const emptyForm: ProfileForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  location: '',
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function splitFullName(fullName?: string | null) {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  return {
    first_name: parts.shift() ?? '',
    last_name: parts.join(' '),
  }
}

function withoutDatabaseFields<T extends Record<string, unknown>>(row: T) {
  const { resume_id: _resumeId, sort_order: _sortOrder, ...rest } = row
  return rest
}

function saveDatabaseResumeAsDraft(databaseResume: Record<string, any>) {
  if (typeof databaseResume.id === 'string') {
    sessionStorage.setItem(resumeIdStorageKey, databaseResume.id)
  }
  const name = splitFullName(databaseResume.full_name)
  const profile = {
    first_name: name.first_name,
    last_name: name.last_name,
    email: databaseResume.email ?? '',
    phone: databaseResume.phone ?? '',
    location: databaseResume.location ?? '',
    professional_summary: databaseResume.professional_summary ?? '',
  }

  const sectionLabels: Record<string, string> = {
    summary: 'Professional summary',
    work_experience: 'Experience',
    education: 'Education',
    skills: 'Skills',
    projects: 'Projects',
    certifications: 'Certifications',
  }

  const defaultOrder = [
    'summary',
    'work_experience',
    'education',
    'skills',
    'projects',
    'certifications',
  ]

  const savedOrder = Array.isArray(databaseResume.section_order)
    ? [...databaseResume.section_order]
        .sort((a, b) => Number(a.section_order ?? 0) - Number(b.section_order ?? 0))
        .map((row) => row.section_name)
        .filter((key) => defaultOrder.includes(key))
    : []

  const orderedKeys = [...new Set([...savedOrder, ...defaultOrder])]
  const sections = orderedKeys.map((key) => {
    if (key === 'summary') {
      return {
        key,
        title: sectionLabels[key],
        entries: [profile.professional_summary],
      }
    }

    const rawRows = Array.isArray(databaseResume[key]) ? databaseResume[key] : []
    const entries = [...rawRows]
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
      .map((row) => withoutDatabaseFields(row))

    return {
      key,
      title: sectionLabels[key],
      entries,
    }
  })

  const savedMeta =
  typeof databaseResume.id === 'string'
    ? getSavedResumeDisplayMeta(databaseResume.id)
    : null

  sessionStorage.setItem(
    resumeDraftStorageKey,
    JSON.stringify({
      profile,
      sections,
      filename:
        savedMeta?.filename ||
        `${databaseResume.full_name || 'saved-resume'}-resume`,
      jobTitle: savedMeta?.jobTitle?.trim() || databaseResume.title?.trim() || "",
    }),
  )
}

function getDisplayResumeFilename(filename: string) {
  // The resume type appears on the second line, so omit a trailing type suffix.
  return filename.replace(/-(original|tailored)$/i, '')
}

function getJobTitle(resume: SavedResumeSummary) {
  return getSavedResumeDisplayMeta(resume.id)?.jobTitle?.trim() || resume.title?.trim() || 'Untitled'
}

export function ProfilePage({
  focusSection = 'profile',
  onNameChange,
  onResumeOpened,
  onResumePreviewed,
}: ProfilePageProps) {
  const [form, setForm] = useState<ProfileForm>(emptyForm)
  const [initialForm, setInitialForm] = useState<ProfileForm>(emptyForm)
  const [resumes, setResumes] = useState<SavedResumeSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resumeLoadingId, setResumeLoadingId] = useState<string | null>(null)
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null)
  const [resumePendingDownload, setResumePendingDownload] = useState<SavedResumeSummary | null>(null)
  const [downloadingResume, setDownloadingResume] = useState(false)
  const [resumePendingDelete, setResumePendingDelete] = useState<SavedResumeSummary | null>(null)
  const [deletingResume, setDeletingResume] = useState(false)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [selectedJobTitles, setSelectedJobTitles] = useState<string[]>([])

  useEffect(() => {
    const loadPage = async () => {
      setLoading(true)
      setMessage('')

      try {
        const { data, error } = await supabase.auth.getUser()
        if (error) throw error
        if (!data.user) throw new Error('No active user session.')

        const nextForm: ProfileForm = {
          firstName:
            typeof data.user.user_metadata?.first_name === 'string'
              ? data.user.user_metadata.first_name
              : '',
          lastName:
            typeof data.user.user_metadata?.last_name === 'string'
              ? data.user.user_metadata.last_name
              : '',
          email: data.user.email ?? '',
          phone:
            typeof data.user.user_metadata?.phone === 'string'
              ? data.user.user_metadata.phone
              : '',
          location:
            typeof data.user.user_metadata?.location === 'string'
              ? data.user.user_metadata.location
              : '',
        }

        setForm(nextForm)
        setInitialForm(nextForm)

        const saved = await listResumesFromDatabase()
        setResumes(saved)
      } catch (error) {
        console.error('Profile load error:', error)
        setMessage(
          error instanceof Error
            ? error.message
            : 'Unable to load your profile right now.',
        )
      } finally {
        setLoading(false)
      }
    }

    void loadPage()
  }, [])

  useEffect(() => {
    const target = document.getElementById(
      focusSection === 'resumes' ? 'saved-resumes' : 'personal-information',
    )
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [focusSection])

  const availableJobTitles = useMemo(
    () => [...new Set(resumes.map(getJobTitle))].sort((a, b) => a.localeCompare(b)),
    [resumes],
  )

  // Search by any part of the displayed resume filename or Job Title.
  // Multiple space-separated words can match different parts of the same resume.
  // An empty selection means "All"; the sentinel means "None".
  const filteredResumes = useMemo(() => {
    const keywords = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)

    return resumes.filter((resume) => {
      const meta = getSavedResumeDisplayMeta(resume.id)
      const jobTitle = getJobTitle(resume)
      const matchesJobTitle =
        selectedJobTitles.length === 0 ||
        (!selectedJobTitles.includes('__none__') && selectedJobTitles.includes(jobTitle))

      const displayFilename = meta
        ? getDisplayResumeFilename(meta.filename)
        : resume.full_name?.trim()
          ? `${resume.full_name} Resume`
          : 'Saved Resume'
      const searchableText = [
        displayFilename,
        meta?.filename ?? '',
        jobTitle,
        resume.full_name ?? '',
        resume.email ?? '',
        meta?.kind ?? '',
      ].join(' ').toLocaleLowerCase()
      const matchesSearch = keywords.every((keyword) => searchableText.includes(keyword))

      return matchesJobTitle && matchesSearch
    })
  }, [resumes, search, selectedJobTitles])

  const toggleJobTitle = (title: string, checked: boolean) => {
    setSelectedJobTitles((current) => {
      const selected = current.length === 0 ? availableJobTitles : current.filter((item) => item !== '__none__')
      const next = checked
        ? [...new Set([...selected, title])]
        : selected.filter((item) => item !== title)
      if (next.length === 0) return ['__none__']
      if (next.length === availableJobTitles.length) return []
      return next
    })
  }

  const updateField = (key: keyof ProfileForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    try {
      await updateCurrentUserProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        location: form.location,
      })

      setInitialForm(form)
      onNameChange?.(form.firstName, form.lastName)
      setMessage('Personal information saved.')
    } catch (error) {
      console.error('Profile save error:', error)
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save profile changes.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handlePreviewResume = async (resumeId: string) => {
    setPreviewLoadingId(resumeId)
    setMessage('')

    try {
      const response = await loadResumeFromDatabase(resumeId)
      const databaseResume = response?.resume ?? response

      if (!databaseResume || databaseResume.error) {
        throw new Error(databaseResume?.error ?? 'Unable to preview this resume.')
      }

      onResumePreviewed?.(databaseResume)
    } catch (error) {
      console.error('Preview saved resume error:', error)
      setMessage(
        error instanceof Error ? error.message : 'Unable to preview this resume.',
      )
    } finally {
      setPreviewLoadingId(null)
    }
  }

  const handleOpenResume = async (resumeId: string, destination: 'parsed' | 'tailor' = 'parsed') => {
    setResumeLoadingId(resumeId)
    setMessage('')

    try {
      const response = await loadResumeFromDatabase(resumeId)
      const databaseResume = response?.resume ?? response

      if (!databaseResume || databaseResume.error) {
        throw new Error(databaseResume?.error ?? 'Unable to load this resume.')
      }

      saveDatabaseResumeAsDraft(databaseResume)
      onResumeOpened?.(destination)
      window.location.hash = `#${destination}`
    } catch (error) {
      console.error('Open saved resume error:', error)
      setMessage(
        error instanceof Error ? error.message : 'Unable to open this resume.',
      )
    } finally {
      setResumeLoadingId(null)
    }
  }

  const handleDownloadResume = async (format: 'pdf' | 'docx') => {
    if (!resumePendingDownload || downloadingResume) return
    const selected = resumePendingDownload
    setDownloadingResume(true)
    setMessage('')
    try {
      const response = await loadResumeFromDatabase(selected.id)
      const databaseResume = response?.resume ?? response
      if (!databaseResume || databaseResume.error) {
        throw new Error(databaseResume?.error ?? 'Unable to download this resume.')
      }
      if (format === 'pdf') {
        downloadSavedResumePdf({ ...databaseResume, id: selected.id })
        setMessage('Resume PDF download started.')
      } else {
        await downloadSavedResumeDocx({ ...databaseResume, id: selected.id })
        setMessage('Resume DOCX download started.')
      }
      setResumePendingDownload(null)
    } catch (error) {
      console.error('Download saved resume error:', error)
      setMessage(error instanceof Error ? error.message : 'Unable to download this resume.')
    } finally {
      setDownloadingResume(false)
    }
  }

  const handleDeleteResume = async () => {
    if (!resumePendingDelete || deletingResume) return

    setDeletingResume(true)
    setMessage('')

    try {
      await deleteResumeFromDatabase(resumePendingDelete.id)
      removeSavedResumeDisplayMeta(resumePendingDelete.id)
      setResumes((current) => current.filter((item) => item.id !== resumePendingDelete.id))
      setResumePendingDelete(null)
      setMessage('Saved resume deleted.')
    } catch (error) {
      console.error('Delete saved resume error:', error)
      setMessage(
        error instanceof Error ? error.message : 'Unable to delete this resume.',
      )
    } finally {
      setDeletingResume(false)
    }
  }

  return (
    <section className="screen profile-screen" data-screen="profile">
      <div className="profile-page-header">
        <span className="section-kicker">ACCOUNT</span>
        <h2>My Profile</h2>
        <p>
          Manage your personal information and view resumes saved to your account.
        </p>
      </div>

      {message && (
        <p className="profile-status" role="status">
          {message}
        </p>
      )}

      <section className="profile-card" id="personal-information">
        <div className="profile-card-heading">
          <div>
            <span className="panel-icon">PROFILE</span>
            <h3>Personal Information</h3>
            <p>Update the account information used across JobCoachAI.</p>
          </div>
        </div>

        {loading ? (
          <p className="profile-empty-state">Loading profile…</p>
        ) : (
          <div className="profile-form-grid">
            <div className="field-group">
              <label htmlFor="profile-first-name">First Name</label>
              <input
                id="profile-first-name"
                value={form.firstName}
                onChange={(event) => updateField('firstName', event.target.value)}
              />
            </div>

            <div className="field-group">
              <label htmlFor="profile-last-name">Last Name</label>
              <input
                id="profile-last-name"
                value={form.lastName}
                onChange={(event) => updateField('lastName', event.target.value)}
              />
            </div>

            <div className="field-group">
              <label htmlFor="profile-email">Email Address</label>
              <input
                id="profile-email"
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
              />
            </div>

            <div className="field-group">
              <label htmlFor="profile-phone">Phone Number</label>
              <input
                id="profile-phone"
                type="tel"
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
              />
            </div>

            <div className="field-group profile-location-field">
              <label htmlFor="profile-location">Location</label>
              <input
                id="profile-location"
                value={form.location}
                onChange={(event) => updateField('location', event.target.value)}
              />
            </div>
          </div>
        )}

        {!loading && (
          <div className="profile-form-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setForm(initialForm)}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="button button-primary"
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </section>

      <section className="profile-card saved-resumes-card" id="saved-resumes">
        <div className="saved-resumes-heading">
          <div>
            <span className="panel-icon">RESUMES</span>
            <h3>Saved Resumes</h3>
            <p>Preview, open, or delete resumes saved to your account.</p>
          </div>

          <div className="saved-resume-controls">
            <input
              className="saved-resume-search"
              type="search"
              placeholder="Search by resume name or job title…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search saved resumes"
            />
            <details className="saved-resume-job-filter">
              <summary>Filter by Job Title</summary>
              <div className="saved-resume-filter-options">
                <div className="saved-resume-filter-actions">
                  <button type="button" onClick={() => setSelectedJobTitles([])}>
                    Select All
                  </button>
                  <button type="button" onClick={() => setSelectedJobTitles(['__none__'])}>
                    Deselect All
                  </button>
                </div>
                {availableJobTitles.map((title) => (
                  <label key={title}>
                    <input
                      type="checkbox"
                      checked={
                        selectedJobTitles.length === 0 || selectedJobTitles.includes(title)
                      }
                      onChange={(event) => toggleJobTitle(title, event.target.checked)}
                    />
                    <span>{title}</span>
                  </label>
                ))}
                {availableJobTitles.length === 0 && <p>No job titles available.</p>}
              </div>
            </details>
          </div>
        </div>

        {loading ? (
          <p className="profile-empty-state">Loading saved resumes…</p>
        ) : filteredResumes.length === 0 ? (
          <p className="profile-empty-state">
            {resumes.length === 0
              ? 'No saved resumes yet.'
              : 'No saved resumes match your search or selected job titles.'}
          </p>
        ) : (
          <div className="saved-resume-list">
              <div className="saved-resume-row saved-resume-row-header" aria-hidden="true">
                <span>Resume</span>
                <span>Job Title</span>
                <span>Last Updated</span>
                <span>Actions</span>
              </div>

              {filteredResumes.map((resume) => (
                <div className="saved-resume-row" key={resume.id}>
                  <div className="saved-resume-name">
                    <span className="saved-resume-icon" aria-hidden="true">▤</span>
                    <span>
                      <strong>
                        {(() => {
                          const meta = getSavedResumeDisplayMeta(resume.id)
                          if (meta) return getDisplayResumeFilename(meta.filename)
                          return resume.full_name?.trim()
                            ? `${resume.full_name} Resume`
                            : 'Saved Resume'
                        })()}
                      </strong>
                      <small>
                        {(() => {
                          const meta = getSavedResumeDisplayMeta(resume.id)
                          const accountText = resume.email || 'Saved to your account'
                          const summary = meta
                            ? `${meta.kind === 'original' ? 'Original resume' : 'Tailored resume'} • ${accountText}`
                            : accountText
                          return summary
                        })()}
                      </small>
                    </span>
                  </div>

                  <span className="saved-resume-job-title" data-label="Job Title">
                    {getJobTitle(resume)}
                  </span>

                  <span className="saved-resume-date" data-label="Last Updated">
                    {formatDateTime(resume.updated_at ?? resume.created_at)}
                  </span>

                  <div className="saved-resume-actions">
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => void handlePreviewResume(resume.id)}
                      disabled={previewLoadingId === resume.id}
                    >
                      {previewLoadingId === resume.id ? 'Previewing…' : 'Preview'}
                    </button>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => void handleOpenResume(resume.id)}
                      disabled={resumeLoadingId === resume.id}
                    >
                      {resumeLoadingId === resume.id ? 'Opening…' : 'Open'}
                    </button>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => setResumePendingDownload(resume)}
                    >
                      Download
                    </button>
                    <button
                      className="text-button saved-resume-delete"
                      type="button"
                      onClick={() => setResumePendingDelete(resume)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      {resumePendingDownload && (
        <div className="export-dialog-backdrop" role="presentation">
          <div className="export-dialog" role="dialog" aria-modal="true"
            aria-labelledby="saved-resume-export-title" aria-describedby="saved-resume-export-description">
            <span className="panel-icon">SAVE AS</span>
            <h3 id="saved-resume-export-title">Choose a file type</h3>
            <p id="saved-resume-export-description">Download your saved resume as PDF or DOCX.</p>
            <div className="export-dialog-options">
              <button className="button button-primary" type="button" disabled={downloadingResume}
                onClick={() => void handleDownloadResume('pdf')}>
                Save as PDF <span aria-hidden="true">↓</span>
              </button>
              <button className="button button-primary" type="button" disabled={downloadingResume}
                onClick={() => void handleDownloadResume('docx')}>
                Save as DOCX <span aria-hidden="true">↓</span>
              </button>
            </div>
            <button className="export-dialog-cancel" type="button" disabled={downloadingResume}
              onClick={() => setResumePendingDownload(null)}>Cancel</button>
          </div>
        </div>
      )}

      {resumePendingDelete && (
        <div className="dialog-backdrop" role="presentation">
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-saved-resume-title"
            aria-describedby="delete-saved-resume-description"
          >
            <span className="panel-icon">DELETE RESUME</span>
            <h3 id="delete-saved-resume-title">Delete saved resume?</h3>
            <p id="delete-saved-resume-description">
              {getJobTitle(resumePendingDelete) !== 'Untitled'
                ? getJobTitle(resumePendingDelete)
                : (resumePendingDelete.full_name?.trim()
                  ? `${resumePendingDelete.full_name} Resume`
                  : 'This saved resume')} will be permanently deleted.
            </p>
            <div className="dialog-actions">
              <button
                className="button button-secondary"
                type="button"
                disabled={deletingResume}
                onClick={() => setResumePendingDelete(null)}
              >
                Cancel
              </button>
              <button
                className="button button-primary saved-resume-confirm-delete"
                type="button"
                disabled={deletingResume}
                onClick={() => void handleDeleteResume()}
              >
                {deletingResume ? 'Deleting…' : 'Delete resume'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}


// Convert an in-editor resume into the same structured data used by Saved Resumes exports.
// Exporting from the editor does not require first saving the resume to the database.
export function buildDownloadResume(profile: { first_name: string; last_name: string; email: string; phone: string; location: string; professional_summary: string }, sections: Array<{ key: string; entries: Array<unknown> }>, filename: string) {
  const entryList = (key: string) => sections.find((section) => section.key === key)?.entries ?? [];
  const summary = entryList('summary').find((value) => typeof value === 'string');
  return {
    exportFilename: filename,
    full_name: [profile.first_name, profile.last_name].filter(Boolean).join(' '),
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    professional_summary: typeof summary === 'string' ? summary : profile.professional_summary,
    work_experience: entryList('work_experience'),
    education: entryList('education'),
    skills: entryList('skills'),
    projects: entryList('projects'),
    certifications: entryList('certifications'),
  };
}
