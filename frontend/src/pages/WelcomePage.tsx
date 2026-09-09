// WelcomePage.tsx
// Screen 01: Welcome / login flow.
// This matches the first section of the original mockup and keeps the auth flow isolated.
// The page is intentionally a simple entry screen with email/password controls and
// a guest path, because the visual focus is on the initial brand and entry actions.

import { Button } from '../components/Button'

export function WelcomePage() {
  return (
    <section className="screen welcome-screen" data-screen="welcome">
      <div className="welcome-header">
        <span className="section-kicker">01 / Welcome</span>
        <h2>
          Welcome to <em>JobCoach AI.</em>
        </h2>
        <p>Make your next application feel like it was made for you.</p>
      </div>

      <form className="auth-panel" id="auth-form" action="#tailor" method="get">
        <div className="auth-fields">
          <div className="field-group">
            <label htmlFor="auth-email">Email address</label>
            <input id="auth-email" name="email" type="email" placeholder="you@example.com" required />
          </div>

          <div className="field-group">
            <label htmlFor="auth-password">Password</label>
            <input id="auth-password" name="password" type="password" placeholder="Enter your password" required />
          </div>
        </div>

        <div className="auth-actions">
          <Button variant="primary" type="submit">
            Log in <span aria-hidden="true">→</span>
          </Button>
          <a className="button button-secondary" href="#tailor">
            Register <span aria-hidden="true">→</span>
          </a>
        </div>

        <a className="guest-link" href="#tailor">
          Continue as guest
        </a>

        <p className="privacy-line">By continuing, you agree to our terms and privacy policy.</p>
      </form>
    </section>
  )
}
