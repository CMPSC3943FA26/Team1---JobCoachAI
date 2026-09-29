import { useEffect, useState } from 'react'
import {
  signIn,
  signUp,
  signInAsGuest,
  supabase,
} from '../lib/supabase'

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
  // Controls login and registration.
  const [isRegistering, setIsRegistering] = useState(false)
  const [accountCreated, setAccountCreated] = useState(false)

  // Form values.
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Authentication error message.
  const [error, setError] = useState('')

  const isPasswordValid =
  password.length >= 8 &&
  !/\s/.test(password)


  // Reset the welcome page when returning home.
  useEffect(() => {
    const resetWelcomeForm = () => {
      setIsRegistering(false)
      setAccountCreated(false)

      setFirstName('')
      setLastName('')
      setEmail('')
      setPassword('')
      setError('')
    }

    window.addEventListener(
      'resetWelcomeForm',
      resetWelcomeForm
    )

    return () => {
      window.removeEventListener(
        'resetWelcomeForm',
        resetWelcomeForm
      )
    }
  }, [])

  // Create a new account.
  const handleRegisterSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    setError('')

    // Prevent weak passwords from being submitted.
    if (!isPasswordValid) {
  setError(
    'Password must be at least 8 characters and cannot contain spaces.'
  )
  return
}

    try {
      const data = await signUp(
        email.trim(),
        password,
        firstName,
        lastName
      )

      console.log('Account created:', data)

      setAccountCreated(true)
      setIsRegistering(false)
      setPassword('')
      setError('')
    } catch (err) {
      console.error('Registration error:', err)

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create your account. Please try again.'
      )
    }
  }

  // Log in to an existing account.
  const handleLoginSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    try {
      setError('')

      const data = await signIn(
        email.trim(),
        password
      )

      console.log('Login successful:', data)

      const loggedInUser = data.user

      const savedFirstName =
        typeof loggedInUser?.user_metadata?.first_name === 'string'
          ? loggedInUser.user_metadata.first_name
          : ''

      const savedLastName =
        typeof loggedInUser?.user_metadata?.last_name === 'string'
          ? loggedInUser.user_metadata.last_name
          : ''

      onLogin(
        savedFirstName || 'User',
        savedLastName
      )
    } catch (err) {
      console.error('Login error:', err)

      setError(
        'Invalid email or password. Please try again.'
      )
    }
  }

  // Continue without creating an account.
  const handleGuestLogin = async () => {
    try {
      setError('')

      const response = await signInAsGuest()

      console.log(
        'Guest sign-in successful:',
        response
      )

      const { data } =
        await supabase.auth.getSession()

      console.log(
        'Session after sign-in:',
        data.session
      )

      onContinueAsGuest()
    } catch (err) {
      console.error(
        'Guest sign-in error:',
        err
      )

      setError(
        'Unable to continue as guest. Please try again.'
      )
    }
  }

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
          Your next resume, tailored to your needs.
          JobCoachAI turns your experience into a
          polished, job-ready resume designed to{' '}
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
          {/* Name fields appear only during registration. */}
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
                    setFirstName(
                      event.target.value
                    )
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
                    setLastName(
                      event.target.value
                    )
                  }
                  required
                />
              </div>
            </>
          )}

          {/* Email */}
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
              onChange={(event) => {
                setEmail(event.target.value)

                if (error) {
                  setError('')
                }
              }}
              required
            />
          </div>

        {/* Password */}
<div className="field-group">
  <label htmlFor="auth-password">
    Password
  </label>

  <div className="password-field">
    <input
      id="auth-password"
      name="password"
      type={showPassword ? 'text' : 'password'}
      placeholder="Enter your password"
      value={password}
      onChange={(event) => {
        setPassword(event.target.value)

        if (error) {
          setError('')
        }
      }}
      autoComplete={
        isRegistering
          ? 'new-password'
          : 'current-password'
      }
      required
    />

    <button
      type="button"
      className="password-eye"
      onClick={() =>
        setShowPassword(current => !current)
      }
      aria-label={
        showPassword
          ? 'Hide password'
          : 'Show password'
      }
      title={
        showPassword
          ? 'Hide password'
          : 'Show password'
      }
    >
      {showPassword ? (
        /* Eye with slash */
        <svg
          viewBox="0 0 24 24"
          width="19"
          height="19"
          aria-hidden="true"
        >
          <path
            d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.7 10.7 0 0112 4c5.5 0 9 5 9 5a16.8 16.8 0 01-3.1 3.6M6.6 6.6C4.3 8.1 3 10 3 10s3.5 5 9 5a10.5 10.5 0 004-.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        /* Eye */
        <svg
          viewBox="0 0 24 24"
          width="19"
          height="19"
          aria-hidden="true"
        >
          <path
            d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <circle
            cx="12"
            cy="12"
            r="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      )}
    </button>
  </div>

            
            
          </div>
        </div>

        {/* Account creation confirmation */}
        {accountCreated && (
          <>
            <p className="success-message">
              Account created! Please check your email
              and click the verification link before
              logging in.
            </p>

            <div className="success-divider" />
          </>
        )}

        {/* Authentication error */}
        {error && (
          <p
            className="field-error"
            role="alert"
          >
            {error}
          </p>
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
          {/* Login */}
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

          {/* Create account */}
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
                  setError('')
                  setPassword('')
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

        {/* Guest access */}
        {!isRegistering && (
          <button
            className="guest-link"
            type="button"
            onClick= {async () => {
              try {
                setError(false)
                const response = await signInAsGuest()
                 console.log("Guest sign-in successful:", response)

                const { data } = await supabase.auth.getSession()
                console.log("Session after sign-in:", data.session)
               } catch (err) {
                  console.error("Guest sign-in error:", err)
                  setError(true)
              }
              setError(false)
              return onContinueAsGuest()
              
            }}
            
          >
            Continue as guest
          </button>
        )}

        <p className="privacy-line">
          By continuing, you agree to our terms and
          privacy policy.
        </p>
      </form>
    </section>
  )
}