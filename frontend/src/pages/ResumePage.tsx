/*
 * JobCoachAI - Resume Builder
 *
 * Handles resume creation, editing, preview,
 * and export for guest and registered users.
 */
import { useEffect, useState, type DragEvent, type KeyboardEvent } from "react";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { Button } from "../components/Button";
import {
  saveResumeToDatabase,
} from "../services/resumeService";
import { DocumentEditor } from "../components/DocumentEditor";
import {
  initialResume,
  resumeSectionEntries,
  type Certification,
  type Education,
  type Project,
  type ResumeProfile,
  type Skill,
  type WorkExperience,
  type ResumeSaveRequest
} from "../features/resume/resumeData";

// Props passed from App.tsx
type ResumePageProps = {
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
export const resumeDraftStorageKey = "jobcoachai.resumeDraft";
type ResumeDraft = {
  profile: ResumeProfile;
  sections: ResumeSection[];
  filename: string;
};
const readResumeDraft = (): ResumeDraft | null => {
  try {
    const storedDraft = sessionStorage.getItem(resumeDraftStorageKey);
    return storedDraft ? (JSON.parse(storedDraft) as ResumeDraft) : null;
  } catch {
    return null;
  }
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
const toDateInputValue = (value: string) => {
  if (/^\d{4}$/.test(value)) return `${value}-01-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return "";
};
const getSafeFilename = (value: string) =>
  (value.trim() || "resume").replace(/[<>:"\/\\|?*]+/g, "-");
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
  "work_experience",
  "education",
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
export function ResumePage({
  isGuest = true,
  onResumeReadyChange,
}: ResumePageProps) {
  const storedDraft = readResumeDraft();
  // Resume profile and section data
  const [profile, setProfile] = useState<ResumeProfile>(() =>
    storedDraft?.profile ?? { ...emptyProfile },
  );
  const [sections, setSections] = useState<ResumeSection[]>(() =>
    storedDraft?.sections ?? createSections(true),
  );

  // File upload and status messages
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeFilename, setResumeFilename] = useState(storedDraft?.filename ?? "");
  const [status, setStatus] = useState("");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [showGuestExportWarning, setShowGuestExportWarning] = useState(false);
  const [exportedGuestSnapshot, setExportedGuestSnapshot] = useState<string | null>(null);
  const [guestExporting, setGuestExporting] = useState(false);
  const [pendingPdfSnapshot, setPendingPdfSnapshot] = useState<string | null>(null);
  const [pendingDocxSnapshot, setPendingDocxSnapshot] = useState<string | null>(null);
  // Confirmation dialogs and resume deletion state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBackWarning, setShowBackWarning] = useState(false);
  const [resumeDeleted, setResumeDeleted] = useState(false);
  const [draggedSection, setDraggedSection] = useState<SectionKey | null>(null);
  const [dropTarget, setDropTarget] = useState<SectionKey | null>(null);
  // Track which resume sections are expanded
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    summary: false,
    education: false,
    work_experience: false,
    skills: false,
    projects: false,
    certifications: false,
  });
  // Sample data is opt-in: never populate Jordan Lee automatically on page entry.
  const handleLoadSample = () => {
    setProfile({
      first_name: initialResume.first_name,
      last_name: initialResume.last_name,
      email: initialResume.email,
      phone: initialResume.phone,
      location: initialResume.location,
      professional_summary: initialResume.professional_summary,
    });
    setSections(createSections(false).map((section) => ({
      ...section,
      entries: section.entries.map((entry) =>
        typeof entry === "string" ? entry : { ...entry },
      ),
    })));
    setResumeFilename("Jordan-Lee-Resume");
    setExportedGuestSnapshot(null);
    setPendingPdfSnapshot(null);
    setPendingDocxSnapshot(null);
    setResumeDeleted(false);
    setStatus("Jordan Lee sample resume loaded. You can now edit the details.");
  };
  // Clear the visible editor and the stored draft; do not delete any saved database resume.
  const handleClearResume = () => {
    // Remove the persisted sample/draft before navigating away from this page.
    sessionStorage.removeItem(resumeDraftStorageKey);
    // All displayed fields and preview use these controlled React values.
    setProfile({ ...emptyProfile });
    setSections(createSections(true));
    setResumeFilename("");
    setResumeFile(null);
    setResumeDeleted(false);
    setExportMenuOpen(false);
    setShowGuestExportWarning(false);
    setExportedGuestSnapshot(null);
    setPendingPdfSnapshot(null);
    setPendingDocxSnapshot(null);
    setShowDeleteDialog(false);
    // Keep optional resume sections collapsed after clearing.
    // Personal information is always visible in the editor.
    setOpenSections({
      summary: false,
      education: false,
      work_experience: false,
      skills: false,
      projects: false,
      certifications: false,
    });
    // Also reset the native file input, which is not controlled by React.
    const fileInput = document.getElementById("resume-page-upload") as HTMLInputElement | null;
    if (fileInput) fileInput.value = "";
    setStatus("Resume editor cleared. You can start a new resume or load sample data.");
  };
  useEffect(() => {
    const hasDraftContent =
      Object.values(profile).some((value) => value.trim() !== "") ||
      sections.some((section) => section.entries.some(hasEntryContent));
    if (hasDraftContent) {
      sessionStorage.setItem(
        resumeDraftStorageKey,
        JSON.stringify({ profile, sections, filename: resumeFilename }),
      );
    } else {
      // Do not revive a draft once every field has been cleared.
      sessionStorage.removeItem(resumeDraftStorageKey);
    }
  }, [profile, sections, resumeFilename]);
  useEffect(() => {
    const hasDraftContent =
      Object.values(profile).some((value) => value.trim() !== "") ||
      sections.some((section) => section.entries.some(hasEntryContent));
    const warnBeforeClose = (event: BeforeUnloadEvent) => {
      if (!hasDraftContent) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeClose);
    return () => window.removeEventListener("beforeunload", warnBeforeClose);
  }, [profile, sections]);
  // Expand or collapse a resume section
  const toggleSection = (sectionKey: SectionKey) => {
    setOpenSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  };
  // Only editable sections can move; personal information is rendered separately above them.
  const moveSection = (source: SectionKey, target: SectionKey) => {
    if (source === target) return;
    setSections((current) => {
      const sourceIndex = current.findIndex((section) => section.key === source);
      const targetIndex = current.findIndex((section) => section.key === target);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const reordered = [...current];
      const [moved] = reordered.splice(sourceIndex, 1);
      reordered.splice(targetIndex, 0, moved);
      return reordered;
    });
  };
  const handleSectionDragStart = (event: DragEvent<HTMLButtonElement>, key: SectionKey) => {
    setDraggedSection(key);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", key);
  };
  const handleSectionDrop = (event: DragEvent<HTMLElement>, target: SectionKey) => {
    event.preventDefault();
    const source = draggedSection;
    if (source && sectionOrder.includes(source)) moveSection(source, target);
    setDraggedSection(null);
    setDropTarget(null);
  };
  // Arrow keys let keyboard users reorder sections using the same six-dot handle.
  const handleReorderKeyDown = (event: KeyboardEvent<HTMLButtonElement>, key: SectionKey) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const index = sections.findIndex((section) => section.key === key);
    const neighbor = sections[index + (event.key === "ArrowUp" ? -1 : 1)];
    if (neighbor) moveSection(key, neighbor.key);
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
  // Only sections removed from the editor can be added back.
  const availableSections = sectionOrder.filter(
    (sectionKey) => !sections.some((section) => section.key === sectionKey),
  );
  // Add the section explicitly selected from the missing-sections dropdown.
  const addSection = (sectionKey: SectionKey) => {
    if (!sectionOrder.includes(sectionKey)) return;
    setSections((current) => {
      if (current.some((section) => section.key === sectionKey)) return current;
      return [...current, {
        key: sectionKey,
        title: sectionLabels[sectionKey],
        entries: [getBlankSectionEntry(sectionKey)],
      }];
    });
    setOpenSections((current) => ({ ...current, [sectionKey]: true }));
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
  // Only an export of the current editor content clears the guest checkpoint.
  const currentResumeSnapshot = JSON.stringify({ profile, sections, resumeFilename });
  const guestExportIsCurrent = exportedGuestSnapshot === currentResumeSnapshot;
  const personalInfoComplete = personalFields.every(({ key }) => profile[key].trim() !== "");
  const summaryComplete = Boolean(
    sections.find((section) => section.key === "summary")?.entries.some(hasEntryContent),
  );
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
    work_experience: (
      (sections.find((section) => section.key === "work_experience")?.entries as WorkExperience[]) ?? []
    ).filter(hasEntryContent).map((entry,index)=> ({
      ...entry,
      sort_order: index
    })),
    education: ((sections.find((section) => section.key === "education")?.entries as Education[]) ?? []
     ).filter(hasEntryContent).map((entry,index)=> ({
      ...entry,
      sort_order: index
    })),
    skills:( (sections.find((section)=> section.key === "skills")?.entries as Skill[]) ?? []
     ).filter(hasEntryContent).map((entry,index)=> ({
      ...entry,
      sort_order: index,
    })),
    projects:( (sections.find((section)=> section.key  === "projects")?.entries as Project[]) ?? []
     ).filter(hasEntryContent).map((entry,index)=> ({
      ...entry,
      sort_order: index
    })),
    certifications:( (sections.find((section)=> section.key === "certifications")?.entries as Certification[]) ?? []
     ).filter(hasEntryContent).map((entry,index)=> ({
      ...entry,
      sort_order: index
    }))
  }
}
  const handleSave = async () => {
    try {
     const payload = buildResumePayload()
      await saveResumeToDatabase(payload)
      setStatus("saved Resume to Database")
      console.log("Resume Saved to Database")
    }
    catch(error) {
      setStatus("error saving resume")
      console.log("error saving resume:",error)
    }
  }
const hasExportableData = Boolean(
    Object.values(profile).some((value) => value.trim() !== "") || hasResumeContent,
  );
  const exportResumeAsDocx = async () => {
    if (!hasExportableData) {
      setStatus("Add resume information before exporting a DOCX or PDF.");
      return;
    }
    const exportSnapshot = currentResumeSnapshot;
    const contactDetails = [profile.email, profile.phone, profile.location]
      .filter(Boolean)
      .join(" • ");
    const children: Paragraph[] = [
      new Paragraph({
        children: [
          new TextRun({
            text: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Resume",
            bold: true,
            size: 32,
          }),
        ],
        heading: HeadingLevel.TITLE,
      }),
    ];
    if (contactDetails) {
      children.push(new Paragraph(contactDetails));
    }
    sections
      .filter((section) => section.entries.some(hasEntryContent))
      .forEach((section) => {
        children.push(
          new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }),
        );
        section.entries.filter(hasEntryContent).forEach((entry) => {
          children.push(new Paragraph(formatEntryPreview(entry)));
        });
      });
    const document = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(document);
    const link = window.document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${getSafeFilename(resumeFilename)}.docx`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    // A guest confirms the downloaded copy before continuing from the warning.
    if (isGuest && showGuestExportWarning) {
      setPendingDocxSnapshot(exportSnapshot);
      setPendingPdfSnapshot(null);
    } else {
      setExportedGuestSnapshot(exportSnapshot);
    }
    setStatus("Resume DOCX download started. Confirm you saved the file before continuing.");
  };
  const exportResumeAsPdf = () => {
    if (!hasExportableData) {
      setStatus("Add resume information before exporting a DOCX or PDF.");
      return;
    }
    setStatus("Choose Save as PDF in the print dialog to download your resume.");
    if (isGuest && showGuestExportWarning) {
      // Browsers do not report whether the print dialog actually saved a PDF.
      // Ask the guest to confirm the file was saved before allowing Continue.
      setPendingPdfSnapshot(currentResumeSnapshot);
      setPendingDocxSnapshot(null);
    }
    const originalTitle = document.title;
    document.title = getSafeFilename(resumeFilename);
    window.print();
    window.setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };
  const handleDelete = () => {
    setResumeDeleted(true);
    setShowDeleteDialog(false);
    setStatus("Resume deleted from this workspace.");
  };
  const handleResumeFileChange = (file: File | null) => {
    if (!file) return;
    const isWordDocument = file.name.toLowerCase().endsWith(".docx");
    if (!isWordDocument) {
      setResumeFile(null);
      setStatus("PDF files are not supported. Please choose a Microsoft Word .docx file.");
      return;
    }
    setResumeFile(file);
    setStatus(`Opening ${file.name} in the Word workspace.`);
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
              sessionStorage.removeItem(resumeDraftStorageKey);
              setSections(createSections(true));
              setProfile({ ...emptyProfile });
              setResumeFilename("resume");
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
      <div className={resumeFile ? "resume-side-by-side" : undefined}>
        {resumeFile && (
          <aside className="resume-document-pane">
            <DocumentEditor
              file={resumeFile}
              onClose={() => setResumeFile(null)}
              readOnly
            />
          </aside>
        )}
        <div className="resume-main-pane">
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
        onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
        }}
      >
        {/* Sample resume is loaded only when explicitly requested. */}
        <div className="resume-sample-row">
          <Button type="button" variant="secondary" onClick={handleLoadSample}>
            Load Sample Data
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClearResume}
          >
            Clear Data
          </Button>
          <span>Optional sample data for testing the resume editor.</span>
        </div>
        {/* Resume file upload */}
        <div className="resume-upload-row">
          <div className="resume-filename-field">
            <label htmlFor="resume-filename">Resume filename</label>
            <input
              id="resume-filename"
              type="text"
              value={resumeFilename}
              onChange={(event) => setResumeFilename(event.target.value)}
              placeholder="Filename for export"
            />
          </div>
          <div className="resume-upload-file">
            <span className="panel-icon">RESUME FILE</span>
            <span className="resume-upload-file-name">
              {(resumeFile as File | null)?.name ?? "No resume selected"}
            </span>
          </div>
          <input
            id="resume-page-upload"
            className="resume-upload-input"
            name="resume"
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => {
              handleResumeFileChange(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
          <label
            className="button button-primary upload-button"
            htmlFor="resume-page-upload"
          >
            Upload Resume <span aria-hidden="true">↑</span>
          </label>
          {!isGuest && (
            <Button type="submit" variant="secondary" className="resume-top-save-button">
              Save Resume <span aria-hidden="true">✓</span>
            </Button>
          )}
        </div>
        {/* Personal information fields */}
        <section className="resume-section">
          <div className="resume-section-header">
            <span className="resume-section-number">00</span>
            <span className="resume-section-heading">
              <strong>Personal information <span aria-label="required" style={{ color: "#dc2626" }}>*</span></strong>
              <small>Shown at the top of your resume</small>
            </span>
            <span className="resume-section-chevron" aria-hidden="true" />
            <span className="resume-section-action" />
          </div>
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
            <section
              className={`resume-section${dropTarget === section.key && draggedSection !== section.key ? " resume-section-drop-target" : ""}${draggedSection === section.key ? " resume-section-dragging" : ""}`}
              key={section.key}
              onDragOver={(event) => {
                if (!draggedSection || draggedSection === section.key) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTarget(section.key);
              }}
              onDrop={(event) => handleSectionDrop(event, section.key)}
              onDragEnd={() => { setDraggedSection(null); setDropTarget(null); }}
            >
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
                    <strong>{section.title}{section.key === "summary" && <> <span aria-label="required" style={{ color: "#dc2626" }}>*</span></>}</strong>
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
                  <button
                    className="resume-reorder-handle"
                    type="button"
                    draggable
                    onDragStart={(event) => handleSectionDragStart(event, section.key)}
                    onDragEnd={() => { setDraggedSection(null); setDropTarget(null); }}
                    onKeyDown={(event) => handleReorderKeyDown(event, section.key)}
                    aria-label={`Reorder ${section.title}. Drag or use up and down arrow keys.`}
                    title="Drag to reorder · Use ↑ or ↓ with keyboard"
                  >
                    <span className="resume-reorder-dots" aria-hidden="true">
                      {Array.from({ length: 6 }, (_, index) => <i key={index} />)}
                    </span>
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
                              <div
                                className={`field-group ${section.key === "work_experience" && fieldKey === "description" ? "resume-responsibilities-field" : ""}`}
                                key={`${section.key}-${entryIndex}-${fieldKey}`}
                              >
                                <div className="resume-field-caption">
                                  {!(section.key === "work_experience" &&
                                    fieldKey === "end_date" &&
                                    String(value).toLowerCase() === "present") && (
                                    <label htmlFor={`${section.key}-${entryIndex}-${fieldKey}`}>
                                      {section.key === "work_experience" && fieldKey === "description"
                                        ? "Responsibilities"
                                        : fieldKey
                                          .replace(/_/g, " ")
                                          .replace(/\b\w/g, (char) => char.toUpperCase())}
                                    </label>
                                  )}
                                  {section.key === "work_experience" && fieldKey === "end_date" && (
                                    <label className="present-job-toggle">
                                      <input
                                        type="checkbox"
                                        checked={String(value).toLowerCase() === "present"}
                                        onChange={(event) =>
                                          updateEntry(
                                            section.key,
                                            entryIndex,
                                            fieldKey,
                                            event.target.checked ? "Present" : "",
                                          )
                                        }
                                      />
                                      Present job
                                    </label>
                                  )}
                                </div>
                                {!(section.key === "work_experience" &&
                                  fieldKey === "end_date" &&
                                  String(value).toLowerCase() === "present") && (
                                  fieldKey === "description" ? (
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
                                        type={fieldKey.endsWith("_date") ? "date" : "text"}
                                        value={fieldKey.endsWith("_date") ? toDateInputValue(String(value)) : String(value)}
                                        onChange={(event) =>
                                          updateEntry(section.key, entryIndex, fieldKey, event.target.value)
                                        }
                                      />
                                  )
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
        {availableSections.length > 0 && (
          <div className="add-section-dropdown">
            <label htmlFor="resume-add-section">Add resume section</label>
            <select
              id="resume-add-section"
              className="add-section-select"
              value=""
              onChange={(event) => {
                if (event.target.value) addSection(event.target.value as SectionKey);
              }}
            >
              <option value="" disabled>+ Select a section to add</option>
              {availableSections.map((sectionKey) => (
                <option key={sectionKey} value={sectionKey}>
                  {sectionLabels[sectionKey]}
                </option>
              ))}
            </select>
          </div>
        )}
      </form>
      {/* Live preview of the completed resume */}
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
          role={(status === "Please create or upload a resume to continue." || status.includes("is required")) ? "alert" : "status"}
          style={
            (status === "Please create or upload a resume to continue." || status.includes("is required"))
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
              if (!personalInfoComplete) {
                setStatus("Personal information and professional summary is required to continue.");
                document.getElementById("resume-first_name")?.focus();
                return;
              }
              if (!summaryComplete) {
                setStatus("Professional summary is required before continuing.");
                setOpenSections((current) => ({ ...current, summary: true }));
                return;
              }
              if (!resumeReady) {
                setStatus("Please create or upload a resume to continue.");
                return;
              }
              if (isGuest && hasResumeContent && !guestExportIsCurrent) {
                setShowGuestExportWarning(true);
                return;
              }
              setStatus("");
              window.location.hash = '#tailor';
            }}
          >
            Continue <span aria-hidden="true">→</span>
          </Button>
          <div className="resume-export-actions">
            <Button
              variant="primary"
              type="button"
              aria-haspopup="dialog"
              aria-expanded={exportMenuOpen}
              onClick={() => setExportMenuOpen((open) => !open)}
            >
              Export Resume
            </Button>
          </div>
        </div>
      </div>
      {showGuestExportWarning && (
        <div className="dialog-backdrop" role="presentation">
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="guest-export-title"
            aria-describedby="guest-export-description"
          >
            <span className="panel-icon">GUEST RESUME</span>
            <h3 id="guest-export-title">Warning! Export your resume before continuing</h3>
            <p id="guest-export-description">
              You are continuing as a guest. Export a copy of your resume profile
              before proceeding so you do not lose your work when this session ends.
            </p>
            {guestExportIsCurrent && (
              <p className="guest-export-success" role="status">
                Your exported resume is ready. Confirm your saved copy before continuing.
              </p>
            )}
            {pendingDocxSnapshot === currentResumeSnapshot && !guestExportIsCurrent && (
              <p role="status">Your DOCX download was started. Check your downloads and confirm you saved the file below.</p>
            )}
            {pendingPdfSnapshot === currentResumeSnapshot && !guestExportIsCurrent && (
              <p role="status">
                In the print dialog, select <strong>Save as PDF</strong> and save the file.
                Confirm below to continue directly. If you canceled printing, choose Export resume as PDF again.
              </p>
            )}
            <div className="dialog-actions guest-export-dialog-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setShowGuestExportWarning(false)}
              >
                Stay on resume
              </Button>
              {guestExportIsCurrent ? (
                <Button
                  variant="primary"
                  type="button"
                  onClick={() => {
                    setShowGuestExportWarning(false);
                    setStatus("");
                    window.location.hash = '#tailor';
                  }}
                >
                  Saved as DOCX — Continue <span aria-hidden="true">→</span>
                </Button>
              ) : (
                <>
                <Button
                  variant="primary"
                  type="button"
                  disabled={guestExporting}
                  onClick={async () => {
                    setGuestExporting(true);
                    try {
                      await exportResumeAsDocx();
                    } catch (error) {
                      setStatus("Could not export resume. Please try again.");
                      console.error("Resume export failed:", error);
                    } finally {
                      setGuestExporting(false);
                    }
                  }}
                >
                  {guestExporting ? "Preparing DOCX…" : "Export resume as DOCX"}
                </Button>
                <Button
                  variant="primary"
                  type="button"
                  disabled={guestExporting}
                  onClick={exportResumeAsPdf}
                >
                  Export resume as PDF
                </Button>
                {pendingDocxSnapshot === currentResumeSnapshot && (
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      setExportedGuestSnapshot(currentResumeSnapshot);
                      setPendingDocxSnapshot(null);
                      setPendingPdfSnapshot(null);
                      setShowGuestExportWarning(false);
                      setStatus("");
                      window.location.hash = '#tailor';
                    }}
                  >
                    Saved as DOCX — Continue <span aria-hidden="true">→</span>
                  </Button>
                )}
                {pendingPdfSnapshot === currentResumeSnapshot && (
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      // The browser cannot verify whether Save as PDF completed.
                      // The guest confirms saving, then continues in the same click.
                      setExportedGuestSnapshot(currentResumeSnapshot);
                      setPendingPdfSnapshot(null);
                      setShowGuestExportWarning(false);
                      setStatus("");
                      window.location.hash = '#tailor';
                    }}
                  >
                    Saved as PDF — Continue <span aria-hidden="true">→</span>
                  </Button>
                )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {exportMenuOpen && (
        <div className="export-dialog-backdrop" role="presentation">
          <div
            className="export-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-dialog-title"
            aria-describedby="export-dialog-description"
          >
            <span className="panel-icon">SAVE AS</span>
            <h3 id="export-dialog-title">Choose a file type</h3>
            <p id="export-dialog-description">
              Download your resume as PDF or DOCX.
            </p>
            <div className="export-dialog-options">
              <Button
                variant="primary"
                type="button"
                onClick={() => {
                  setExportMenuOpen(false);
                  exportResumeAsPdf();
                }}
              >
                Save as PDF <span aria-hidden="true">↗</span>
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={() => {
                  setExportMenuOpen(false);
                  void exportResumeAsDocx();
                }}
              >
                Save as DOCX <span aria-hidden="true">↓</span>
              </Button>
            </div>
            <button
              className="export-dialog-cancel"
              type="button"
              onClick={() => setExportMenuOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
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
        </div>
      </div>
    </section>
  );
}
