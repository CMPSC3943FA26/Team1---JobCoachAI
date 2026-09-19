import { useEffect, useState } from 'react'
import { signInAsGuest } from '../lib/supabase'

type WelcomePageProps = {
  onContinueAsGuest: () => void
  onLogin: (
    firstName: string,
    lastName: string
  ) => void
}

export function WelcomePage({
  onContinueAsGuest,
  onLogin,
}: WelcomePageProps) {
  const [isRegistering, setIsRegistering] = useState(false)
  const [accountCreated, setAccountCreated] = useState(false)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    const resetWelcomeForm = () => {
      setIsRegistering(false)
      setAccountCreated(false)

      setFirstName('')
      setLastName('')
      setEmail('')
      setPassword('')
    }

    window.addEventListener('resetWelcomeForm', resetWelcomeForm)

    return () => {
      window.removeEventListener('resetWelcomeForm', resetWelcomeForm)
    }
  }, [])

  const handleRegisterSubmit = (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    setAccountCreated(true)
    setIsRegistering(false)
  }

  const handleLoginSubmit = (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    onLogin(
      firstName || 'User',
      lastName || ''
    )
  }
  const [error,setError] = useState(false)
  

  return (
    <section
      className="screen welcome-screen"
      data-screen="welcome"
    >
      <div className="welcome-header">
        <span className="section-kicker">
          01 / Welcome
        </span>

        <h2>
          Welcome to <em>JobCoachAI</em>
        </h2>

        <p>
          Your next resume, tailored to your needs. JobCoachAI turns your experience
          into a polished, job-ready resume designed to{' '}
          improve your chances of landing an interview.
        </p>
      </div>

      <form
        className="auth-panel"
        id="auth-form"
        onSubmit={
          isRegistering
            ? handleRegisterSubmit
            : handleLoginSubmit
        }
      >
        <div className="auth-fields">
          {isRegistering && (
            <>
              <div className="field-group">
                <label htmlFor="auth-first-name">
                  First Name
                </label>

                <input
                  id="auth-first-name"
                  name="firstName"
                  type="text"
                  placeholder="First name"
                  value={firstName}
                  onChange={(event) =>
                    setFirstName(event.target.value)
                  }
                  required
                />
              </div>

              <div className="field-group">
                <label htmlFor="auth-last-name">
                  Last Name
                </label>

                <input
                  id="auth-last-name"
                  name="lastName"
                  type="text"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(event) =>
                    setLastName(event.target.value)
                  }
                  required
                />
              </div>
            </>
          )}

          <div className="field-group">
            <label htmlFor="auth-email">
              Email address
            </label>

            <input
              id="auth-email"
              name="email"
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              required
            />
          </div>

          <div className="field-group">
            <label htmlFor="auth-password">
              Password
            </label>

            <input
              id="auth-password"
              name="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
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

        <div
          className={`auth-actions ${
            isRegistering
              ? 'register-mode'
              : accountCreated
              ? 'login-only'
              : ''
          }`}
        >
          {!isRegistering && (
            <button
              className="button button-primary"
              type="submit"
            >
              Log in
              <span aria-hidden="true">
                →
              </span>
            </button>
          )}

          {!accountCreated && (
            <button
              className={
                isRegistering
                  ? 'button button-primary'
                  : 'button button-secondary'
              }
              type={
                isRegistering
                  ? 'submit'
                  : 'button'
              }
              onClick={() => {
                if (!isRegistering) {
                  setIsRegistering(true)
                  setAccountCreated(false)
                }
              }}
            >
              Create Account
              <span aria-hidden="true">
                →
              </span>
            </button>
          )}
        </div>
        
        
        {!isRegistering && (
          <button
            className="guest-link"
            type="button"
            onClick= {async () => {
              try {
                setError(false)
                await signInAsGuest()
              }
              catch(err) {setError(true); return err}
              setError(false)
              return onContinueAsGuest()
              
            }}
            
          >
            Continue as guest
          </button>
        )}
        {error && (<div>error signing in, try again later</div>)}
        <p className="privacy-line">
          By continuing, you agree to our terms and privacy policy.
        </p>
      </form>
    </section>
  )
}