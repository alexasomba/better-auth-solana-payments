import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import AuthPanel from "@/components/AuthPanel";
import PaymentHistory from "@/components/PaymentHistory";
import PaymentPanel from "@/components/PaymentPanel";
import { authClient } from "@/lib/auth-client";

const referenceStorageKey = "better-auth-solana-payment-references";

export const Route = createFileRoute("/")({ component: HomePage });

export function HomePage() {
  const { data: session, isPending } = authClient.useSession();
  const [references, setReferences] = useState<string[]>([]);

  useEffect(() => {
    if (session?.user === undefined || session.user === null) {
      setReferences([]);
      return;
    }
    try {
      const stored = window.localStorage.getItem(`${referenceStorageKey}:${session.user.id}`);
      const parsed: unknown = stored === null ? [] : JSON.parse(stored);
      setReferences(
        Array.isArray(parsed)
          ? parsed.filter((reference): reference is string => typeof reference === "string")
          : [],
      );
    } catch {
      setReferences([]);
    }
  }, [session?.user]);

  function rememberReference(reference: string) {
    if (session?.user === undefined || session.user === null) return;
    setReferences((current) => {
      const next = [reference, ...current.filter((item) => item !== reference)].slice(0, 10);
      window.localStorage.setItem(
        `${referenceStorageKey}:${session.user.id}`,
        JSON.stringify(next),
      );
      return next;
    });
  }

  return (
    <main className="page-shell">
      <header className="hero">
        <p className="eyebrow">TanStack Start example · devnet</p>
        <h1>Better Auth + Solana Payments</h1>
        <p className="lede">
          A complete one-time SPL-token flow: authenticate, create a server-owned payment intent,
          open it in a wallet, and verify the transfer against Solana RPC.
        </p>
        <p className="warning">
          Configure a devnet mint and recipient in <code>.env</code>. The browser never receives a
          private key and never submits a transaction.
        </p>
      </header>

      {isPending ? <section className="card status-text">Loading session…</section> : null}
      {!isPending ? <AuthPanel session={session?.user === undefined ? null : session} /> : null}
      {!isPending && session?.user !== undefined && session.user !== null ? (
        <>
          <PaymentPanel onCreated={(payment) => rememberReference(payment.reference)} />
          <PaymentHistory references={references} />
        </>
      ) : null}

      <footer className="footer">
        <span>One-time payments only · devnet demonstration</span>
        <a href="https://github.com/alexasomba/better-auth-solana-payments">View the package</a>
      </footer>
    </main>
  );
}
