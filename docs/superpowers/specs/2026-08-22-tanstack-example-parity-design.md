# TanStack Example Parity Design

## Goal

Make the Flutterwave and Solana Payments TanStack Start examples useful as comprehensive provider demonstrations, using the Paystack example as the reference for authenticated dashboard structure and test discipline while keeping each provider's supported capabilities explicit.

## Scope

### Flutterwave

- Keep the existing TanStack Start, Cloudflare, Better Auth, organization, subscription, product, callback, and server-operation structure.
- Expand the payment dashboard to expose plan/product configuration, personal or organization billing, subscription lifecycle actions, transaction history, callback-safe feedback, and trusted server operations that the Flutterwave plugin actually supports.
- Add focused component and integration coverage for those flows.
- Preserve server-only credentials, raw-body webhook verification, and provider-specific transaction semantics.

### Solana Payments

- Replace the minimal landing-page flow with an authenticated dashboard-style application.
- Demonstrate email/password sign-up and sign-in, payment creation with decimal token amounts, Solana wallet URL opening, status retrieval, on-chain verification, payment history, and safe handling of expired or already-paid intents.
- Use the plugin's optional organization support only if it can be demonstrated without inventing unsupported billing behavior; do not add recurring subscriptions, provider catalogs, billing portals, or private-key handling.
- Add reusable UI primitives and focused tests for the client-facing flow.

## Architecture

Flutterwave remains provider-native and reuses its existing client and server-function boundaries. Solana keeps all payment authority in `better-auth-solana-payments`; the browser only supplies an amount and invokes typed Better Auth client actions. The dashboard reads only owner-scoped records returned by the plugin and refreshes the current payment through `get` or `verify` rather than trusting client state.

## Validation

- Flutterwave: `vp check`, `vp test`, `vp run build`, and the existing Wrangler dry-run where dependencies allow it.
- Solana: typecheck, unit tests, production build, and the existing devnet smoke test with no signing or submission.
- Review generated route trees and workspace lockfiles after dependency or route changes.

## Non-goals

- No changes to the Paystack example.
- No provider capability emulation.
- No deployment, live payment, or wallet signing in automated tests.
