import { useState } from "react";
import { Button } from "../components/Button";
import {
  initialResume,
  resumeSectionEntries,
  type Certification,
  type Education,
  type Project,
  type ResumeProfile,
  type Skill,
  type WorkExperience,
} from "../features/resume/resumeData";

type ResumePageProps = { blankResume?: boolean };

type SectionKey =
  | "summary"
  | "education"
  | "work_experience"
  | "skills"
  | "projects"
  | "certifications";

type SectionEntry =
  | string
  | WorkExperience
  | Education
  | Skill
  | Project
  | Certification;

type ResumeSection = {
  key: SectionKey;
  title: string;
  entries: SectionEntry[];
};

const emptyProfile: ResumeProfile = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  location: "",
  professional_summary: "",
};

const personalFields: Array<{ key: keyof ResumeProfile; label: string; type?: string }> = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "location", label: "Location" },
];

const sectionLabels: Record<SectionKey, string> = {
  summary: "Professional summary",
  education: "Education",
  work_experience: "Experience",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
};

const sectionOrder: SectionKey[] = [
  "summary",
  "education",
  "work_experience",
  "skills",
  "projects",
  "certifications",
];

const getBlankSectionEntry = (sectionKey: SectionKey): SectionEntry => {
  switch (sectionKey) {
    case "summary":
      return "";
    case "education":
      return { ...resumeSectionEntries.education };
    case "work_experience":
      return { ...resumeSectionEntries.work_experience };
    case "skills":
      return { ...resumeSectionEntries.skills };
    case "projects":
      return { ...resumeSectionEntries.projects };
    case "certifications":
      return { ...resumeSectionEntries.certifications };
    default:
      return "";
  }
};

function createSections(blankResume: boolean): ResumeSection[] {
  return [
    {
      key: "summary",
      title: sectionLabels.summary,
      entries: blankResume ? [""] : [initialResume.summary],
    },
    {
      key: "education",
      title: sectionLabels.education,
      entries: blankResume
        ? [getBlankSectionEntry("education")]
        : initialResume.education,
    },
    {
      key: "work_experience",
      title: sectionLabels.work_experience,
      entries: blankResume
        ? [getBlankSectionEntry("work_experience")]
        : initialResume.work_experience,
    },
    {
      key: "skills",
      title: sectionLabels.skills,
      entries: blankResume ? [getBlankSectionEntry("skills")] : initialResume.skills,
    },
    {
      key: "projects",
      title: sectionLabels.projects,
      entries: blankResume ? [getBlankSectionEntry("projects")] : initialResume.projects,
    },
    {
      key: "certifications",
      title: sectionLabels.certifications,
      entries: blankResume
        ? [getBlankSectionEntry("certifications")]
        : initialResume.certifications,
    },
  ];
}

