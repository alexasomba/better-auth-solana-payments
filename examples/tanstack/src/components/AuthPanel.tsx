import { useState } from "react";

import { authClient } from "@/lib/auth-client";

interface AuthPanelProps {
  session: { user: { email: string; name?: string | null } } | null;
}

export default function AuthPanel({ session }: AuthPanelProps) {
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("password123456");
  const [name, setName] = useState("Devnet Buyer");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    const result = await authClient.signIn.email({ email, password });
    setMessage(result.error?.message ?? "Signed in.");
    setBusy(false);
  }

  async function signUp() {
    setBusy(true);
    const result = await authClient.signUp.email({ email, password, name });
    setMessage(result.error?.message ?? "Account created and signed in.");
    setBusy(false);
  }

  if (session !== null) {
    return (
      <section className="card auth-card">
        <div>
          <p className="eyebrow">Authenticated session</p>
          <h2>{session.user.name ?? session.user.email}</h2>
          <p className="muted">{session.user.email}</p>
        </div>
        <button className="secondary" onClick={() => void authClient.signOut()}>
          Sign out
        </button>
      </section>
    );
  }

  return (
    <section className="card">
      <p className="eyebrow">Step 1</p>
      <h2>Sign in to create a payment</h2>
      <div className="form-grid">
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label>
          Name for new accounts
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
      </div>
      <div className="actions">
        <button disabled={busy} onClick={() => void signIn()}>
          Sign in
        </button>
        <button className="secondary" disabled={busy} onClick={() => void signUp()}>
          Create account
        </button>
      </div>
      {message !== "" ? <p className="status-text">{message}</p> : null}
    </section>
  );
}
