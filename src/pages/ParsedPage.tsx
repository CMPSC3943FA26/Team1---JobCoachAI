import { useEffect, useRef, useState } from 'react';
import type { ResumeData } from '../types';

interface ParsedPageProps {
  resume: ResumeData;
  /** True when the resume came from an uploaded file rather than from scratch. */
  fromUpload: boolean;
  onSave: (resume: ResumeData) => void;
  onBack: () => void;
}

type Collection = 'summary' | 'experience' | 'skills';

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character,
  );
}

export default function ParsedPage({ resume, fromUpload, onSave, onBack }: ParsedPageProps) {
  const [draft, setDraft] = useState<ResumeData>(resume);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [showPageWarning, setShowPageWarning] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  /* Reload the fields whenever the tailor page hands over a different resume. */
  useEffect(() => {
    setDraft(resume);
    setIsEditorOpen(false);
  }, [resume]);

  function updateField(field: 'firstName' | 'lastName' | 'phone' | 'email', value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateItem(collection: Collection, index: number, value: string) {
    setDraft((current) => ({
      ...current,
      [collection]: current[collection].map((item, position) => (position === index ? value : item)),
    }));
  }

  function addItem(collection: Collection) {
    setDraft((current) => ({ ...current, [collection]: [...current[collection], ''] }));
  }

  function removeItem(collection: Collection, index: number) {
    setDraft((current) => ({
      ...current,
      [collection]: current[collection].filter((_, position) => position !== index),
    }));
  }

  function buildEditorHtml(): string {
    const fullName = `${draft.firstName} ${draft.lastName}`.trim() || 'Your Name';
    const contact = [draft.email, draft.phone].filter(Boolean).join(' &middot; ');
    const summary = draft.summary.filter((item) => item.trim());
    const experience = draft.experience.filter((item) => item.trim());
    const skills = draft.skills.filter((item) => item.trim());

    return [
      `<h1>${escapeHtml(fullName)}</h1>`,
      `<p class="editor-contact">${escapeHtml(contact) || 'Add your contact information'}</p>`,
      '<h2>Professional Summary</h2>',
      summary.map((item) => `<p>${escapeHtml(item)}</p>`).join('') ||
        '<p>Add your professional summary.</p>',
      '<h2>Experience</h2>',
      experience.map((item) => `<p>${escapeHtml(item).replace(/\n/g, '<br>')}</p>`).join('') ||
        '<p>Add your experience.</p>',
      '<h2>Skills</h2>',
      `<p>${escapeHtml(skills.join(' / ')) || 'Add your skills.'}</p>`,
    ].join('');
  }

  function openEditor(importFields: boolean) {
    if (importFields && editorRef.current) {
      editorRef.current.innerHTML = buildEditorHtml();
    }
    setIsEditorOpen(true);
  }

  function checkLength() {
    const fieldText = [
      draft.firstName,
      draft.lastName,
      draft.phone,
      draft.email,
      ...draft.summary,
      ...draft.experience,
      ...draft.skills,
    ].join('');
    const editorText = editorRef.current?.textContent ?? '';
    setShowPageWarning(`${fieldText}${editorText}`.replace(/\s/g, '').length >= 1200);
  }

  useEffect(checkLength, [draft]);

  function exportDocx() {
    const html = `<html><body>${editorRef.current?.innerHTML ?? buildEditorHtml()}</body></html>`;
    const file = new Blob([html], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = 'jobcoach-resume.docx';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const collections: { key: Collection; index: string; title: string; addLabel: string }[] = [
    { key: 'summary', index: '01', title: 'Professional summary', addLabel: '+ Add summary' },
    { key: 'experience', index: '02', title: 'Experience', addLabel: '+ Add experience' },
    { key: 'skills', index: '03', title: 'Skills', addLabel: '+ Add skill' },
  ];

  return (
    <section className="screen">
      <div className="parsed-header">
        <div className="screen-intro">
          <span className="section-kicker">03 / Your fit</span>
          <h2>
            Your resume,
            <br />
            <em>in focus.</em>
          </h2>
          <p>
            {fromUpload
              ? 'Review the parsed details below and adjust anything that came through wrong.'
              : 'Fill in the details below to build your resume from scratch.'}
          </p>
        </div>
        <div className="match-score">
          <span>Role match</span>
          <strong>
            84<span>%</span>
          </strong>
          <small>Strong foundation</small>
        </div>
      </div>

      <div className="parsed-toolbar">
        <div className="edit-actions">
          <button
            className="button button-secondary"
            type="button"
            disabled={!fromUpload}
            onClick={() => openEditor(false)}
          >
            Edit uploaded resume <span aria-hidden="true">&nearr;</span>
          </button>
          <button className="button button-primary" type="button" onClick={() => openEditor(true)}>
            {isEditorOpen ? 'Save changes' : 'Edit parsed resume'} <span aria-hidden="true">&nearr;</span>
          </button>
        </div>
        <div className="export-actions">
          <button className="text-button" type="button" onClick={exportDocx}>
            Export DOCX
          </button>
          <button className="text-button" type="button" onClick={() => window.print()}>
            Export PDF
          </button>
        </div>
      </div>

      {showPageWarning && (
        <p className="page-warning">
          Some content may exceed one page. Shorten the resume before exporting.
        </p>
      )}

      <form
        className="parsed-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
        <section className="resume-section user-info-section">
          <div className="collection-header">
            <div>
              <span className="card-index">00</span>
              <h3>User information</h3>
            </div>
            <span className="field-hint">Shown at the top of your resume</span>
          </div>
          <div className="user-info-grid">
            <div className="field-group">
              <label htmlFor="first-name">First name</label>
              <input
                id="first-name"
                type="text"
                placeholder="First name"
                value={draft.firstName}
                onChange={(event) => updateField('firstName', event.target.value)}
              />
            </div>
            <div className="field-group">
              <label htmlFor="last-name">Last name</label>
              <input
                id="last-name"
                type="text"
                placeholder="Last name"
                value={draft.lastName}
                onChange={(event) => updateField('lastName', event.target.value)}
              />
            </div>
            <div className="field-group">
              <label htmlFor="phone">Phone</label>
              <input
                id="phone"
                type="tel"
                placeholder="(555) 555-5555"
                value={draft.phone}
                onChange={(event) => updateField('phone', event.target.value)}
              />
            </div>
            <div className="field-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={draft.email}
                onChange={(event) => updateField('email', event.target.value)}
              />
            </div>
          </div>
        </section>

        {collections.map(({ key, index, title, addLabel }) => (
          <section className="resume-section" key={key}>
            <div className="collection-header">
              <div>
                <span className="card-index">{index}</span>
                <h3>{title}</h3>
              </div>
              <button className="add-button" type="button" onClick={() => addItem(key)}>
                {addLabel}
              </button>
            </div>
            <div className="collection-list">
              {draft[key].map((item, position) => (
                <div className="editable-row" key={`${key}-${position}`}>
                  {key === 'skills' ? (
                    <input
                      type="text"
                      placeholder="e.g. Figma, UX research, prototyping"
                      value={item}
                      onChange={(event) => updateItem(key, position, event.target.value)}
                    />
                  ) : (
                    <textarea
                      rows={4}
                      placeholder={
                        key === 'summary'
                          ? 'Add a professional summary...'
                          : 'Role, company, dates, and key accomplishments...'
                      }
                      value={item}
                      onChange={(event) => updateItem(key, position, event.target.value)}
                    />
                  )}
                  <button
                    className="remove-button"
                    type="button"
                    onClick={() => removeItem(key, position)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            {key === 'skills' && <p className="field-hint manual-hint">Add each skill as its own field.</p>}
          </section>
        ))}
      </form>

      {isEditorOpen && (
        <section className="document-editor">
          <div className="editor-header">
            <div>
              <span className="card-index">04</span>
              <h3>Full resume editor</h3>
            </div>
            <span className="field-hint">Guest document workspace</span>
          </div>
          <div
            className="editor-paper editing"
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label="Full resume editor"
            onInput={checkLength}
          />
        </section>
      )}

      <div className="parsed-footer">
        <button className="text-button" type="button" onClick={onBack}>
          <span aria-hidden="true">&larr;</span> Change role
        </button>
        <button className="button button-primary" type="button" onClick={() => onSave(draft)}>
          Save resume details <span aria-hidden="true">&rarr;</span>
        </button>
      </div>
    </section>
  );
}
