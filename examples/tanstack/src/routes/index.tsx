import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";

type Payment = {
  amount: string;
  paymentUrl?: string;
  reference: string;
  status: string;
};

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  const { data: session } = authClient.useSession();
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("password123456");
  const [payment, setPayment] = useState<Payment | null>(null);
  const [message, setMessage] = useState("Create an account or sign in to start.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session?.user) setMessage(`Signed in as ${session.user.email}`);
  }, [session]);

  async function signIn() {
    setBusy(true);
    const result = await authClient.signIn.email({ email, password });
    setMessage(result.error?.message ?? "Signed in.");
    setBusy(false);
  }

  async function signUp() {
    setBusy(true);
    const result = await authClient.signUp.email({ email, password, name: "Devnet Buyer" });
    setMessage(result.error?.message ?? "Account created and signed in.");
    setBusy(false);
  }

  async function createPayment() {
    setBusy(true);
    const result = await authClient.payment.create({
      amount: "1",
      metadata: { source: "tanstack-devnet-example" },
    });
    if (result.error) setMessage(result.error.message ?? "Payment creation failed.");
    if (result.data) {
      setPayment(result.data);
      setMessage("Open the payment in a wallet, then verify it on-chain.");
    }
    setBusy(false);
  }

  async function verifyPayment() {
    if (!payment) return;
    setBusy(true);
    const result = await authClient.payment.verify({ reference: payment.reference });
    if (result.error) setMessage(result.error.message ?? "Payment verification failed.");
    if (result.data) {
      setPayment(result.data);
      setMessage(`Payment status: ${result.data.status}`);
    }
    setBusy(false);
  }

  return (
    <main className="page-shell">
      <div className="hero">
        <p className="eyebrow">TanStack Start example</p>
        <h1>Better Auth + Solana Payments</h1>
        <p className="lede">
          Authenticated one-time SPL-token checkout with a server-controlled recipient and RPC
          verification.
        </p>
        <p className="warning">
          Configure a devnet SPL token mint and recipient in <code>.env</code> before paying.
        </p>
      </div>

      <section className="card">
        <h2>1. Sign in</h2>
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
        <div className="actions">
          <button disabled={busy} onClick={signIn}>
            Sign in
          </button>
          <button className="secondary" disabled={busy} onClick={signUp}>
            Create account
          </button>
        </div>
      </section>

      <section className="card">
        <h2>2. Pay and verify</h2>
        <button disabled={busy || !session?.user} onClick={createPayment}>
          Create 1-token payment
        </button>
        {payment ? (
          <div className="payment-details">
            <p>
              Reference: <code>{payment.reference}</code>
            </p>
            <p>Amount: {payment.amount} base units</p>
            <p>
              Status: <strong>{payment.status}</strong>
            </p>
            {payment.paymentUrl ? (
              <a href={payment.paymentUrl}>Open payment in a Solana wallet</a>
            ) : null}
            <button className="secondary" disabled={busy} onClick={verifyPayment}>
              Verify payment on-chain
            </button>
          </div>
        ) : null}
      </section>

      <section className="card status">
        <h2>Status</h2>
        <p>{message}</p>
      </section>
    </main>
  );
}
