import { useEffect, useState } from 'react'
import './TailoringLoading.css'

export type TailoringLoadingStage = 'analysis' | 'suggestions'

export function TailoringLoading({ stage }: { stage: TailoringLoadingStage }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const started = Date.now()
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const status = stage === 'suggestions'
    ? 'ATS analysis is complete. Generating resume suggestions now; this separate AI step can take a couple of minutes.'
    : elapsed < 15
      ? 'Your resume and job details have been submitted for analysis.'
      : elapsed < 60
        ? 'Waiting for your personalized recommendations. The analysis uses three AI steps.'
        : 'Still waiting for the AI response. Detailed resume analysis can take a few minutes.'
  return (
    <section
      className="tailoring-loading"
      aria-label={stage === 'suggestions' ? 'Generating resume suggestions' : 'Resume tailoring in progress'}
      aria-busy="true"
    >
      <span className="panel-icon">AI TAILORING</span>
      <h3>{stage === 'suggestions' ? 'Generating resume suggestions' : 'Preparing your recommendations'}</h3>
      <p role="status" aria-live="polite" aria-atomic="true">{status}</p>
      <div
        className="tailoring-loading-bar"
        role="progressbar"
        aria-label={stage === 'suggestions' ? 'Generating resume suggestions' : 'Waiting for resume analysis'}
      >
        <span />
      </div>
      <div className="tailoring-loading-footer">
        <span>
          {stage === 'suggestions'
            ? 'ATS analysis complete · Resume suggestions in progress'
            : 'Job requirements · Resume evidence · Suggested changes'}
        </span>
        <span aria-live="off"> {Math.floor((300 - (elapsed % 300)) / 60)}:{String((300 - (elapsed % 300)) % 60).padStart(2, '0')} remaining </span>
      </div>
      <p className="tailoring-loading-note">Keep this page open. Your recommendations will appear when the analysis finishes.</p>
    </section>
  )
}
