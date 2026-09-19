/*
 * JobCoachAI - Resume Builder
 *
 * Handles resume creation, editing, preview,
 * and export for guest and registered users.
 */

import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import {
  initialResume,
  resumeSectionEntries,
  type Certification,
  type Education,
  type Project,
  type ResumeProfile,
  type Resume,
  type Skill,
  type WorkExperience,
} from "../features/resume/resumeData";
import {
  deleteResumeFromDatabase,
  saveResumeToDatabase,
} from "../services/resumeService";

// Props passed from App.tsx
type ResumePageProps = {
  blankResume?: boolean;
  isGuest?: boolean;
  onResumeReadyChange?: (ready: boolean) => void;
};

// Supported resume sections
type SectionKey =
  | "summary"
  | "education"
  | "work_experience"
  | "skills"
  | "projects"
  | "certifications";

// Entry types used by the resume editor
type SectionEntry =
  | string
  | WorkExperience
  | Education
  | Skill
  | Project
  | Certification;

// Structure for each editable resume section
type ResumeSection = {
  key: SectionKey;
  title: string;
  entries: SectionEntry[];
};

// Default values for a new resume
const emptyProfile: ResumeProfile = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  location: "",
  professional_summary: "",
};

// Personal information fields displayed in the form
const personalFields: Array<{ key: keyof ResumeProfile; label: string; type?: string }> = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "location", label: "Location" },
];

// Display names for resume sections
const sectionLabels: Record<SectionKey, string> = {
  summary: "Professional summary",
  education: "Education",
  work_experience: "Experience",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
};

// Keep resume sections in a consistent order
const sectionOrder: SectionKey[] = [
  "summary",
  "education",
  "work_experience",
  "skills",
  "projects",
  "certifications",
];

// Create an empty entry based on the selected section
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

// Load blank fields or existing sample resume data
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

// Convert the form data into the format expected by the resume service
function buildResumePayload(
  profile: ResumeProfile,
  sections: ResumeSection[],
): Resume {
  // Collect entries for each section
  const getEntries = <T extends Exclude<SectionEntry, string>>(
    key: SectionKey,
  ): T[] => {
    const entries = sections.find((section) => section.key === key)?.entries ?? [];

    return entries.filter(
      (entry): entry is Exclude<SectionEntry, string> =>
        typeof entry !== "string",
    ) as T[];
  };
  const summary = sections.find((section) => section.key === "summary")?.entries[0];

  return {
    ...profile,
    summary: typeof summary === "string" ? summary : profile.professional_summary,
    work_experience: getEntries<WorkExperience>("work_experience"),
    education: getEntries<Education>("education"),
    skills: getEntries<Skill>("skills"),
    projects: getEntries<Project>("projects"),
    certifications: getEntries<Certification>("certifications"),
  };
}

