import { useState, type FormEvent } from "react";
import { API_URL } from "./api";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (response.status === 401) {
        setError("Invalid email or password.");
        return;
      }

      if (!response.ok) {
        let message = "Unable to sign in. Please try again.";
        try {
          const result = await response.json();
          if (result.message) message = result.message;
        } catch {
          // Keep the generic response when the backend did not return JSON.
        }
        setError(message);
        return;
      }

      window.location.assign("/manufacturer");
    } catch {
      setError("Unable to connect to the ChainRecall backend. Check that it is running and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="manufacturer-login-page">
      <header className="manufacturer-login-header">
        <a className="manufacturer-login-brand" href="/" aria-label="ChainRecall home">
          <span className="manufacturer-login-mark">CR</span>
          <span>ChainRecall</span>
        </a>
        <a className="manufacturer-login-consumer-link" href="/">Consumer verification</a>
      </header>

      <section className="manufacturer-login-content">
        <p className="manufacturer-login-eyebrow">SECURE MANUFACTURER ACCESS</p>
        <h1>Manufacturer Portal</h1>
        <p className="manufacturer-login-subtitle">
          Sign in to manage your product batches and traceability records.
        </p>

        <form className="manufacturer-login-card" onSubmit={(event) => void submit(event)}>
          <div className="manufacturer-login-card-heading">
            <span className="manufacturer-login-lock" aria-hidden="true">⌑</span>
            <div>
              <h2>Sign in</h2>
              <p>Use your manufacturer account credentials.</p>
            </div>
          </div>

          {error && <div className="manufacturer-login-error" role="alert">{error}</div>}

          <label className="manufacturer-login-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
              required
            />
          </label>

          <label className="manufacturer-login-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />
          </label>

          <button className="manufacturer-login-submit" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Login"}
          </button>
        </form>

        <p className="manufacturer-login-footnote">
          Product verification remains available to everyone without an account.
        </p>
      </section>
    </main>
  );
}

export default Login;
