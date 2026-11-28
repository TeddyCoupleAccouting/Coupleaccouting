import { useState, type FormEvent } from "react";
import { supabase } from "./supabase";

type AuthMode = "login" | "signup" | "forgot" | "update-password";

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>(() =>
    window.location.hash.includes("type=recovery") ? "update-password" : "login"
  );
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
    setError("");
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (mode === "update-password") {
      if (password.length < 6) {
        setError("Please use a password with at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Your passwords don't match. Please try again.");
        return;
      }
      setLoading(true);
      const { error: updateError } = await supabase.auth.updateUser({ password });
      setLoading(false);
      if (updateError) {
        setError(updateError.message);
      } else {
        window.history.replaceState({}, document.title, window.location.pathname);
        await supabase.auth.signOut();
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        setMessage("Your password has been updated. Please log in with your new password. ♡");
      }
      return;
    }

    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (mode === "forgot") {
      setLoading(true);
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        { redirectTo: `${window.location.origin}/` }
      );
      setLoading(false);

      if (resetError) {
        setError(resetError.message);
      } else {
        setMessage("Password reset link sent! Please check your inbox. ♡");
      }
      return;
    }

    if (mode === "signup") {
      if (!displayName.trim()) {
        setError("Please enter your name.");
        return;
      }
      if (password.length < 6) {
        setError("Please use a password with at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Your passwords don't match. Please try again.");
        return;
      }
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    if (mode === "login") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      setLoading(false);
      if (signInError) setError(signInError.message);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { display_name: displayName.trim() },
        emailRedirectTo: "https://coupleaccounting.vercel.app/",
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
    } else if (data.session) {
      setMessage("Your account is ready. Welcome to together! ♡");
    } else {
      setMessage("Your account has been created. Please check your email to confirm your address before logging in. ♡");
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    setMessage("");
    setLoading(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (oauthError) {
      setLoading(false);
      setError(oauthError.message);
    }
  }

  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";
  const isUpdatingPassword = mode === "update-password";

  return (
    <main className="auth-screen">
      <span className="auth-decoration auth-decoration-one" aria-hidden="true" />
      <span className="auth-decoration auth-decoration-two" aria-hidden="true" />

      <div className="auth-layout">
        <section className="auth-welcome">
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
          <h1>
            Money feels better<br />
            when we're <span>together.</span>
          </h1>
          <p className="auth-welcome-text">
            Your shared goals, little everyday wins, and personal finances — all in one lovely place.
          </p>
          <div className="auth-note">
            <span>♡</span>
            <p>Small steps today. A beautiful life tomorrow.</p>
          </div>
        </section>

        <section className="auth-form-side">
          <div className="auth-card">
            <a className="auth-mobile-brand" href="/" aria-label="together home">
              <span className="auth-brand-icon">♡</span>
              <span>together<span className="auth-brand-dot">.</span></span>
            </a>

            {!isForgot && !isUpdatingPassword && (
              <div className="auth-tabs" role="tablist" aria-label="Account access">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "login"}
                  className={mode === "login" ? "active" : ""}
                  onClick={() => changeMode("login")}
                >
                  Log In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "signup"}
                  className={mode === "signup" ? "active" : ""}
                  onClick={() => changeMode("signup")}
                >
                  Sign Up
                </button>
              </div>
            )}

            <div className="auth-card-heading">
              <span className="auth-mini-label">
                {isForgot ? "A LITTLE RESET" : isUpdatingPassword ? "ONE LAST STEP" : "YOUR LITTLE CORNER"}
              </span>
              <h2>
                {isForgot ? "Let's get you back" : isUpdatingPassword ? "Choose a new password" : isSignup ? "Create your account" : "Welcome back"}
                <span> {isForgot ? "♡" : "♡"}</span>
              </h2>
              <p>
                {isForgot
                  ? "We'll send you a link to reset your password."
                  : isUpdatingPassword
                    ? "Choose a new password for your together account."
                    : isSignup
                    ? "A lovely little space for your life together."
                    : "We saved you a little space. Come on in."}
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="auth-fields">
                {isSignup && (
                  <div className="auth-field">
                    <label htmlFor="auth-name">Your name</label>
                    <input
                      id="auth-name"
                      type="text"
                      autoComplete="name"
                      placeholder="What should we call you?"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      required
                    />
                  </div>
                )}

                {!isUpdatingPassword && <div className="auth-field">
                  <label htmlFor="auth-email">Email address</label>
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>}

                {!isForgot && (
                  <div className="auth-field">
                    <label htmlFor="auth-password">Password</label>
                    <div className="auth-password-wrap">
                      <input
                        id="auth-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={isSignup ? "new-password" : "current-password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                      />
                      <button
                        className="auth-password-toggle"
                        type="button"
                        onClick={() => setShowPassword((current) => !current)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                )}

                {(isSignup || isUpdatingPassword) && (
                  <div className="auth-field">
                    <label htmlFor="auth-confirm-password">Confirm password</label>
                    <input
                      id="auth-confirm-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Enter your password again"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              {!isSignup && !isForgot && !isUpdatingPassword && (
                <div className="auth-form-options">
                  <span className="auth-form-hint">♡ Your finances are personal. Your data stays protected.</span>
                  <button type="button" className="auth-text-button" onClick={() => changeMode("forgot")}>
                    Forgot password?
                  </button>
                </div>
              )}

              {error && <p className="auth-error" role="alert">{error}</p>}
              {message && <p className="auth-success" role="status">{message}</p>}

              <button className="auth-submit" type="submit" disabled={loading}>
                {loading
                  ? "Please wait..."
                  : isForgot
                    ? "Send reset link ♡"
                    : isUpdatingPassword
                      ? "Update password ♡"
                      : isSignup
                        ? "Create my account ♡"
                        : "Let's come in ♡"}
              </button>
            </form>

            {!isForgot && !isUpdatingPassword && (
              <>
                <div className="auth-divider"><span>or</span></div>
                <button
                  className="auth-google-button"
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  <span className="auth-google-mark">G</span>
                  Continue with Google
                </button>
              </>
            )}

            {!isUpdatingPassword && <p className="auth-switch-copy">
              {isForgot ? (
                <>Remembered your password? <button type="button" onClick={() => changeMode("login")}>Log in</button></>
              ) : isSignup ? (
                <>Already have an account? <button type="button" onClick={() => changeMode("login")}>Log in</button></>
              ) : (
                <>Don't have an account? <button type="button" onClick={() => changeMode("signup")}>Sign up</button></>
              )}
            </p>}
          </div>

          <p className="auth-footer">MADE WITH A LITTLE LOVE <span>♥</span> FOR YOUR LIFE TOGETHER</p>
        </section>
      </div>
    </main>
  );
}