export function ResumePage({
  blankResume = true,
  isGuest = true,
  onResumeReadyChange,
}: ResumePageProps) {
  // Resume profile and section data
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
  // File upload and status messages
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  // Confirmation dialogs and resume deletion state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBackWarning, setShowBackWarning] = useState(false);
  const [resumeDeleted, setResumeDeleted] = useState(false);
  // Track which resume sections are expanded
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    summary: false,
    education: false,
    work_experience: false,
    skills: false,
    projects: false,
    certifications: false,
  });

  // Expand or collapse a resume section
  const toggleSection = (sectionKey: SectionKey) => {
    setOpenSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  };

  // Update personal information
  const updateProfile = (field: keyof ResumeProfile, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  // Update an individual resume entry
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

  // Add another entry to an existing section
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

  // Remove an entry without leaving the section empty
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

  // Add the next available resume section
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

  // Remove a resume section from the editor
  const removeSection = (sectionKey: SectionKey) => {
    setSections((current) => current.filter((section) => section.key !== sectionKey));
    setOpenSections((current) => ({ ...current, [sectionKey]: false }));
  };

  // Check whether an entry contains user-provided information
  const hasEntryContent = (entry: SectionEntry) => {
    if (typeof entry === "string") return entry.trim() !== "";
    return Object.values(entry).some(
      (value) => typeof value === "string" && value.trim() !== "",
    );
  };


  // Check if the user has created or uploaded a resume
  // TODO: Use the backend parsing result once resume parsing is connected
  const hasResumeContent = sections.some((section) =>
    section.entries.some(hasEntryContent),
  );
  const resumeReady = Boolean(resumeFile) || hasResumeContent;

  // Update App.tsx when the resume becomes available or is deleted
  useEffect(() => {
    onResumeReadyChange?.(resumeReady && !resumeDeleted);
  }, [onResumeReadyChange, resumeReady, resumeDeleted]);

  // Format resume entries for the preview
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

  // Delete the current resume and update the page status
  const handleDelete = async () => {
    try {
      await deleteResumeFromDatabase();
      setResumeDeleted(true);
      setShowDeleteDialog(false);
      setStatus("Resume deleted from this workspace.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to delete resume.");
    }
  };

  // Show the empty state after the resume is deleted
  if (resumeDeleted) {
    return (
      <section className="screen resume-screen" data-screen="parsed">
        <div className="resume-empty-state">
          <span className="section-kicker">02 / Build your resume</span>
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

  // Main resume builder interface
  return (
    <section className="screen resume-editor-page" data-screen="parsed">
      <div className="resume-editor-header">
        <div className="screen-intro">
          <span className="section-kicker">02 / Build your resume</span>
          <h2>
            Build your <em>Resume</em>
          </h2>
        </div>

      </div>


      {/* Resume editor form */}
      <form
        id="resume-form"
        className="resume-editor"
        // Save the resume using the database service
        onSubmit={async (event) => {
          event.preventDefault();
          // Save the current resume data
          try {
            await saveResumeToDatabase(buildResumePayload(profile, sections));
            setStatus("Resume saved just now.");
          } catch (error) {
            setStatus(error instanceof Error ? error.message : "Unable to save resume.");
          }
        }}
      >
        {/* Resume file upload */}
        <div className="resume-upload-row">
          <div className="resume-upload-file">
            <span className="panel-icon">RESUME FILE</span>
            <span className="resume-upload-file-name">
              {resumeFile ? resumeFile.name : "No resume selected"}
            </span>
          </div>

          <input
            id="resume-page-upload"
            className="resume-upload-input"
            name="resume"
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setResumeFile(file);
              setStatus(file ? `Selected ${file.name}.` : "");
            }}
          />

          <label
            className="button button-primary upload-button"
            htmlFor="resume-page-upload"
          >
            Upload resume <span aria-hidden="true">↑</span>
          </label>
        </div>

        {/* Personal information fields */}
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

        {/* Render the editable resume sections */}
        {sections.map((section, sectionIndex) => {
          // Check if the current section is expanded
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
                    // Render fields for each entry
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

                  {/* Add another resume section */}
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



      </form>

      {/* Live preview of the completed resume */}
      <section className="resume-preview-section">
        <div className="resume-preview-heading">
          <div>
            <span className="panel-icon">PREVIEW</span>
            <h3>Resume preview</h3>
            <p>Review your completed resume before exporting.</p>
          </div>

          {!isGuest && (
            <div className="resume-preview-actions">
              <Button
                variant="secondary"
                type="button"
                disabled
                title="Save resume will be available when account saving is connected."
              >
                Save resume <span aria-hidden="true">✓</span>
              </Button>
            </div>
          )}
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
                        .map((entry, index) => {
                          // Clean professional layout for work experience
                          if (
                            section.key === "work_experience" &&
                            typeof entry !== "string"
                          ) {
                            const experience = entry as WorkExperience;

                            return (
                              <div
                                className="preview-experience"
                                key={`${section.key}-${index}`}
                              >
                                <div className="preview-experience-header">
                                  <div className="preview-experience-title-group">
                                    {experience.job_title && (
                                      <h3>{experience.job_title}</h3>
                                    )}

                                    {(experience.company || experience.location) && (
                                      <p className="preview-company">
                                        {experience.company}

                                        {experience.company && experience.location
                                          ? " | "
                                          : ""}

                                        {experience.location}
                                      </p>
                                    )}
                                  </div>

                                  {(experience.start_date || experience.end_date) && (
                                    <span className="preview-experience-date">
                                      {experience.start_date}

                                      {experience.start_date && experience.end_date
                                        ? " – "
                                        : ""}

                                      {experience.end_date}
                                    </span>
                                  )}
                                </div>

                                {experience.description && (
                                  <p className="preview-experience-description">
                                    {experience.description}
                                  </p>
                                )}
                              </div>
                            );
                          }

                          // Clean professional layout for education
                          if (
                            section.key === "education" &&
                            typeof entry !== "string"
                          ) {
                            const education = entry as Education;

                            return (
                              <div
                                className="preview-education"
                                key={`${section.key}-${index}`}
                              >
                                <div className="preview-education-header">
                                  <div className="preview-education-title-group">
                                    {education.school && (
                                      <h3>{education.school}</h3>
                                    )}

                                    {(education.degree || education.field_of_study) && (
                                      <p className="preview-education-degree">
                                        {education.degree}

                                        {education.degree && education.field_of_study
                                          ? " in "
                                          : ""}

                                        {education.field_of_study}
                                      </p>
                                    )}
                                  </div>

                                  {(education.start_date || education.end_date) && (
                                    <span className="preview-education-date">
                                      {education.start_date}

                                      {education.start_date && education.end_date
                                        ? " – "
                                        : ""}

                                      {education.end_date}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          // Other resume sections continue using existing formatting
                          return (
                            <p key={`${section.key}-${index}`}>
                              {formatEntryPreview(entry)}
                            </p>
                          );
                        })}
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

      <section
        className="resume-local-notice-section"
        aria-label="Local changes notice"
      >
        <div
          className="resume-local-notice"
          role={status === "Please create or upload a resume to continue." ? "alert" : "status"}
          style={
            status === "Please create or upload a resume to continue."
              ? { color: "#b91c1c", borderColor: "#fca5a5" }
              : undefined
          }
        >
          <span className="resume-info-icon">i</span>
          <span>
            {status || "Changes stay local until connected to your account."}
          </span>
        </div>
      </section>

      <div className="resume-bottom-actions">
        <button
          className="text-button"
          type="button"
          onClick={() => {
            setShowBackWarning(true)
          }}
        >
          <span aria-hidden="true">&larr;</span>{' '}
          Back
        </button>

        {/* Resume navigation, deletion, and export controls */}
        <div className="resume-bottom-action-buttons">
          <Button
            variant="secondary"
            style={{ borderColor: "#dc2626", color: "#dc2626" }}
            type="button"
            onClick={() => setShowDeleteDialog(true)}
          >
            Delete resume
          </Button>

          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              if (!resumeReady) {
                setStatus("Please create or upload a resume to continue.");
                return;
              }

              setStatus("");
              window.location.hash = '#tailor';
            }}
          >
            Continue <span aria-hidden="true">→</span>
          </Button>

          <Button
            variant="primary"
            type="button"
            onClick={() => window.print()}
          >
            Export resume <span aria-hidden="true">↗</span>
          </Button>
        </div>
      </div>

      {/* Confirm before leaving the resume editor */}
      {showBackWarning && (
        <div className="dialog-backdrop" role="presentation">
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="back-warning-title"
            aria-describedby="back-warning-description"
          >
            <span className="panel-icon">LEAVE RESUME</span>
            <h3 id="back-warning-title">Go back to Welcome?</h3>
            <p id="back-warning-description">
              Going back will clear the current resume. Any unsaved work
              on this page may be lost.
            </p>

            <div className="dialog-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setShowBackWarning(false)}
              >
                Stay on page
              </Button>

              <Button
                variant="primary"
                type="button"
                onClick={() => {
                  setShowBackWarning(false)
                  window.location.hash = '#welcome'
                }}
              >
                Go back
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm before deleting the resume */}
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
                variant="secondary"
                style={{ borderColor: "#dc2626", color: "#dc2626" }}
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
