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
  deleteResumeFromDatabase,
  saveResumeToDatabase,
  setSavedResumeDisplayMeta,
  updateResumeToDatabase,
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
  onLoadResumeProfile?: (file: File) => Promise<void>;
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
export const resumeIdStorageKey = "jobcoachai.resumeId";
type ResumeDraft = {
  profile: ResumeProfile;
  sections: ResumeSection[];
  filename: string;
  csvSourceFilename?: string;
};
// JobCoachAI resume profile CSV: one row for each field of each resume entry.
const csvEscape = (value: string): string => `"${value.replace(/"/g, '""')}"`;
const parseResumeCsv = (input: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === '"' && quoted && input[i + 1] === '"') {
      cell += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && input[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (quoted) throw new Error("The CSV file contains an unfinished quoted field.");
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
};
const resumeCsvHeader = ["kind", "section", "entry", "field", "value"];
const parseResumeProfileCsv = (csv: string, uploadedFilename: string): ResumeDraft => {
  const rows = parseResumeCsv(csv.replace(/^\uFEFF/, ""));
  const header = rows.shift()?.map((cell) => cell.trim());
  if (!header || header.join(",") !== resumeCsvHeader.join(",")) {
    throw new Error("This is not a JobCoachAI resume profile CSV.");
  }
  const profile: ResumeProfile = { ...emptyProfile };
  const entryMaps = new Map<SectionKey, Map<number, Record<string, string> | string>>();
  let filename = uploadedFilename.replace(/\.csv$/i, "");
  let importedOrder: SectionKey[] | null = null;
  for (const [kind, sectionName, entryValue, field, value = ""] of rows) {
    if (kind === "meta" && field === "filename") {
      filename = value;
    } else if (kind === "meta" && field === "section_order") {
      try {
        const order: unknown = JSON.parse(value);
        if (Array.isArray(order)) {
          importedOrder = order.filter((key): key is SectionKey =>
            typeof key === "string" && sectionOrder.includes(key as SectionKey));
        }
      } catch { /* Older CSVs without section order remain supported. */ }
    } else if (kind === "profile" && field in profile) {
      profile[field as keyof ResumeProfile] = value;
    } else if (kind === "entry" && sectionOrder.includes(sectionName as SectionKey)) {
      const key = sectionName as SectionKey;
      const entryIndex = Number(entryValue);
      if (!Number.isInteger(entryIndex) || entryIndex < 0 || !field) continue;
      const mapped = entryMaps.get(key) ?? new Map<number, Record<string, string> | string>();
      const current = mapped.get(entryIndex);
      mapped.set(entryIndex, key === "summary"
        ? value
        : { ...(typeof current === "object" ? current : {}), [field]: value });
      entryMaps.set(key, mapped);
    }
  }
  const importedMovableOrder = (importedOrder ?? sectionOrder).filter((key) => key !== "summary");
  const orderedKeys: SectionKey[] = [
    "summary",
    ...new Set([...importedMovableOrder, ...sectionOrder.filter((key) => key !== "summary")]),
  ];
  const sections: ResumeSection[] = orderedKeys.filter((key) => entryMaps.has(key)).map((key) => {
    const entries: SectionEntry[] = [...(entryMaps.get(key)?.entries() ?? [])]
      .sort(([left], [right]) => left - right)
      .map(([, entry]) => typeof entry === "string"
        ? entry
        : { ...getBlankSectionEntry(key) as object, ...entry } as unknown as SectionEntry);
    return { key, title: sectionLabels[key], entries: entries.length ? entries : [getBlankSectionEntry(key)] };
  });
  // Fill in a blank professional summary when a CSV omits it, because the form requires it.
  if (!sections.some((section) => section.key === "summary")) {
    sections.unshift({ key: "summary", title: sectionLabels.summary, entries: [profile.professional_summary || ""] });
  }
  return { profile, sections, filename, csvSourceFilename: uploadedFilename };
};
const downloadResumeProfileCsv = (draft: ResumeDraft): void => {
  const rows: string[][] = [resumeCsvHeader];
  rows.push(["meta", "profile", "0", "filename", draft.filename]);
  rows.push(["meta", "profile", "0", "section_order", JSON.stringify(draft.sections.map((section) => section.key))]);
  Object.entries(draft.profile).forEach(([field, value]) => {
    rows.push(["profile", "profile", "0", field, value]);
  });
  draft.sections.forEach((section) => section.entries.forEach((entry, index) => {
    if (typeof entry === "string") {
      rows.push(["entry", section.key, String(index), "value", entry]);
    } else {
      Object.entries(entry).forEach(([field, value]) => {
        rows.push(["entry", section.key, String(index), field, String(value ?? "")]);
      });
    }
  }));
  const blob = new Blob([rows.map((row) => row.map(csvEscape).join(",")).join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${getSafeFilename(draft.filename)}-profile.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
// Also supports existing App.tsx integrations without requiring App changes.
export const loadResumeProfileCsv = async (file: File): Promise<ResumeDraft> =>
  parseResumeProfileCsv(await file.text(), file.name);
const readResumeDraft = (): ResumeDraft | null => {
  try {
    const storedDraft = sessionStorage.getItem(resumeDraftStorageKey);
    return storedDraft ? (JSON.parse(storedDraft) as ResumeDraft) : null;
  } catch {
    return null;
  }
};
export const saveStoredResumeProfileCsv = (): boolean => {
  const draft = readResumeDraft();
  if (!draft) return false;
  downloadResumeProfileCsv(draft);
  return true;
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

// Professional Summary is a required, fixed section. It must always remain
// the first editable section; every other section can only be reordered below it.
const lockProfessionalSummaryFirst = (items: ResumeSection[]): ResumeSection[] => {
  const summary = items.find((section) => section.key === "summary");
  const movableSections = items.filter((section) => section.key !== "summary");

  return summary
    ? [summary, ...movableSections]
    : [
        { key: "summary", title: sectionLabels.summary, entries: [""] },
        ...movableSections,
      ];
};
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
  onLoadResumeProfile,
}: ResumePageProps) {
  const storedDraft = readResumeDraft();
  // Resume profile and section data
  const [profile, setProfile] = useState<ResumeProfile>(() =>
    storedDraft?.profile ?? { ...emptyProfile },
  );
  const [sections, setSections] = useState<ResumeSection[]>(() =>
    lockProfessionalSummaryFirst(storedDraft?.sections ?? createSections(true)),
  );
  // File upload and status messages
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [importedCsvFilename, setImportedCsvFilename] = useState<string | null>(storedDraft?.csvSourceFilename ?? null);
  const [resumeFilename, setResumeFilename] = useState(storedDraft?.filename ?? "");
  const [status, setStatus] = useState("");
  const [savingResume, setSavingResume] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [showGuestExportWarning, setShowGuestExportWarning] = useState(false);
  const [exportedGuestSnapshot, setExportedGuestSnapshot] = useState<string | null>(null);
  // Confirmation dialogs and resume deletion state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBackWarning, setShowBackWarning] = useState(false);
  const [resumeDeleted, setResumeDeleted] = useState(false);
  const [draggedSection, setDraggedSection] = useState<SectionKey | null>(null);
  const [dropTarget, setDropTarget] = useState<SectionKey | null>(null);
  const [resumeId, setResumeID] = useState<string | null>(() =>
    sessionStorage.getItem(resumeIdStorageKey),
  );
  // Track which resume sections are expanded
  const [openSections, setOpenSections] = useState<Partial<Record<SectionKey, boolean>>>({
    summary: true,
    education: false,
    work_experience: false,
    skills: false,
    projects: false,
    certifications: false,
  });
  // Clear the visible editor and the stored draft; do not delete any saved database resume.
  const handleClearResume = () => {
    setResumeID(null);
    sessionStorage.removeItem(resumeIdStorageKey);
    // Remove the persisted sample/draft before navigating away from this page.
    sessionStorage.removeItem(resumeDraftStorageKey);
    // All displayed fields and preview use these controlled React values.
    setProfile({ ...emptyProfile });
    setSections(createSections(true));
    setResumeFilename("");
    setResumeFile(null);
    setImportedCsvFilename(null);
    setResumeDeleted(false);
    setExportMenuOpen(false);
    setShowGuestExportWarning(false);
    setExportedGuestSnapshot(null);
    setShowDeleteDialog(false);
    // Keep Professional Summary expanded by default and optional sections collapsed.
    // Personal information is always visible in the editor.
    setOpenSections({
      summary: true,
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
        JSON.stringify({ profile, sections, filename: resumeFilename, csvSourceFilename: importedCsvFilename ?? undefined }),
      );
    } else {
      // Do not revive a draft once every field has been cleared.
      sessionStorage.removeItem(resumeDraftStorageKey);
    }
  }, [profile, sections, resumeFilename, importedCsvFilename]);
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
    // Professional Summary is locked in the first position. It cannot move,
    // and no other section can be moved onto or above it.
    if (source === target || source === "summary" || target === "summary") return;

    setSections((current) => {
      const lockedCurrent = lockProfessionalSummaryFirst(current);
      const sourceIndex = lockedCurrent.findIndex((section) => section.key === source);
      const targetIndex = lockedCurrent.findIndex((section) => section.key === target);
      if (sourceIndex < 1 || targetIndex < 1) return lockedCurrent;

      const reordered = [...lockedCurrent];
      const [moved] = reordered.splice(sourceIndex, 1);
      reordered.splice(targetIndex, 0, moved);
      return lockProfessionalSummaryFirst(reordered);
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
    // Keep the profile-level professional summary synchronized with the
    // editable summary section so loaded resumes save the user's latest edit.
    if (sectionKey === "summary" && entryIndex === 0) {
      setProfile((current) => ({ ...current, professional_summary: value }));
    }

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
    // The first entry in every resume section is permanent. Only additional
    // entries created with the Add button can be removed.
    if (entryIndex === 0) return;
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
    if (sectionKey === "summary") return;
    setSections((current) =>
      current.filter((section) => section.key !== sectionKey)
    );
    setOpenSections((current) => ({
      ...current,
      [sectionKey]: false,
    }));
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
  // Normalize the editor's display-friendly date values to the concrete ISO
  // dates required by the current backend/database schema. This keeps the
  // frontend compatible without changing backend or database files.
  const toApiDate = (value: string | undefined) => {
    const trimmed = String(value ?? "").trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
    if (/^\d{4}$/.test(trimmed)) return `${trimmed}-01-01`;

    if (/^(present|current|now)$/i.test(trimmed)) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    return "";
  };

 function buildResumePayload(): ResumeSaveRequest {
 return {
  resume: {
    full_name: `${profile.first_name} ${profile.last_name}`.trim(),
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    professional_summary: String(
      sections.find((section) => section.key === "summary")?.entries[0] ??
        profile.professional_summary,
    )
    },
    section_order: sections.map((section,index) => ({
      section_name: section.key,
      section_order: index,
    })),
    work_experience: (
      (sections.find((section) => section.key === "work_experience")?.entries as WorkExperience[]) ?? []
    ).filter(hasEntryContent).map((entry,index)=> ({
      ...entry,
      start_date: toApiDate(entry.start_date),
      end_date: toApiDate(entry.end_date),
      sort_order: index
    })),
    education: ((sections.find((section) => section.key === "education")?.entries as Education[]) ?? []
     ).filter(hasEntryContent).map((entry,index)=> ({
      ...entry,
      start_date: toApiDate(entry.start_date),
      end_date: toApiDate(entry.end_date),
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
      date_earned: toApiDate(entry.date_earned),
      sort_order: index
    }))
  }
}
  const handleSave = async () => {
    if (savingResume) return false;

    if (!hasResumeContent) {
      setStatus("Add resume information before saving your resume.");
      return false;
    }

    // Guests do not own a persistent database resume. Their draft is already
    // maintained in sessionStorage by the effect above; write it once more
    // here so "Save and continue" is guaranteed to persist the latest edits
    // before Page 3 opens.
    if (isGuest) {
      sessionStorage.setItem(
        resumeDraftStorageKey,
        JSON.stringify({
          profile,
          sections,
          filename: resumeFilename,
          csvSourceFilename: importedCsvFilename ?? undefined,
        }),
      );
      sessionStorage.removeItem(resumeIdStorageKey);
      setResumeID(null);
      setStatus("Resume saved to your guest session.");
      return true;
    }

    setSavingResume(true);
    setStatus("Saving resume…");

    try {
      const payload = buildResumePayload();
      const createAndRememberResume = async () => {
        const result = await saveResumeToDatabase(payload);
        const savedId = result.id ?? result.resume_id ?? result.resume?.id;
        if (typeof savedId !== "string") {
          throw new Error("The saved resume response did not include an ID.");
        }
        sessionStorage.setItem(resumeIdStorageKey, savedId);
        setResumeID(savedId);
        const currentSavedFilename = `${profile.first_name} ${profile.last_name}`
          .trim()
          .replace(/\s+/g, "-") || "resume";
        setSavedResumeDisplayMeta(savedId, {
          filename: currentSavedFilename,
          kind: "original",
        });
        return savedId;
      };

      if (resumeId) {
        try {
          await updateResumeToDatabase(resumeId, payload);
          const currentSavedFilename = `${profile.first_name} ${profile.last_name}`
            .trim()
            .replace(/\s+/g, "-") || "resume";
          setSavedResumeDisplayMeta(resumeId, {
            filename: currentSavedFilename,
            kind: "original",
          });
          setStatus("Resume updated in your account.");
        } catch (updateError) {
          // sessionStorage can outlive a saved resume (for example after a
          // logout, deletion, failed earlier save, or switching accounts).
          // The backend reports this case as "issue with updating resume".
          // Recover on the frontend by creating a fresh resume and replacing
          // the stale stored ID instead of leaving the user stuck.
          const message = updateError instanceof Error ? updateError.message : "";
          if (message.toLowerCase().includes("issue with updating resume")) {
            sessionStorage.removeItem(resumeIdStorageKey);
            setResumeID(null);
            await createAndRememberResume();
            setStatus("Resume saved to your account.");
          } else {
            throw updateError;
          }
        }
      } else {
        await createAndRememberResume();
        setStatus("Resume saved to your account. You can open it from Profile → Saved Resumes.");
      }
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save your resume. Please try again.");
      console.error("Error saving resume:", error);
      return false;
    } finally {
      setSavingResume(false);
    }
  };
const hasExportableData = Boolean(
    Object.values(profile).some((value) => value.trim() !== "") || hasResumeContent,
  );
  const importResumeCsv = async (file: File) => {
    try {
      const draft = parseResumeProfileCsv(await file.text(), file.name);
      setProfile(draft.profile);
      setSections(lockProfessionalSummaryFirst(draft.sections));
      setResumeFilename(draft.filename);
      setResumeFile(null);
      setImportedCsvFilename(file.name);
      setResumeDeleted(false);
      setExportedGuestSnapshot(null);
      setOpenSections((current) => ({ ...current, summary: true }));
      setStatus("Resume CSV imported successfully.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load the resume CSV.");
    }
  };
  const exportResumeAsCsv = () => {
    if (!hasExportableData) {
      setStatus("Add resume information before exporting a CSV.");
      return;
    }
    downloadResumeProfileCsv({ profile, sections, filename: resumeFilename });
    setExportedGuestSnapshot(currentResumeSnapshot);
    setStatus("Resume CSV download started.");
  };
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
    setExportedGuestSnapshot(exportSnapshot);
    setStatus("Resume DOCX download started.");
  };
  const exportResumeAsPdf = () => {
    if (!hasExportableData) {
      setStatus("Add resume information before exporting a DOCX or PDF.");
      return;
    }
    setStatus("Choose Save as PDF in the print dialog to download your resume.");
    // The print dialog cannot tell us whether the PDF was actually saved.
    // Record that export was initiated; guests can continue without another confirmation.
    setExportedGuestSnapshot(currentResumeSnapshot);
    const originalTitle = document.title;
    document.title = getSafeFilename(resumeFilename);
    window.print();
    window.setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };
  const handleDelete = async () => {
    try {
    if (resumeId == null) {
    setResumeDeleted(true);
    setShowDeleteDialog(false);
    setStatus("Resume deleted from this workspace.");
    }
    else  {
      await deleteResumeFromDatabase(resumeId)
      sessionStorage.removeItem(resumeIdStorageKey)
      setResumeID(null)
      setResumeDeleted(true);
      setShowDeleteDialog(false);
      setStatus("Resume deleted from this workspace.");
    }
  }
  catch(error) {
    setStatus("Failed to delete resume")
    console.error("Error deleting resume:",error)
  }
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
    setImportedCsvFilename(null);
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
          <div className="resume-editor-header" style={{ marginBottom: "12px" }}>
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
          if (!isGuest) void handleSave();
        }}
      >
        {/* Resume file upload */}
        <div className="resume-upload-row" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div className="resume-filename-field" style={{ flex: "0 1 300px", minWidth: "180px", maxWidth: "100%" }}>
            <label htmlFor="resume-filename">Resume filename</label>
            <input
              id="resume-filename"
              type="text"
              value={resumeFilename}
              onChange={(event) => setResumeFilename(event.target.value)}
              placeholder="Filename for export"
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px", flex: "0 1 auto" }}>
            <div className="resume-upload-file" style={{ marginRight: 0 }}>
              <span className="panel-icon">RESUME FILE</span>
              <span className="resume-upload-file-name">
                {resumeFile?.name ?? importedCsvFilename ?? "No resume selected"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", flexWrap: "wrap" }}>
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
              <label className="button button-primary upload-button" htmlFor="resume-page-upload">
                Upload Resume <span aria-hidden="true">↑</span>
              </label>
              <input
                id="resume-csv-import"
                className="resume-upload-input"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void (onLoadResumeProfile ? onLoadResumeProfile(file) : importResumeCsv(file));
                  event.target.value = "";
                }}
              />
              <label className="button button-primary upload-button" htmlFor="resume-csv-import">
                Import CSV <span aria-hidden="true">↑</span>
              </label>
              <Button type="button" variant="secondary" onClick={handleClearResume}>
                Clear Data
              </Button>
            </div>
          </div>
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
                // Summary is a locked boundary: movable sections may only be
                // dropped on other sections beneath it.
                if (
                  section.key === "summary" ||
                  !draggedSection ||
                  draggedSection === section.key
                ) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTarget(section.key);
              }}
              onDrop={(event) => {
                if (section.key === "summary") return;
                handleSectionDrop(event, section.key);
              }}
              onDragEnd={() => { setDraggedSection(null); setDropTarget(null); }}
            >
              <div className="resume-section-header">
                {(() => {
                  return <button
                    type="button"
                    className="resume-section-main"
                    onClick={() => toggleSection(section.key)}
                    aria-expanded={Boolean(isOpen)}
                    aria-controls={`resume-section-content-${section.key}`}
                  >
                  <span className="resume-section-number">
                    {String(sectionIndex + 1).padStart(2, "0")}
                  </span>
                  <span className="resume-section-heading">
                    <strong>{section.title}{section.key === "summary" && <> <span aria-label="required" style={{ color: "#dc2626" }}>*</span></>}</strong>
                    <small>Resume details</small>
                  </span>
                  <span className={`resume-section-chevron ${isOpen ? "open" : ""}`} aria-hidden="true">⌄</span>
                  </button>;
                })()}
                <span className="resume-section-action">
                  {section.key !== "summary" ? (
                    <button
                      className="remove-button"
                      type="button"
                      onClick={() => removeSection(section.key)}
                    >
                      Remove section
                    </button>
                  ) : (
                    <span
                      className="remove-button"
                      aria-hidden="true"
                      style={{ visibility: "hidden" }}
                    >
                      Remove section
                    </span>
                  )}
                  {section.key !== "summary" && <button
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
                  </button>}
                </span>
              </div>
              {isOpen && (
                <div className="resume-section-content" id={`resume-section-content-${section.key}`}>
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
                            {entryIndex > 0 && (
                              <button
                                className="text-button resume-remove-entry"
                                type="button"
                                onClick={() => removeEntry(section.key, entryIndex)}
                                aria-label={`Remove ${section.title} entry ${entryIndex + 1}`}
                              >Remove entry</button>
                            )}
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
                          {entryIndex > 0 && (
                            <button
                              className="text-button resume-remove-entry"
                              type="button"
                              onClick={() => removeEntry(section.key, entryIndex)}
                              aria-label={`Remove ${section.title} entry ${entryIndex + 1}`}
                            >
                              Remove entry
                            </button>
                          )}
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
          {!isGuest && (
            <Button
              variant="secondary"
              type="button"
              className="resume-preview-save-button"
              disabled={savingResume || !hasResumeContent}
              onClick={() => void handleSave()}
            >
              {savingResume ? "Saving…" : "Save Resume"}
            </Button>
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
        id="resume-local-notice"
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
            {status || (isGuest
              ? "Changes stay local while you continue as a guest."
              : "Use Save Resume above to keep this resume in your account.")}
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
            onClick={async() => {
              const showContinueError = (message: string) => {
                setStatus(message);
                // Keep the user near the Continue button and its validation message.
                requestAnimationFrame(() => {
                  window.scrollTo({
                    top: document.documentElement.scrollHeight,
                    behavior: "smooth",
                  });
                });
              };
              if (!personalInfoComplete) {
                showContinueError("Personal information and professional summary is required to continue.");
                return;
              }
              if (!summaryComplete) {
                showContinueError("Professional summary is required before continuing.");
                return;
              }
              if (!resumeReady) {
                showContinueError("Please create or upload a resume to continue.");
                return;
              }
              if (isGuest && hasResumeContent && !guestExportIsCurrent) {
                setStatus("");
                setShowGuestExportWarning(true);
                return;
              }
              const saved = await handleSave()
              if (!saved) {
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
            <h3 id="guest-export-title">Save and continue?</h3>
            <p id="guest-export-description">
              Your resume will be saved to this guest session. It may not be available if you lose access to the session.
            </p>
            {status && <p role="status" aria-live="polite">{status}</p>}
            <div className="dialog-actions guest-export-dialog-actions">
              <div className="guest-export-navigation">
                <Button variant="secondary" type="button"
                  onClick={() => setShowGuestExportWarning(false)}>
                  Stay on resume
                </Button>
                <Button variant="secondary" type="button" disabled={savingResume} onClick={async() => {
                  const saved = await handleSave();

                  if (!saved) {
                  return;
                  }
                  setShowGuestExportWarning(false);
                  setStatus("");
                  window.location.hash = '#tailor';
                }}>
                  {savingResume ? "Saving…" : "Save and continue"} <span aria-hidden="true">→</span>
                </Button>
              </div>
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
              Download your resume as PDF, DOCX, or CSV.
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
                Save as PDF <span aria-hidden="true">↓</span>
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
              <Button
                variant="primary"
                type="button"
                onClick={() => {
                  setExportMenuOpen(false);
                  exportResumeAsCsv();
                }}
              >
                Save as CSV <span aria-hidden="true">↓</span>
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
