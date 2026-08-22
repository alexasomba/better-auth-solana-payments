import { useEffect, useState } from "react";
import type { SolanaPaymentResponse } from "better-auth-solana-payments/client";

import { authClient } from "@/lib/auth-client";

export default function PaymentHistory({ references }: { references: string[] }) {
  const [payments, setPayments] = useState<SolanaPaymentResponse[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (references.length === 0) {
      setPayments([]);
      return;
    }

    setLoading(true);
    void Promise.all(references.map((reference) => authClient.payment.get({ reference })))
      .then((results) => {
        if (cancelled) return;
        setPayments(
          results.flatMap((result) =>
            result.data === null || result.data === undefined ? [] : [result.data],
          ),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [references]);

  return (
    <section className="card">
      <p className="eyebrow">Payment history</p>
      <h2>Owner-scoped payment intents</h2>
      <p className="muted">
        The plugin intentionally exposes owner-scoped lookup instead of a broad payment listing
        endpoint. This demo refreshes references created by the current browser session.
      </p>
      {loading ? <p className="status-text">Refreshing payment history…</p> : null}
      {!loading && payments.length === 0 ? (
        <p className="status-text">No payment intents in this browser session.</p>
      ) : null}
      <div className="history-list">
        {payments.map((payment) => (
          <div className="history-row" key={payment.reference}>
            <code>{payment.reference}</code>
            <span>{payment.amount} base units</span>
            <strong>{payment.status}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
