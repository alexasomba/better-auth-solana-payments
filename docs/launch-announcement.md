# Better Auth Solana Payments — early release

`better-auth-solana-payments` adds authenticated, one-time SPL-token checkout to Better Auth.
The server controls the recipient and token configuration, creates a Solana Pay request, and
verifies the matching transfer through a read-only RPC client.

Install:

```bash
pnpm add better-auth better-auth-solana-payments solana-payments
```

Try the TanStack Start devnet example:

```bash
git clone https://github.com/alexasomba/better-auth-solana-payments.git
cd better-auth-solana-payments/examples/tanstack
cp .env.example .env
# Configure a devnet SPL-token mint and recipient.
pnpm install && pnpm dev
```

This first release focuses on secure one-time payments. It does not include subscriptions,
recurring charges, private-key custody, or server-side transaction signing.

## Feedback requested

Please try the example and report:

- framework/runtime combinations that work or fail;
- wallet and SPL-token combinations tested on devnet;
- confusing API or error messages;
- verification latency or missed-transfer behavior;
- the next payment feature you would actually use.

Open feedback in [the early adopter issue](https://github.com/alexasomba/better-auth-solana-payments/issues/1).
