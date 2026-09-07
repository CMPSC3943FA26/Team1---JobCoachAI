const screens = [...document.querySelectorAll('[data-screen]')];
const steps = [...document.querySelectorAll('[data-step]')];
const jobForm = document.querySelector('#job-form');
const authForm = document.querySelector('#auth-form');
const parsedForm = document.querySelector('#parsed-form');
const resumeUpload = document.querySelector('#resume-upload');
const fileName = document.querySelector('#file-name');
const createResumeButton = document.querySelector('#create-resume-button');
const editUploadedButton = document.querySelector('#edit-uploaded-button');
const editParsedButton = document.querySelector('#edit-parsed-button');
const resumeEditor = document.querySelector('#resume-editor');
const documentEditor = document.querySelector('#document-editor');
const pageWarning = document.querySelector('#page-warning');
const exportDocxButton = document.querySelector('#export-docx-button');
const exportPdfButton = document.querySelector('#export-pdf-button');

const fieldTemplates = {
  summary: '<textarea name="summary[]" rows="4" placeholder="Add a professional summary..."></textarea>',
  experience: '<textarea name="experience[]" rows="4" placeholder="Role, company, dates, and key accomplishments..."></textarea>',
  skills: '<input name="skills[]" type="text" placeholder="Add a skill">'
};

function getScreenName() {
  const requested = window.location.hash.replace('#', '');
  return screens.some((screen) => screen.dataset.screen === requested) ? requested : 'welcome';
}

function showScreen(name) {
  screens.forEach((screen) => {
    screen.hidden = screen.dataset.screen !== name;
  });
  steps.forEach((step) => {
    step.classList.toggle('active', step.dataset.step === name);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

jobForm.addEventListener('submit', (event) => {
  event.preventDefault();
  window.location.hash = 'parsed';
});

createResumeButton.addEventListener('click', () => {
  window.location.hash = 'parsed';
});

resumeUpload.addEventListener('change', () => {
  fileName.textContent = resumeUpload.files[0]?.name || 'No resume selected';
  editUploadedButton.disabled = !resumeUpload.files.length;
});

parsedForm.addEventListener('submit', (event) => {
  event.preventDefault();
  window.location.hash = 'tailor';
});

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

function importParsedFields() {
  const firstName = document.querySelector('#first-name').value;
  const lastName = document.querySelector('#last-name').value;
  const phone = document.querySelector('#phone').value;
  const email = document.querySelector('#email').value;
  const summary = [...document.querySelectorAll('[name="summary[]"]')].map((field) => field.value.trim()).filter(Boolean);
  const experience = [...document.querySelectorAll('[name="experience[]"]')].map((field) => field.value.trim()).filter(Boolean);
  const skills = [...document.querySelectorAll('[name="skills[]"]')].map((field) => field.value.trim()).filter(Boolean);
  const fullName = `${firstName} ${lastName}`.trim() || 'Your Name';
  const contact = [email, phone].filter(Boolean).join(' &middot; ');

  resumeEditor.innerHTML = `<h1>${escapeHtml(fullName)}</h1><p class="editor-contact">${escapeHtml(contact || 'Add your contact information')}</p><h2>Professional Summary</h2>${summary.map((item) => `<p>${escapeHtml(item)}</p>`).join('') || '<p>Add your professional summary.</p>'}<h2>Experience</h2>${experience.map((item) => `<p>${escapeHtml(item).replace(/\n/g, '<br>')}</p>`).join('') || '<p>Add your experience.</p>'}<h2>Skills</h2><p>${escapeHtml(skills.join(' &middot; ') || 'Add your skills.')}</p>`;
}

function openResumeEditor(importFields) {
  if (importFields) {
    importParsedFields();
  }
  documentEditor.hidden = false;
  resumeEditor.setAttribute('contenteditable', 'true');
  editParsedButton.textContent = 'Save changes ↗';
  editUploadedButton.textContent = 'Edit uploaded resume ↗';
  resumeEditor.classList.add('editing');
  updatePageWarning();
}

function updatePageWarning() {
  const contentLength = `${parsedForm.textContent}${resumeEditor.textContent}`.replace(/\s/g, '').length;
  pageWarning.hidden = contentLength < 1200;
}

editParsedButton.addEventListener('click', () => openResumeEditor(true));
editUploadedButton.addEventListener('click', () => openResumeEditor(false));

resumeEditor.addEventListener('input', updatePageWarning);
parsedForm.addEventListener('input', updatePageWarning);
document.addEventListener('input', updatePageWarning, true);

exportDocxButton.addEventListener('click', () => {
  const documentHtml = `<html><body>${resumeEditor.innerHTML}</body></html>`;
  const file = new Blob([documentHtml], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = 'jobcoach-resume.docx';
  link.click();
  URL.revokeObjectURL(link.href);
});

exportPdfButton.addEventListener('click', () => {
  updatePageWarning();
  window.print();
});

parsedForm.addEventListener('click', (event) => {
  const addButton = event.target.closest('[data-add]');
  const removeButton = event.target.closest('[data-remove]');

  if (addButton) {
    const collection = addButton.dataset.add;
    const list = document.querySelector(`#${collection}-fields`);
    const row = document.createElement('div');
    row.className = 'editable-row';
    row.innerHTML = `${fieldTemplates[collection]}<button class="remove-button" type="button" data-remove aria-label="Remove ${collection}">Remove</button>`;
    list.append(row);
    row.querySelector('textarea, input').focus();
  }

  if (removeButton) {
    removeButton.closest('.editable-row').remove();
  }
});

authForm.addEventListener('submit', (event) => {
  event.preventDefault();
  window.location.hash = 'tailor';
});

window.addEventListener('hashchange', () => showScreen(getScreenName()));
showScreen(getScreenName());
