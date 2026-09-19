import { useState } from "react";
import { Button } from "../components/Button";
import { saveResumeToDatabase, deleteResumeFromDatabase,updateResumeToDatabase} from "../services/resumeService";

import {
  initialResume,
  resumeSectionEntries,
  type Certification,
  type Education,
  type Project,
  type ResumeProfile,
  type Skill,
  type WorkExperience,
  type SectionOrder,
  type ResumeSaveRequest
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
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    summary: false,
    education: false,
    work_experience: false,
    skills: false,
    projects: false,
    certifications: false,
  });
  const [saved,setSaved] = useState(false)

  const toggleSection = (sectionKey: SectionKey) => {
    setOpenSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  };

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

    setSections((current) =>
      [...current, {
        key: nextSection,
        title: sectionLabels[nextSection],
        entries: [getBlankSectionEntry(nextSection)],
      }].sort(
        (left, right) => sectionOrder.indexOf(left.key) - sectionOrder.indexOf(right.key),
      ),
    );
    setOpenSections((current) => ({ ...current, [nextSection]: true }));
  };

  const removeSection = (sectionKey: SectionKey) => {
    setSections((current) => current.filter((section) => section.key !== sectionKey));
    setOpenSections((current) => ({ ...current, [sectionKey]: false }));
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

 function buildResumePayload(): ResumeSaveRequest {
 return {
  resume: {
    full_name: `${profile.first_name} ${profile.last_name}`.trim(),
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    professional_summary: profile.professional_summary
    },
    section_order: sections.map((section,index) => ({
      section_name: section.key,
      section_order: index,
    })),
    work_experience: (sections.find((section) => section.key === "work_experience")?.entries as WorkExperience[]) ?? [],
    education: (sections.find((section) => section.key === "education")?.entries as Education[]) ?? [],
    skills: (sections.find((section)=> section.key === "skills")?.entries as Skill[]) ?? [],
    projects: (sections.find((section)=> section.key  === "projects")?.entries as Project[]) ?? [],
    certifications: (sections.find((section)=> section.key === "certifications")?.entries as Certification[]) ?? [], 
  }
}

  const handleSave = async () => {
    try {
     const payload = buildResumePayload()
      await saveResumeToDatabase(payload)
      setSaved(true)
      setStatus("saved Resume to Database")
      console.log("Resume Saved to Database")
    }
    catch(error) {
      setStatus("error saving resume")
      console.log("error saving resume:",error)
    }
  }

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
    <section className="screen resume-editor-page" data-screen="parsed">
      <div className="resume-editor-header">
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

        <div className="resume-editor-header-actions">
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

      <div className="resume-local-notice">
        <span className="resume-info-icon">i</span>
        <span>{status || "Changes stay local until connected to your account."}</span>
      </div>

      <form
        className="resume-editor"
        onSubmit={(event) => {
          event.preventDefault();
          setStatus("Resume saved just now.");
        }}
      >
        <section className="resume-section">
          <button className="resume-section-header" type="button">
            <span className="resume-section-number">00</span>
            <span className="resume-section-heading">
              <strong>Personal information</strong>
              <small>Shown at the top of your resume</small>
            </span>
            <span className="resume-section-chevron open">⌄</span>
            <span className="resume-section-action" />
          </button>

          <div className="resume-section-content">
            <div className="resume-personal-grid">
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
          </div>
        </section>

        {sections.map((section, sectionIndex) => {
          const isOpen = openSections[section.key];

          return (
            <section className="resume-section" key={section.key}>
              <div className="resume-section-header">
                <button
                  className="resume-section-main"
                  type="button"
                  onClick={() => toggleSection(section.key)}
                  aria-expanded={isOpen}
                >
                  <span className="resume-section-number">
                    {String(sectionIndex + 1).padStart(2, "0")}
                  </span>
                  <span className="resume-section-heading">
                    <strong>{section.title}</strong>
                    <small>Resume details</small>
                  </span>
                  <span className={`resume-section-chevron ${isOpen ? "open" : ""}`}>
                    ⌄
                  </span>
                </button>
                <span className="resume-section-action">
                  <button
                    className="remove-button"
                    type="button"
                    onClick={() => removeSection(section.key)}
                  >
                    Remove section
                  </button>
                </span>
              </div>

              {isOpen && (
                <div className="resume-section-content">
                  {section.entries.length === 0 ? (
                    <p className="resume-empty-message">No entries yet.</p>
                  ) : (
                    section.entries.map((entry, entryIndex) => {
                      if (typeof entry === "string") {
                        return (
                          <div className="resume-entry-card" key={`${section.key}-${entryIndex}`}>
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
                              className="text-button resume-remove-entry"
                              type="button"
                              onClick={() => removeEntry(section.key, entryIndex)}
                              aria-label={`Remove ${section.title} entry ${entryIndex + 1}`}
                            >
                              Remove entry
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div className="resume-entry-card" key={`${section.key}-${entryIndex}`}>
                          <div className="resume-entry-grid">
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
                            className="text-button resume-remove-entry"
                            type="button"
                            onClick={() => removeEntry(section.key, entryIndex)}
                            aria-label={`Remove ${section.title} entry ${entryIndex + 1}`}
                          >
                            Remove entry
                          </button>
                        </div>
                      );
                    })
                  )}

                  <button className="add-button" type="button" onClick={() => addEntry(section.key)}>
                    + Add {section.key === "skills" ? "skill" : "entry"}
                  </button>
                </div>
              )}
            </section>
          );
        })}

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
          <Button  onClick={handleSave}>
            Save resume <span aria-hidden="true">✓</span>
            
          </Button>
          
        </div>
      </form>

      <section className="resume-preview-section">
        <div className="resume-preview-heading">
          <div>
            <span className="panel-icon">PREVIEW</span>
            <h3>Resume preview</h3>
            <p>Review your completed resume before exporting.</p>
          </div>
        </div>

        <div className="resume-preview-background">
          <div className="resume-preview-page-frame">
            {(profile.first_name ||
              profile.last_name ||
              profile.email ||
              profile.phone ||
              profile.location ||
              sections.some((section) => section.entries.some(hasEntryContent))) ? (
              <>
                <div className="preview-header">
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
                    <div className="preview-section" key={section.key}>
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
              <p className="resume-empty-message">
                Your resume preview will appear here as you add information.
              </p>
            )}
          </div>
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
