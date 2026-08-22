# Better Auth Solana Payments

One-time Solana payment integration for [Better Auth](https://www.better-auth.com).

## Installation

```bash
pnpm add better-auth better-auth-solana-payments solana-payments
```

Requires Node.js 22 or later.

## Server setup

Create a read-only Solana Payments SDK client and register the Better Auth plugin.

```ts
import { betterAuth } from "better-auth";
import { solanaPayments } from "better-auth-solana-payments";
import { SOLANA_USDT, createReadOnlySolanaPayments } from "solana-payments";

const client = createReadOnlySolanaPayments({
  rpcUrl: process.env.SOLANA_RPC_URL!,
  token: SOLANA_USDT,
  commitment: "confirmed",
});

export const auth = betterAuth({
  plugins: [
    solanaPayments({
      client,
      recipient: process.env.SOLANA_RECIPIENT!,
    }),
  ],
});
```

## Client setup

```ts
import { createAuthClient } from "better-auth/client";
import { solanaPaymentsClient } from "better-auth-solana-payments/client";

export const authClient = createAuthClient({
  plugins: [solanaPaymentsClient()],
});
```

## One-time payment flow

```ts
const created = await authClient.payment.create({
  // A decimal string in the configured token's display units; never use a JavaScript number.
  amount: "2.5",
  metadata: { orderId: "order_123" },
});

if (created.data?.paymentUrl) {
  // Present this Solana Pay URL as a link or QR code for the signed-in customer.
  window.location.assign(created.data.paymentUrl);
}

const verified = await authClient.payment.verify({
  reference: created.data!.reference,
});

if (verified.data?.status === "paid") {
  // Grant the entitlement only after server-side verification reports a paid payment.
}

const payment = await authClient.payment.get({
  reference: created.data!.reference,
});
```

`payment.create` persists a pending payment intent and returns its reference and Solana Pay URL.
After the customer signs the transaction, call `payment.verify` with that reference. The server
uses its configured RPC client to verify the matching token transfer before marking the payment
paid. `payment.get` reads the current status without attempting verification.

Amounts are decimal strings in the configured token's display units (for example, `"2.5"` is
2.5 USDT with the default six-decimal USDT token). Do not pass JavaScript numbers, which can lose
precision for token amounts.

The browser may supply only the amount, optional metadata, reference, and optional organization
ID. The server controls the recipient and token configuration, so clients cannot redirect funds
or choose another mint. The integration uses a read-only RPC client: it stores no private keys and
never signs or sends a transaction on behalf of a customer.

This package supports one-time payments only. It does not create recurring subscriptions or
perform recurring charges.

## TanStack Start example

The repository includes a runnable TanStack Start example at
[`examples/tanstack`](./examples/tanstack). It demonstrates email/password auth, server-created
Solana Pay requests, wallet checkout, and server-side verification against devnet RPC.

```bash
cd examples/tanstack
cp .env.example .env
# Set SOLANA_MINT and SOLANA_RECIPIENT to your devnet SPL token and recipient.
pnpm install
pnpm dev
```

The example uses an in-memory adapter and is intended for local development only. It does not
store private keys or submit transactions. See its README for the repeatable RPC and on-chain
smoke test (`pnpm test:devnet`) and the full wallet verification flow.

For devnet, configure a devnet SPL-token mint; the built-in `SOLANA_USDT` preset is the mainnet
USDT mint and must not be used for devnet testing. In production, use a persistent Better Auth
adapter, a generated `BETTER_AUTH_SECRET`, and a dedicated RPC provider.
