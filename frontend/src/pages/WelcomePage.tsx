import { useState } from "react";
import { Button } from "../components/Button";

export function WelcomePage() {
  const [selectedAction, setSelectedAction] = useState<
    "login" | "create" | null
  >(null);

  return (
    <section className="screen welcome-screen" data-screen="welcome">
      <div className="welcome-hero">
        <div className="welcome-logo" aria-label="JobCoachAI logo">
          <span className="welcome-logo-mark">JC</span>
          <span>
            JobCoach <strong>AI</strong>
          </span>
        </div>

        <span className="section-kicker">01 / Welcome</span>
        <h2>
          Your next move,
          <br />
          <em>made clearer.</em>
        </h2>
        <p>
          JobCoachAI helps you turn your experience into a focused, confident
          application for the roles you want.
        </p>
      </div>

      <div className="auth-panel welcome-actions-panel">
        <div className="auth-panel-heading">
          <div>
            <span className="panel-icon">START HERE</span>
            <h3>Choose how you’d like to begin</h3>
          </div>
          <span className="auth-step">1 of 3</span>
        </div>

        <div className="welcome-actions">
          <Button
            variant="primary"
            type="button"
            onClick={() => setSelectedAction("login")}
          >
            Log in <span aria-hidden="true">→</span>
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={() => setSelectedAction("create")}
          >
            Create account <span aria-hidden="true">→</span>
          </Button>
        </div>

        <a className="guest-option" href="#tailor">
          <span>
            <strong>Continue as guest</strong>
            <small>Explore the workspace without signing in</small>
          </span>
          <span aria-hidden="true">↗️</span>
        </a>

        {selectedAction && (
          <p className="auth-feedback" role="status">
            {selectedAction === "login"
              ? "Login will be connected here soon. Continue as a guest to explore the workspace."
              : "Account creation will be connected here soon. Continue as a guest to explore the workspace."}
          </p>
        )}

        <p className="privacy-line">
          Your workspace stays private. Authentication can be connected when
          you’re ready.
        </p>
      </div>
    </section>
  );
}