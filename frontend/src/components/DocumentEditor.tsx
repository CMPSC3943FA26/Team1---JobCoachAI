import { useEffect, useRef, useState } from "react";
import mammoth from "mammoth";

type DocumentEditorProps = {
  file: File;
  onClose: () => void;
  readOnly?: boolean;
};

const isDocx = (file: File) =>
  file.name.toLowerCase().endsWith(".docx") ||
  file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function DocumentEditor({ file, onClose, readOnly = false }: DocumentEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [documentHtml, setDocumentHtml] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDocument() {
      if (!isDocx(file)) {
        setError("Only Microsoft Word .docx files can be opened here. PDF files are not supported.");
        setIsLoading(false);
        return;
      }

      try {
        const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
        if (!cancelled) {
          setDocumentHtml(result.value);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("This Word document could not be opened. Please choose a valid .docx file.");
          setIsLoading(false);
        }
      }
    }

    void loadDocument();
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    if (editorRef.current && documentHtml) {
      editorRef.current.innerHTML = documentHtml;
    }
  }, [documentHtml]);

  const runCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setIsDirty(true);
  };

  const replaceAll = () => {
    if (!findText || !editorRef.current) return;
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    editorRef.current.innerHTML = editorRef.current.innerHTML.replace(
      new RegExp(escaped, "gi"),
      replaceText,
    );
    setIsDirty(true);
  };

  const downloadDocument = () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${file.name}</title></head><body>${editorRef.current?.innerHTML ?? ""}</body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${file.name.replace(/\.docx?$/i, "")}-edited.doc`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <section className="document-editor-window" aria-label="Word document editor">
      <header className="document-editor-titlebar">
        <button className="document-editor-close" type="button" onClick={onClose} aria-label="Close document editor">
          Close
        </button>
      </header>

      {isLoading ? (
        <p className="document-editor-message">Opening your Word document...</p>
      ) : error ? (
        <div className="document-editor-message document-editor-error" role="alert">
          {error}
          <button className="button button-secondary" type="button" onClick={onClose}>Choose another file</button>
        </div>
      ) : (
        <>
          {readOnly ? (
            <p className="document-editor-preview-label">Preview only. Editing is disabled for uploaded documents.</p>
          ) : (
            <>
          <div className="document-editor-toolbar" role="toolbar" aria-label="Document formatting tools">
            <button type="button" onClick={() => runCommand("undo")} title="Undo">Undo</button>
            <button type="button" onClick={() => runCommand("redo")} title="Redo">Redo</button>
            <label>
              Font size
              <select defaultValue="3" onChange={(event) => runCommand("fontSize", event.target.value)}>
                <option value="2">Small</option>
                <option value="3">Normal</option>
                <option value="4">Large</option>
                <option value="5">Heading</option>
              </select>
            </label>
            <button type="button" onClick={() => runCommand("bold")}><strong>B</strong></button>
            <button type="button" onClick={() => runCommand("italic")}><em>I</em></button>
            <button type="button" onClick={() => runCommand("underline")}><u>U</u></button>
            <button type="button" onClick={() => runCommand("strikeThrough")}><s>S</s></button>
            <button type="button" onClick={() => runCommand("justifyLeft")} title="Align left">Left</button>
            <button type="button" onClick={() => runCommand("justifyCenter")} title="Center">Center</button>
            <button type="button" onClick={() => runCommand("justifyRight")} title="Align right">Right</button>
            <button type="button" onClick={() => runCommand("insertUnorderedList")} title="Bulleted list">Bullets</button>
            <button type="button" onClick={() => runCommand("insertOrderedList")} title="Numbered list">Numbering</button>
            <button type="button" onClick={() => {
              const url = window.prompt("Enter a web address");
              if (url) runCommand("createLink", url);
            }}>Link</button>
            <button type="button" onClick={() => runCommand("removeFormat")}>Clear format</button>
            <button type="button" onClick={() => window.print()}>Print</button>
            <button className="button button-primary" type="button" onClick={downloadDocument}>Download Word file</button>
          </div>

          <div className="document-editor-findbar">
            <input value={findText} onChange={(event) => setFindText(event.target.value)} placeholder="Find in document" aria-label="Find in document" />
            <input value={replaceText} onChange={(event) => setReplaceText(event.target.value)} placeholder="Replace with" aria-label="Replace with" />
            <button type="button" onClick={replaceAll}>Replace all</button>
            <span>{isDirty ? "Unsaved local changes" : "Ready"}</span>
          </div>
            </>
          )}

          <div
            ref={editorRef}
            className="document-editor-page"
            contentEditable={!readOnly}
            suppressContentEditableWarning
            onInput={readOnly ? undefined : () => setIsDirty(true)}
            role={readOnly ? "document" : "textbox"}
            aria-label={readOnly ? "Word document preview" : "Editable Word document"}
          />
        </>
      )}
    </section>
  );
}
