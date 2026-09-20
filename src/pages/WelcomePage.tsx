import { useState, type FormEvent } from 'react';

interface WelcomePageProps {
  onContinue: () => void;
}

export default function WelcomePage({ onContinue }: WelcomePageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onContinue();
  }

  return (
    <section className="screen welcome-screen">
      <div className="welcome-header">
        <span className="section-kicker">01 / Welcome</span>
        <h2>
          Welcome to <em>JobCoach AI.</em>
        </h2>
        <p>Make your next application feel like it was made for you.</p>
      </div>

      <form className="auth-panel" onSubmit={handleSubmit}>
        <div className="auth-fields">
          <div className="field-group">
            <label htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
        </div>

        <div className="auth-actions">
          <button className="button button-primary" type="submit">
            Log in <span aria-hidden="true">&rarr;</span>
          </button>
          <button className="button button-secondary" type="button" onClick={onContinue}>
            Register <span aria-hidden="true">&rarr;</span>
          </button>
        </div>

        <button className="guest-link" type="button" onClick={onContinue}>
          Continue as guest
        </button>
        <p className="privacy-line">By continuing, you agree to our terms and privacy policy.</p>
      </form>
    </section>
  );
}
