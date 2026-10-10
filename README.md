# Better Auth Solana Payments

One-time Solana payment integration for [Better Auth](https://www.better-auth.com).

## Installation

```bash
pnpm add better-auth better-auth-solana-payments solana-payments
```

Requires Node.js 22.22.2 or later and solana-payments 1.x.

Existing installations must add the fulfillment fields before upgrading. For the default SQLite table and column names, see `migrations/0.2.0-sqlite.sql`; custom schemas must generate the equivalent Better Auth migration. Back up the database, verify paid-row fulfillment state, then deploy.

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

if (verified.data?.status === "paid" && verified.data.fulfillmentStatus === "completed") {
  // Grant the entitlement only after server-side verification and fulfillment complete.
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

If the wallet already returned a transaction signature, send it as the optional `signature` field
to `payment.verify`. The SDK checks that candidate before scanning recent transactions, while still
verifying the configured mint, recipient, amount, cluster and confirmation commitment. The plugin
inherits the token program configured on the server's SDK client. Basic Token-2022 transfers are
supported; transfer-fee and transfer-hook mints need extension-aware verification and are not
accepted as ordinary transfers. See Solana's [payment verification guidance](https://solana.com/docs/payments/accept-payments/verification-tools)
and [Token Extensions documentation](https://solana.com/docs/tokens/extensions) when configuring a mint.

The browser may supply the amount, optional metadata, reference, optional transaction signature,
and optional organization ID. The server controls the recipient and token configuration, so clients
cannot redirect funds or choose another mint. The integration uses a read-only RPC client: it stores
no private keys and never signs or sends a transaction on behalf of a customer.

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

### Fulfillment migration and retries

Generate/apply your Better Auth schema migration before upgrading. Add `fulfillmentStatus` (default `pending`), nullable `fulfillmentToken`, and nullable `fulfillmentClaimedAt` to `solanaPayment`. Backfill previously paid rows to `completed` before accepting requests, so historical payments are not fulfilled again.

Payment settlement and fulfillment are separate: verification persists `paid`, then claims a database lease before invoking `onPaymentComplete`. Failed callbacks return an error and leave fulfillment pending; retry verification to recover, including after a restart. A crashed worker's claim becomes recoverable after five minutes. Callbacks must be idempotent by payment reference, since a crash after an external side effect can cause a retry. Responses expose `fulfillmentStatus`; grant access only when it is `completed`.

## Settlement and operational edge cases

### Confirmation depth

The SDK verifier requires at least `confirmed`, even if its client is configured with
`processed`. Configure `commitment: "finalized"` when your application needs the strongest
settlement state before fulfillment; a merely confirmed transaction then remains unaccepted.
This is a commitment policy, not a configurable number of confirmations. Failed execution
is rejected regardless of commitment. See [Solana's commitment definitions](https://solana.com/docs/rpc#configuring-state-commitment).

Show an awaiting-confirmation state and retry server verification with bounded backoff for
an unsettled transfer or RPC failure. `PAYMENT_MISMATCH` alone does not distinguish an
unconfirmed transfer, absent transfer, wrong token/network, or a provider error. A browser
wallet success notification is not settlement proof. Grant an entitlement only when the
response has both `status === "paid"` and `fulfillmentStatus === "completed"`.

Choose the commitment before accepting payments and keep it consistent: an already-paid
intent retries fulfillment without re-verifying the chain, so changing the client to
`finalized` does not upgrade previously recorded confirmed payments automatically.

### Duplicate verification and callbacks

Repeated browser verification calls share the stored payment. A conditional database claim
allows one active fulfillment callback; completed fulfillment is not called again. Callback
failure releases the claim for retry, and a crashed claim can be recovered after five minutes.
This does not guarantee exactly-once external side effects: a crash after issuing an email,
granting access, or updating another service can happen before completion is persisted.

Make `onPaymentComplete` idempotent using the payment reference as a durable business key.
Use a unique entitlement/fulfillment record and a transaction or outbox where possible;
pass the same reference as an external service's idempotency key. Retry verification after
a transient failure, including after a restart. The fulfillment migration and a persistent
adapter are required; an in-memory adapter cannot coordinate separate workers.

### Refunds

This read-only plugin has no refund endpoint and no `refunded` payment status. A refund is a
separate authorized on-chain transfer, not a rollback of the settled transaction. Keep the
original paid record as settlement evidence. An application refund ledger should record the
payment reference, approved amount, token mint, cluster, destination, refund signature and
confirmation state, and reconcile retries idempotently before sending again.

Verify the refund destination through your application's authenticated review flow; do not
trust a browser-supplied address or infer the payer from an arbitrary transaction account.
Use a separate controlled signing service/manual process. Mark a refund complete only after
its chosen confirmation policy succeeds, then apply the application's entitlement policy.
The plugin neither signs refunds nor automatically revokes access.

### Right token, wrong network

Token symbols are labels; the asset is identified by its cluster and mint address. Verification
uses the server's configured RPC endpoint and token, and does not search other networks. A
transfer on another Solana cluster, or USDT sent through another chain, does not settle this
intent. The mainnet `SOLANA_USDT` preset is not a devnet token. See [Solana clusters](https://solana.com/docs/references/clusters).

Show the required network and mint before payment, check the wallet's network where possible,
and keep the RPC/cluster/mint configuration fixed for outstanding intents. If verification
cannot find a matching transfer, leave access unfulfilled; the intent remains pending until
expiry. Do not switch the production verifier to another network or manually mark the intent
paid to make the transaction appear to match.

Collect the transaction signature, actual network, mint and recipient for a support case,
and independently verify them on that network. A missing result is not proof that funds were
never sent. Explain that recovery depends on control of the recipient on the actual network;
this plugin cannot bridge, reverse or recover those funds. If a reviewed recovery/refund is
possible, track it separately and ask the customer to create a new intent on the required
network. Never request a wallet seed phrase or private key.
