import { useEffect, useMemo, useState } from 'react'
import { supabase, updateCurrentUserProfile } from '../lib/supabase'
import {
  deleteResumeFromDatabase,
  listResumesFromDatabase,
  loadResumeFromDatabase,
  type SavedResumeSummary,
} from '../services/resumeService'
import { resumeDraftStorageKey } from './ResumePage'

type ProfilePageProps = {
  focusSection?: 'profile' | 'resumes'
  onNameChange?: (firstName: string, lastName: string) => void
  onResumeOpened?: () => void
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

function formatDate(value?: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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

  sessionStorage.setItem(
    resumeDraftStorageKey,
    JSON.stringify({
      profile,
      sections,
      filename: `${databaseResume.full_name || 'saved-resume'}-resume`,
    }),
  )
}

export function ProfilePage({
  focusSection = 'profile',
  onNameChange,
  onResumeOpened,
}: ProfilePageProps) {
  const [form, setForm] = useState<ProfileForm>(emptyForm)
  const [initialForm, setInitialForm] = useState<ProfileForm>(emptyForm)
  const [resumes, setResumes] = useState<SavedResumeSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resumeLoadingId, setResumeLoadingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')

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

  const filteredResumes = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return resumes

    return resumes.filter((resume) =>
      `${resume.full_name ?? ''} ${resume.email ?? ''}`.toLowerCase().includes(query),
    )
  }, [resumes, search])

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
      setMessage('Profile updated successfully.')
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

  const handleOpenResume = async (resumeId: string) => {
    setResumeLoadingId(resumeId)
    setMessage('')

    try {
      const response = await loadResumeFromDatabase(resumeId)
      const databaseResume = response?.resume ?? response

      if (!databaseResume || databaseResume.error) {
        throw new Error(databaseResume?.error ?? 'Unable to load this resume.')
      }

      saveDatabaseResumeAsDraft(databaseResume)
      onResumeOpened?.()
      window.location.hash = '#parsed'
    } catch (error) {
      console.error('Open saved resume error:', error)
      setMessage(
        error instanceof Error ? error.message : 'Unable to open this resume.',
      )
    } finally {
      setResumeLoadingId(null)
    }
  }

  const handleDeleteResume = async (resume: SavedResumeSummary) => {
    const displayName = resume.full_name?.trim()
      ? `${resume.full_name} Resume`
      : 'this saved resume'

    if (!window.confirm(`Delete ${displayName}? This cannot be undone.`)) return

    try {
      await deleteResumeFromDatabase(resume.id)
      setResumes((current) => current.filter((item) => item.id !== resume.id))
      setMessage('Saved resume deleted.')
    } catch (error) {
      console.error('Delete saved resume error:', error)
      setMessage(
        error instanceof Error ? error.message : 'Unable to delete this resume.',
      )
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
            <p>View, open, or delete resumes saved to your account.</p>
          </div>

          <input
            className="saved-resume-search"
            type="search"
            placeholder="Search resumes…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search saved resumes"
          />
        </div>

        {loading ? (
          <p className="profile-empty-state">Loading saved resumes…</p>
        ) : filteredResumes.length === 0 ? (
          <p className="profile-empty-state">
            {search ? 'No saved resumes match your search.' : 'No saved resumes yet.'}
          </p>
        ) : (
          <div className="saved-resume-list">
            <div className="saved-resume-row saved-resume-row-header" aria-hidden="true">
              <span>Resume</span>
              <span>Last Updated</span>
              <span>Actions</span>
            </div>

            {filteredResumes.map((resume) => (
              <div className="saved-resume-row" key={resume.id}>
                <div className="saved-resume-name">
                  <span className="saved-resume-icon" aria-hidden="true">▤</span>
                  <span>
                    <strong>
                      {resume.full_name?.trim()
                        ? `${resume.full_name} Resume`
                        : 'Saved Resume'}
                    </strong>
                    <small>{resume.email || 'Saved to your account'}</small>
                  </span>
                </div>

                <span className="saved-resume-date">
                  {formatDate(resume.updated_at ?? resume.created_at)}
                </span>

                <div className="saved-resume-actions">
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => void handleOpenResume(resume.id)}
                    disabled={resumeLoadingId === resume.id}
                  >
                    {resumeLoadingId === resume.id ? 'Opening…' : 'Open'}
                  </button>
                  <button
                    className="text-button saved-resume-delete"
                    type="button"
                    onClick={() => void handleDeleteResume(resume)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
