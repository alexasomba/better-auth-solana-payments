import { useState } from "react";
import type { SolanaPaymentResponse } from "better-auth-solana-payments/client";

import { authClient } from "@/lib/auth-client";

interface PaymentPanelProps {
  onCreated: (payment: SolanaPaymentResponse) => void;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message !== "" ? error.message : fallback;
}

export default function PaymentPanel({ onCreated }: PaymentPanelProps) {
  const [amount, setAmount] = useState("1");
  const [payment, setPayment] = useState<SolanaPaymentResponse | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function createPayment() {
    setBusy(true);
    setMessage("");
    try {
      const result = await authClient.payment.create({
        amount,
        metadata: { source: "tanstack-solana-example" },
      });
      if (result.error !== null && result.error !== undefined) {
        setMessage(result.error.message ?? "Payment creation failed.");
      } else if (result.data !== null && result.data !== undefined) {
        setPayment(result.data);
        onCreated(result.data);
        setMessage("Open the payment in a wallet, then verify the transfer on-chain.");
      }
    } catch (error: unknown) {
      setMessage(getErrorMessage(error, "Payment creation failed."));
    } finally {
      setBusy(false);
    }
  }

  async function verifyPayment() {
    if (payment === null) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await authClient.payment.verify({ reference: payment.reference });
      if (result.error !== null && result.error !== undefined) {
        setMessage(result.error.message ?? "Payment verification failed.");
      } else if (result.data !== null && result.data !== undefined) {
        setPayment(result.data);
        setMessage(`Payment status: ${result.data.status}`);
      }
    } catch (error: unknown) {
      setMessage(getErrorMessage(error, "Payment verification failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <p className="eyebrow">Step 2</p>
      <h2>Create and verify a one-time payment</h2>
      <p className="muted">
        The amount is supplied in display token units. The server converts it to exact base units
        before persisting the payment intent.
      </p>
      <label>
        Token amount
        <input
          inputMode="decimal"
          min="0"
          step="any"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>
      <button disabled={busy || amount.trim() === ""} onClick={() => void createPayment()}>
        {busy && payment === null ? "Creating payment…" : "Create payment"}
      </button>

      {payment !== null ? (
        <div className="payment-details">
          <div className="detail-grid">
            <span>Reference</span>
            <code>{payment.reference}</code>
            <span>Stored amount</span>
            <span>{payment.amount} base units</span>
            <span>Status</span>
            <strong>{payment.status}</strong>
          </div>
          {payment.paymentUrl !== undefined ? (
            <a href={payment.paymentUrl} target="_blank" rel="noreferrer">
              Open in a Solana wallet
            </a>
          ) : null}
          <button className="secondary" disabled={busy} onClick={() => void verifyPayment()}>
            {busy ? "Verifying…" : "Verify payment on-chain"}
          </button>
        </div>
      ) : null}
      {message !== "" ? <p className="status-text">{message}</p> : null}
    </section>
  );
}
