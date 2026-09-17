import { useEffect, useState } from 'react'
import { Button } from '../components/Button'

export function WelcomePage() {
  const [isRegistering, setIsRegistering] = useState(false)
  const [accountCreated, setAccountCreated] = useState(false)

  useEffect(() => {
    const resetWelcomeForm = () => {
      setIsRegistering(false)
      setAccountCreated(false)
    }

    window.addEventListener('resetWelcomeForm', resetWelcomeForm)

    return () => {
      window.removeEventListener('resetWelcomeForm', resetWelcomeForm)
    }
  }, [])

  const handleRegisterSubmit = (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault()

  setAccountCreated(true)
  setIsRegistering(false)
  }

  return (
    <section className="screen welcome-screen" data-screen="welcome">
      <div className="welcome-header">
        <span className="section-kicker">01 / Welcome</span>

        <h2>
          Welcome to <em>JobCoach AI.</em>
        </h2>

        <p>
          Your next resume tailored to your needs. JobCoachAI turns your
          experience into a polished, job-ready resume designed to improve your
          chances of landing an interview.
        </p>
      </div>

      <form
        className="auth-panel"
        id="auth-form"
        action="#tailor"
        method="get"
        onSubmit={isRegistering ? handleRegisterSubmit : undefined}
      >
        <div className="auth-fields">
          {isRegistering && (
            <>
              <div className="field-group">
                <label htmlFor="auth-first-name">First Name</label>
                <input
                  id="auth-first-name"
                  name="firstName"
                  type="text"
                  placeholder="First name"
                  required
                />
              </div>

              <div className="field-group">
                <label htmlFor="auth-last-name">Last Name</label>
                <input
                  id="auth-last-name"
                  name="lastName"
                  type="text"
                  placeholder="Last name"
                  required
                />
              </div>
            </>
          )}

          <div className="field-group">
            <label htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              name="email"
              type="email"
              placeholder="Enter your email address"
              required
            />
          </div>

          <div className="field-group">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              name="password"
              type="password"
              placeholder="Enter your password"
              required
            />
          </div>
        </div>

        {accountCreated && (
          <>
          <p className="success-message">
            Account created successfully! Please log in or continue as guest.
          </p>

          <div className="success-divider" />
          </>
        )}

        <div className={`auth-actions ${isRegistering ? 'register-mode' : ''}`}>
          {!isRegistering && (
            <Button variant="primary" type="submit">
              Log in <span aria-hidden="true">→</span>
            </Button>
          )}

          <button
            className={
              isRegistering
                ? 'button button-primary'
                : 'button button-secondary'
            }
            type={isRegistering ? 'submit' : 'button'}
            onClick={() => {
              if (!isRegistering) {
                setIsRegistering(true)
                setAccountCreated(false)
              }
            }}
          >
            Create Account <span aria-hidden="true">→</span>
          </button>
        </div>

        {!isRegistering && (
          <a className="guest-link" href="#tailor">
            Continue as guest
          </a>
        )}

        <p className="privacy-line">
          By continuing, you agree to our terms and privacy policy.
        </p>
      </form>
    </section>
  )
}
