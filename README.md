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
import { createReadOnlySolanaPayments } from "solana-payments";

const client = createReadOnlySolanaPayments({
  rpcUrl: process.env.SOLANA_RPC_URL!,
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

1. Call the client payment creation action with the amount and optional metadata.
2. Present the returned Solana Pay URL to the authenticated user.
3. Call the verification action after the wallet transaction completes.
4. Read the payment status to grant the associated entitlement only after verification succeeds.

The server owns the recipient and token configuration. Do not accept either value from browser requests.
