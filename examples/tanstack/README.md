# TanStack Start devnet example

This example follows the same TanStack Start structure as the Paystack integration example and
demonstrates the complete one-time SPL-token flow:

1. Create a Better Auth account and sign in.
2. Create a payment intent through `better-auth-solana-payments`.
3. Open the server-generated Solana Pay URL in a wallet.
4. Verify the transfer against devnet RPC and observe the `paid` status.

The example uses Better Auth's in-memory adapter for simplicity. Restarting the dev server clears
accounts and payment intents; use a real adapter before deploying.

## Run it

```bash
cp .env.example .env
# Set SOLANA_MINT and SOLANA_RECIPIENT to a devnet SPL token and recipient.
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

The example never stores private keys and never signs or submits a transaction. The wallet does
that. You need a devnet wallet funded with the configured SPL token. The default `SOLANA_USDT`
preset is a mainnet token, so do not use it for this devnet example.

## Validate the devnet configuration

The smoke script checks RPC health and builds a payment request without signing or submitting a
transaction:

```bash
pnpm test:devnet
```

To verify a real transfer after completing the browser flow, provide the payment reference and
wallet transaction signature:

```bash
SOLANA_SIGNATURE=... SOLANA_REFERENCE=... pnpm test:devnet
```

The script uses the same mint, recipient, decimals, and RPC URL as the example app. A successful
browser flow is: create an account, create a payment, open the wallet URL, approve the transfer,
then click **Verify payment on-chain**.

For production, replace the memory adapter with a persistent Better Auth adapter, set a generated
`BETTER_AUTH_SECRET`, and use a dedicated RPC provider. Never put private keys in this example or
in server environment variables.
