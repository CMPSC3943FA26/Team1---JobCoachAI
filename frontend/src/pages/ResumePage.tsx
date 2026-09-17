import { useState } from "react";
import { Button } from "../components/Button";
import { initialResume } from "../features/resume/resumeData";

type ResumePageProps = { blankResume?: boolean };
type SectionKey =
  | "summary"
  | "education"
  | "experience"
  | "skills"
  | "projects"
  | "certifications";
type ResumeSection = {
  key: SectionKey | string;
  title: string;
  entries: string[];
  custom?: boolean;
};

const sectionLabels: Record<SectionKey, string> = {
  summary: "Professional summary",
  education: "Education",
  experience: "Experience",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
};

function createSections(blankResume: boolean): ResumeSection[] {
  return [
    {
      key: "summary",
      title: sectionLabels.summary,
      entries: blankResume ? [""] : initialResume.summary,
    },
    {
      key: "education",
      title: sectionLabels.education,
      entries: blankResume
        ? [""]
        : [
            "B.A. in Interaction Design | California College of the Arts | 2015 - 2019",
          ],
    },
    {
      key: "experience",
      title: sectionLabels.experience,
      entries: blankResume ? [""] : initialResume.experience,
    },
    {
      key: "skills",
      title: sectionLabels.skills,
      entries: blankResume ? [""] : initialResume.skills,
    },
    {
      key: "projects",
      title: sectionLabels.projects,
      entries: blankResume
        ? [""]
        : [
            "Onboarding redesign | Increased activation by 28% through a clearer first-run experience.",
          ],
    },
    {
      key: "certifications",
      title: sectionLabels.certifications,
      entries: blankResume ? [""] : ["Google UX Design Certificate | 2021"],
    },
  ];
}

export function ResumePage({ blankResume = false }: ResumePageProps) {
  const [profile, setProfile] = useState({
    firstName: blankResume ? "" : initialResume.firstName,
    lastName: blankResume ? "" : initialResume.lastName,
    email: blankResume ? "" : initialResume.email,
    phone: blankResume ? "" : initialResume.phone,
  });
  const [sections, setSections] = useState<ResumeSection[]>(() =>
    createSections(blankResume),
  );
  const [openSections, setOpenSections] = useState<string[]>([]);
  const toggleSection = (key: string) => {
    setOpenSections((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
  };
  const [jobTitle, setJobTitle] = useState("");
  const [status, setStatus] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [resumeDeleted, setResumeDeleted] = useState(false);

  const updateProfile = (field: keyof typeof profile, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const updateEntry = (
    sectionKey: string,
    entryIndex: number,
    value: string,
  ) => {
    setSections((current) =>
      current.map((section) =>
        section.key === sectionKey
          ? {
              ...section,
              entries: ((entry, index) =>
                index === entryIndex ? value : entry
              ),
            }
          : section,
      ),
    );
  };

  const addEntry = (sectionKey: string) => {
    setSections((current) =>
      current.map((section) =>
        section.key === sectionKey
          ? { ...section, entries: [...section.entries, ""] }
          : section,
      ),
    );
  };

  const removeEntry = (sectionKey: string, entryIndex: number) => {
    setSections((current) =>
      current.map((section) => {
        if (section.key !== sectionKey) return section;
        const entries = section.entries.filter(
          (_, index) => index !== entryIndex,
        );
        return { ...section, entries: entries.length ? entries : [""] };
      }),
    );
  };

  const addSection = () => {
    const title = window.prompt("Name this resume section")?.trim();
    if (!title) return;
    setSections((current) => [
      ...current,
      { key: `custom-${Date.now()}`, title, entries: [""], custom: true },
    ]);
  };

  const removeSection = (sectionKey: string) => {
    setSections((current) =>
      current.filter((section) => section.key !== sectionKey),
    );
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
            {(["firstName", "lastName", "email", "phone"] as const).map(
              (field) => (
                <div className="field-group" key={field}>
                  <label htmlFor={`resume-${field}`}>
                    {field === "firstName"
                      ? "First name"
                      : field === "lastName"
                        ? "Last name"
                        : field[0].toUpperCase() + field.slice(1)}
                  </label>
                  <input
                    id={`resume-${field}`}
                    type={
                      field === "email"
                        ? "email"
                        : field === "phone"
                          ? "tel"
                          : "text"
                    }
                    value={profile[field]}
                    onChange={(event) =>
                      updateProfile(field, event.target.value)
                    }
                    placeholder={
                      field === "email"
                        ? "you@example.com"
                        : field === "phone"
                          ? "(555) 555-5555"
                          : field === "firstName"
                            ? "First name"
                            : "Last name"
                    }
                  />
                </div>
              ),
            )}
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
                className="collapse-button"
               type="button"
                onClick={() => toggleSection(section.key)}
              >
                {openSections.includes(section.key) ? "▲ Hide" : "▼ Show"}
              </button>

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
              {openSections.includes(section.key) && (
  <>
              {((entry, entryIndex) => (
                <div
                  className="resume-entry"
                  key={`${section.key}-${entryIndex}`}
                >
                  {section.key === "skills" ? (
                    <input
                      value={entry}
                      onChange={(event) =>
                        updateEntry(section.key, entryIndex, event.target.value)
                      }
                      placeholder="e.g. Figma, user research, leadership"
                      aria-label={`${section.title} entry ${entryIndex + 1}`}
                    />
                  ) : (
                    <textarea
                      rows={section.key === "summary" ? 4 : 3}
                      value={entry}
                      onChange={(event) =>
                        updateEntry(section.key, entryIndex, event.target.value)
                      }
                      placeholder={
                        section.key === "summary"
                          ? "Write a concise professional summary..."
                          : `Add your ${section.title.toLowerCase()}...`
                      }
                      aria-label={`${section.title} entry ${entryIndex + 1}`}
                    />
                  )}
                  <button
                    className="remove-entry"
                    type="button"
                    onClick={() => removeEntry(section.key, entryIndex)}
                    aria-label={`Remove ${section.title} entry ${entryIndex + 1}`}
                  >
                    Remove
                  </button>
                </div>
               ))}
               </>
              )}
            </div>
          </section>
        ))}

        <button
          className="add-section-button"
          type="button"
          onClick={addSection}
        >
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
          {(profile.firstName ||
            profile.lastName ||
            profile.email ||
            profile.phone ||
            sections.some((section) =>
              section.entries.some((entry) => entry.trim())
            )) ? (
            <>
              <div className="resume-preview-profile">
                <h1>
                  {[profile.firstName, profile.lastName]
                    .filter(Boolean)
                    .join(" ")}
                </h1>

                {(profile.email || profile.phone) && (
                  <p>
                    {[profile.email, profile.phone]
                      .filter(Boolean)
                      .join(" • ")}
                  </p>
                )}
              </div>

              {((section) => {
                const entries = section.entries.filter(
                  (entry) => entry.trim() !== ""
                );

                if (entries.length === 0) return null;

                return (
                  <div
                    className="resume-preview-block"
                    key={section.key}
                  >sections.map
                    <h2>{section.title}</h2>

                    {entries.map((entry, index) => (
                      <p key={index}>{entry}</p>
                    ))}
                  </div>
                );
              })}
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