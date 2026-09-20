import { useState } from 'react';
import WelcomePage from './pages/WelcomePage';
import TailorPage, { type ResumeSource, type TailorSubmission } from './pages/TailorPage';
import ParsedPage from './pages/ParsedPage';
import { EMPTY_RESUME, SAMPLE_PARSED_RESUME, type ResumeData } from './types';

type Screen = 'welcome' | 'tailor' | 'parsed';

const STEPS: { key: Screen; number: string; title: string; caption: string }[] = [
  { key: 'welcome', number: '01', title: 'Welcome', caption: 'Get started' },
  { key: 'tailor', number: '02', title: 'Tailor', caption: 'Add a job' },
  { key: 'parsed', number: '03', title: 'Your fit', caption: 'See your match' },
];

export default function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [resume, setResume] = useState<ResumeData>(EMPTY_RESUME);
  const [fromUpload, setFromUpload] = useState(false);
  const [hasSavedResume, setHasSavedResume] = useState(false);

  /* Create Resume / Edit Resume on the tailor page. */
  function handleOpenResume(source: ResumeSource) {
    setFromUpload(source === 'uploaded');
    setResume(source === 'uploaded' ? SAMPLE_PARSED_RESUME : EMPTY_RESUME);
    setScreen('parsed');
  }

  function handleSubmit(submission: TailorSubmission) {
    console.log('Submitted:', submission);
    setScreen('parsed');
  }

  function handleSaveResume(saved: ResumeData) {
    setResume(saved);
    setHasSavedResume(true);
    setScreen('tailor');
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Workflow navigation">
        <button className="brand" type="button" onClick={() => setScreen('welcome')}>
          <span className="brand-mark">JC</span>
          <span>
            JobCoach <strong>AI</strong>
          </span>
        </button>

        <div className="sidebar-content">
          <p className="eyebrow">Your application copilot</p>
          <h1>
            Move from
            <br />
            <span>maybe</span> to ready.
          </h1>
          <p className="sidebar-copy">Make every application feel like it was made for you.</p>
        </div>

        <nav className="stepper" aria-label="Application steps">
          {STEPS.map((step) => (
            <button
              className={step.key === screen ? 'step active' : 'step'}
              type="button"
              key={step.key}
              onClick={() => setScreen(step.key)}
            >
              <span className="step-number">{step.number}</span>
              <span>
                <strong>{step.title}</strong>
                <small>{step.caption}</small>
              </span>
            </button>
          ))}
        </nav>

        <p className="sidebar-footer">
          Built for the next chapter <span aria-hidden="true">&rarr;</span>
        </p>
      </aside>

      <section className="content" aria-live="polite">
        <div className="topbar">
          <span className="topbar-label">Job application workspace</span>
          <span className="secure-note">
            <span className="status-dot"></span> Your data stays yours
          </span>
        </div>

        {screen === 'welcome' && <WelcomePage onContinue={() => setScreen('tailor')} />}

        {/* Kept mounted so the uploaded file and job details survive navigation. */}
        <div hidden={screen !== 'tailor'}>
          <TailorPage
            onOpenResume={handleOpenResume}
            onSubmit={handleSubmit}
            onBack={() => setScreen('welcome')}
            hasSavedResume={hasSavedResume}
          />
        </div>

        {screen === 'parsed' && (
          <ParsedPage
            resume={resume}
            fromUpload={fromUpload}
            onSave={handleSaveResume}
            onBack={() => setScreen('tailor')}
          />
        )}
      </section>
    </main>
  );
}
