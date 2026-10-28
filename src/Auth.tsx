
import { useState, type FormEvent } from "react";
import { supabase } from "./supabase";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) setError(error.message);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-decoration auth-decoration-one" />
      <div className="auth-decoration auth-decoration-two" />

      <section className="auth-layout">
        <div className="auth-welcome">
          <a className="auth-brand" href="/" aria-label="together home">
            <span className="auth-brand-icon">♡</span>
            <span>together<span className="auth-brand-dot">.</span></span>
          </a>

          <div className="auth-illustration" aria-hidden="true">
            <span className="auth-sparkle sparkle-one">✦</span>
            <span className="auth-sparkle sparkle-two">✧</span>
            <div className="auth-orbit">
              <span className="auth-orbit-heart">♡</span>
              <span className="auth-avatar avatar-one">🐻</span>
              <span className="auth-avatar avatar-two">🐰</span>
            </div>
            <span className="auth-floating-heart">♥</span>
          </div>

          <p className="auth-eyebrow">A LITTLE LIFE, BUILT TOGETHER</p>
          <h1>Money feels better<br />when we're <span>together.</span></h1>
          <p className="auth-welcome-text">
            Your shared goals, little everyday wins, and personal finances —
            all in one lovely place.
          </p>

          <div className="auth-note">
            <span>♡</span>
            <p>Small steps today. A beautiful life tomorrow.</p>
          </div>
        </div>

        <div className="auth-form-side">
          <form className="auth-card" onSubmit={handleSignIn}>
            <div className="auth-mobile-brand">
              <span className="auth-brand-icon">♡</span>
              <span>together<span className="auth-brand-dot">.</span></span>
            </div>

            <div className="auth-card-heading">
              <span className="auth-mini-label">YOUR LITTLE CORNER</span>
              <h2>Welcome back <span>♡</span></h2>
              <p>We saved you a little space. Come on in.</p>
            </div>

            <div className="auth-fields">
              <div className="auth-field">
                <label htmlFor="auth-email">Email address</label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="auth-field">
                <label htmlFor="auth-password">Password</label>
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {error && (
              <p className="auth-error" role="alert">{error}</p>
            )}

            <button className="auth-submit" type="submit" disabled={loading}>
              <span>{loading ? "Signing you in..." : "Let's come in"}</span>
              {!loading && <span aria-hidden="true">♡</span>}
            </button>

            <p className="auth-security">
              <span>♡</span> Your finances are personal. Your data stays protected.
            </p>
          </form>

          <p className="auth-footer">
            MADE WITH A LITTLE LOVE <span>♥</span> FOR YOUR LIFE TOGETHER
          </p>
        </div>
      </section>
    </main>
  );
}