export function ResumePage({ blankResume = true }: ResumePageProps) {
  const [profile, setProfile] = useState<ResumeProfile>(() =>
    blankResume
      ? { ...emptyProfile }
      : {
          first_name: initialResume.first_name,
          last_name: initialResume.last_name,
          email: initialResume.email,
          phone: initialResume.phone,
          location: initialResume.location,
          professional_summary: initialResume.professional_summary,
        },
  );

  const [sections, setSections] = useState<ResumeSection[]>(() =>
    createSections(blankResume),
  );
  const [jobTitle, setJobTitle] = useState("");
  const [status, setStatus] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [resumeDeleted, setResumeDeleted] = useState(false);

  const updateProfile = (field: keyof ResumeProfile, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const updateEntry = (
    sectionKey: string,
    entryIndex: number,
    fieldKey: string,
    value: string,
  ) => {
    setSections((current) =>
      current.map((section) => {
        if (section.key !== sectionKey) return section;

        return {
          ...section,
          entries: section.entries.map((entry, index) => {
            if (index !== entryIndex) return entry;
            if (typeof entry === "string") return value;
            return { ...entry, [fieldKey]: value } as typeof entry;
          }),
        };
      }),
    );
  };

  const addEntry = (sectionKey: string) => {
    const blankEntry =
      sectionKey === "summary" ? "" : getBlankSectionEntry(sectionKey as SectionKey);

    setSections((current) =>
      current.map((section) =>
        section.key === sectionKey
          ? { ...section, entries: [...section.entries, blankEntry] }
          : section,
      ),
    );
  };

  const removeEntry = (sectionKey: string, entryIndex: number) => {
    setSections((current) =>
      current.map((section) => {
        if (section.key !== sectionKey) return section;
        const entries = section.entries.filter((_, index) => index !== entryIndex);
        return {
          ...section,
          entries: entries.length ? entries : [getBlankSectionEntry(sectionKey as SectionKey)],
        };
      }),
    );
  };

  const addSection = () => {
    const nextSection = sectionOrder.find(
      (sectionKey) => !sections.some((section) => section.key === sectionKey),
    );

    if (!nextSection) return;

    setSections((current) => [
      ...current,
      {
        key: nextSection,
        title: sectionLabels[nextSection],
        entries: [getBlankSectionEntry(nextSection)],
      },
    ]);
  };

  const hasEntryContent = (entry: SectionEntry) => {
    if (typeof entry === "string") return entry.trim() !== "";
    return Object.values(entry).some(
      (value) => typeof value === "string" && value.trim() !== "",
    );
  };

  const formatEntryPreview = (entry: SectionEntry) => {
    if (typeof entry === "string") return entry.trim();

    return Object.entries(entry)
      .filter(([, value]) => typeof value === "string" && value.trim() !== "")
      .map(([fieldKey, value]) => {
        const fieldLabel = fieldKey
          .replace(/_/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase());

        if (fieldKey === "description" || fieldKey === "skill_name") {
          return value;
        }

        return `${fieldLabel}: ${value}`;
      })
      .join(" • ");
  };

  const removeSection = (sectionKey: string) => {
    setSections((current) => current.filter((section) => section.key !== sectionKey));
  };

  const handleDelete = () => {
    setResumeDeleted(true);
    setShowDeleteDialog(false);
    setStatus("Resume deleted from this workspace.");
  };

  if (resumeDeleted) {
    return (
      <section className="screen resume-screen" data-screen="parsed">
        <div className="resume-empty-state">
          <span className="section-kicker">03 / Your fit</span>
          <div className="empty-state-icon" aria-hidden="true">
            +
          </div>
          <h2>
            Your resume is <em>cleared.</em>
          </h2>
          <p>
            Start a new resume whenever you’re ready to shape your next
            application.
          </p>
          <Button
            variant="primary"
            type="button"
            onClick={() => {
              setResumeDeleted(false);
              setSections(createSections(true));
              setStatus("");
            }}
          >
            Create new resume <span aria-hidden="true">→</span>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="screen resume-screen" data-screen="parsed">
      <div className="resume-header">
        <div className="screen-intro">
          <span className="section-kicker">03 / Your fit</span>
          <h2>
            Build your <em>best case.</em>
          </h2>
          <p>
            Keep your experience clear, current, and ready to tailor for the
            next opportunity.
          </p>
        </div>
        <div className="resume-status" role="status">
          <span className="status-dot" aria-hidden="true" />
          {status || "Draft workspace"}
        </div>
      </div>

      <div className="resume-toolbar">
        <div>
          <strong>Resume editor</strong>
          <span>Changes stay local until connected to your account.</span>
        </div>
        <div className="resume-toolbar-actions">
          <Button
            variant="secondary"
            type="button"
            onClick={() => setShowDeleteDialog(true)}
          >
            Delete resume
          </Button>
          <Button
            variant="primary"
            type="button"
            onClick={() => setStatus("Resume ready to export.")}
          >
            Export resume <span aria-hidden="true">✓</span>
          </Button>
        </div>
      </div>

      <form
        className="resume-editor"
        onSubmit={(event) => {
          event.preventDefault();
          setStatus("Resume saved just now.");
        }}
      >
        <section className="resume-card personal-card">
          <div className="resume-card-heading">
            <div>
              <span className="card-index">00</span>
              <h3>Personal information</h3>
            </div>
            <span className="field-hint">Shown at the top of your resume</span>
          </div>
          <div className="personal-grid">
            {personalFields.map((field) => (
              <div className="field-group" key={field.key}>
                <label htmlFor={`resume-${field.key}`}>{field.label}</label>
                <input
                  id={`resume-${field.key}`}
                  type={field.type ?? "text"}
                  value={profile[field.key]}
                  onChange={(event) => updateProfile(field.key, event.target.value)}
                  placeholder={
                    field.key === "email"
                      ? "you@example.com"
                      : field.key === "phone"
                        ? "(555) 555-5555"
                        : field.key === "location"
                          ? "City, State"
                          : field.label
                  }
                />
              </div>
            ))}
          </div>
        </section>

        {sections.map((section, sectionIndex) => (
          <section className="resume-card" key={section.key}>
            <div className="resume-card-heading">
              <div>
                <span className="card-index">
                  {String(sectionIndex + 1).padStart(2, "0")}
                </span>
                <h3>{section.title}</h3>
              </div>
              <div className="section-actions">
                <button
                  className="add-button"
                  type="button"
                  onClick={() => addEntry(section.key)}
                >
                  + Add {section.key === "skills" ? "skill" : "entry"}
                </button>
                <button
                  className="remove-section"
                  type="button"
                  onClick={() => removeSection(section.key)}
                >
                  Remove section
                </button>
              </div>
            </div>
            <div className="resume-entry-list">
              {section.entries.map((entry, entryIndex) => {
                if (typeof entry === "string") {
                  return (
                    <div className="resume-entry" key={`${section.key}-${entryIndex}`}>
                      <textarea
                        rows={4}
                        value={entry}
                        onChange={(event) =>
                          updateEntry(section.key, entryIndex, "value", event.target.value)
                        }
                        placeholder="Write a concise professional summary..."
                        aria-label={`${section.title} entry ${entryIndex + 1}`}
                      />
                      <button
                        className="remove-entry"
                        type="button"
                        onClick={() => removeEntry(section.key, entryIndex)}
                        aria-label={`Remove ${section.title} entry ${entryIndex + 1}`}
                      >
                        Remove
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="resume-entry" key={`${section.key}-${entryIndex}`}>
                    <div className="resume-entry-fields">
                      {Object.entries(entry).map(([fieldKey, value]) => (
                        <div className="field-group" key={`${section.key}-${entryIndex}-${fieldKey}`}>
                          <label htmlFor={`${section.key}-${entryIndex}-${fieldKey}`}>
                            {fieldKey
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (char) => char.toUpperCase())}
                          </label>
                          {fieldKey === "description" ? (
                            <textarea
                              id={`${section.key}-${entryIndex}-${fieldKey}`}
                              rows={3}
                              value={value}
                              onChange={(event) =>
                                updateEntry(section.key, entryIndex, fieldKey, event.target.value)
                              }
                            />
                          ) : (
                            <input
                              id={`${section.key}-${entryIndex}-${fieldKey}`}
                              type="text"
                              value={value}
                              onChange={(event) =>
                                updateEntry(section.key, entryIndex, fieldKey, event.target.value)
                              }
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      className="remove-entry"
                      type="button"
                      onClick={() => removeEntry(section.key, entryIndex)}
                      aria-label={`Remove ${section.title} entry ${entryIndex + 1}`}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <button className="add-section-button" type="button" onClick={addSection}>
          + Add another section
        </button>

        <section className="job-version-card">
          <div>
            <span className="panel-icon">JOB-SPECIFIC VERSION</span>
            <h3>Save a tailored copy</h3>
            <p>Create a separate version without changing your main resume.</p>
          </div>
          <div className="job-version-action">
            <label htmlFor="job-version-title">Job title or company</label>
            <div>
              <input
                id="job-version-title"
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                placeholder="e.g. Product Designer at Northstar"
              />
              <Button
                variant="secondary"
                type="button"
                onClick={() =>
                  setStatus(
                    jobTitle.trim()
                      ? `Saved version for ${jobTitle.trim()}.`
                      : "Add a job title before saving a version.",
                  )
                }
              >
                Save job version
              </Button>
            </div>
          </div>
        </section>

        <div className="resume-form-footer">
          <span>Last saved locally in this session</span>
          <Button variant="primary" type="submit">
            Save resume <span aria-hidden="true">✓</span>
          </Button>
        </div>
      </form>

      <section className="resume-preview-section">
        <div className="resume-preview-header">
          <span className="panel-icon">PREVIEW</span>
          <div>
            <h2>Resume Preview</h2>
            <p>Review your completed resume before exporting.</p>
          </div>
        </div>

        <div className="resume-preview">
          {(profile.first_name ||
            profile.last_name ||
            profile.email ||
            profile.phone ||
            profile.location ||
            sections.some((section) => section.entries.some(hasEntryContent))) ? (
            <>
              <div className="resume-preview-profile">
                <h1>
                  {[profile.first_name, profile.last_name]
                    .filter(Boolean)
                    .join(" ") || "Your name"}
                </h1>

                {(profile.email || profile.phone || profile.location) && (
                  <p>
                    {[profile.email, profile.phone, profile.location]
                      .filter(Boolean)
                      .join(" • ")}
                  </p>
                )}
              </div>

              {sections
                .filter((section) => section.entries.some(hasEntryContent))
                .map((section) => (
                  <div className="resume-preview-block" key={section.key}>
                    <h2>{section.title}</h2>

                    {section.entries
                      .filter(hasEntryContent)
                      .map((entry, index) => (
                        <p key={`${section.key}-${index}`}>{formatEntryPreview(entry)}</p>
                      ))}
                  </div>
                ))}
            </>
          ) : (
            <p className="resume-preview-empty">
              Your resume preview will appear here as you add information.
            </p>
          )}
        </div>
      </section>

      {showDeleteDialog && (
        <div className="dialog-backdrop" role="presentation">
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            aria-describedby="delete-description"
          >
            <span className="panel-icon">DELETE RESUME</span>
            <h3 id="delete-title">Remove this resume?</h3>
            <p id="delete-description">
              This will clear the resume from the current workspace. This action
              cannot be undone.
            </p>
            <div className="dialog-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setShowDeleteDialog(false)}
              >
                Keep resume
              </Button>
              <Button
                variant="primary"
                className="danger-button"
                type="button"
                onClick={handleDelete}
              >
                Delete resume
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
