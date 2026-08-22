# TanStack Example Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Flutterwave and Solana Payments TanStack Start examples to comprehensive, provider-accurate demo parity with the Paystack example.

**Architecture:** Flutterwave will extend its existing dashboard and server-function boundaries. Solana will use a compact dashboard shell with typed Better Auth client actions and a small set of focused components, while the plugin remains the only authority for payment persistence and verification.

**Tech Stack:** TanStack Start, React, Better Auth, TypeScript, Vite+, Vitest, Playwright, Cloudflare Workers.

**Spec:** `docs/superpowers/specs/2026-08-22-tanstack-example-parity-design.md`

## Global Constraints

- Do not modify the Paystack example.
- Keep provider credentials and on-chain verification server-owned.
- Do not add unsupported Solana subscriptions, catalogs, billing portals, or private-key handling.
- Preserve unrelated pre-existing working-tree changes in the Flutterwave repository.

### Task 1: Document the approved design

**Files:**
- Create: `docs/superpowers/specs/2026-08-22-tanstack-example-parity-design.md`
- Create: `docs/superpowers/plans/2026-08-22-tanstack-example-parity.md`

- [x] **Step 1: Write the design and plan documents**

  Record provider scope, architecture, validation commands, and non-goals as checked in repository documentation.

- [x] **Step 2: Self-review the documents**

  Confirm that every requested provider has an implementation task, unsupported capabilities are excluded, and no placeholder requirements remain.

### Task 2: Expand the Flutterwave TanStack example

**Repository:** `/Users/alexasomba/Documents/GitHub/alexasomba/better-auth-flutterwave`

**Files:**
- Modify: `examples/tanstack/src/components/dashboard/PaymentManager.tsx`
- Modify: `examples/tanstack/src/components/dashboard/TransactionsTable.tsx`
- Modify: `examples/tanstack/src/components/dashboard/payment/TrustedServerOperations.tsx`
- Modify: `examples/tanstack/src/lib/flutterwave-admin.ts`
- Modify: `examples/tanstack/src/lib/agent-discovery.ts`
- Modify: `examples/tanstack/src/__tests__/components/PaymentManager.test.tsx`
- Modify: `examples/tanstack/src/__tests__/flutterwave-cloudflare-client.test.ts`
- Modify: `examples/tanstack/src/__tests__/routes/flutterwave-callback.test.tsx`
- Modify: `examples/tanstack/README.md`

- [ ] **Step 1: Add failing tests for dashboard parity**

  Cover loading configured plans/products and subscriptions, selecting personal versus organization billing, starting a redirect checkout, canceling/restoring a subscription where the API exposes it, rendering transaction status, and surfacing server-operation failures.

- [ ] **Step 2: Run the focused Flutterwave tests and confirm the new assertions fail**

  Run `vp -C examples/tanstack test run src/__tests__/components/PaymentManager.test.tsx src/__tests__/routes/flutterwave-callback.test.tsx` from the Flutterwave repository.

- [ ] **Step 3: Implement the minimal provider-accurate dashboard flow**

  Reuse the existing Paystack component structure only where Flutterwave has equivalent actions. Keep callback verification behind `flutterwave-admin.ts`, pass the selected organization ID as the plugin's supported reference field, and display actionable error messages without exposing secrets.

- [ ] **Step 4: Update documentation and agent discovery**

  Document the actual demo flow, provider limitations, local setup, and server-only operations.

- [ ] **Step 5: Run the focused tests and Flutterwave build**

  Run the focused tests, then `vp check`, `vp test`, `vp run build`, and `vp run wrangler:dry-run` as applicable. Resolve only regressions introduced by this task.

### Task 3: Expand the Solana TanStack example

**Repository:** `/Users/alexasomba/Documents/GitHub/alexasomba/better-auth-solana-payments`

**Files:**
- Modify: `examples/tanstack/package.json`
- Modify: `examples/tanstack/src/lib/auth.ts`
- Modify: `examples/tanstack/src/lib/auth-client.ts`
- Modify: `examples/tanstack/src/routes/index.tsx`
- Modify: `examples/tanstack/src/routes/__root.tsx`
- Modify: `examples/tanstack/src/styles.css`
- Modify: `examples/tanstack/src/routeTree.gen.ts`
- Create: `examples/tanstack/src/components/AuthPanel.tsx`
- Create: `examples/tanstack/src/components/PaymentPanel.tsx`
- Create: `examples/tanstack/src/components/PaymentHistory.tsx`
- Create: `examples/tanstack/src/__tests__/components/PaymentPanel.test.tsx`
- Create: `examples/tanstack/src/__tests__/routes/home.test.tsx`
- Modify: `examples/tanstack/e2e/home.spec.ts` if needed
- Modify: `examples/tanstack/README.md`

- [ ] **Step 1: Add failing tests for the dashboard flow**

  Cover unauthenticated gating, sign-in/sign-up actions, decimal amount submission, wallet-link rendering, verify/get status refresh, and history display for pending, paid, and expired records.

- [ ] **Step 2: Run the focused tests and confirm the new assertions fail**

  Run `vp -C examples/tanstack test run` from the Solana repository after adding the tests; failures must be from missing dashboard behavior rather than test setup errors.

- [ ] **Step 3: Implement typed auth and payment panels**

  Configure the client with `solanaPaymentsClient()`, retain the existing server plugin, create reusable panels with accessible labels and explicit busy/error states, and call `payment.get`/`payment.verify` using the current reference.

- [ ] **Step 4: Add owner-scoped payment history**

  Track created references in the session UI and refresh each through the server `get` action. Do not infer payment status from local state or trust a wallet redirect as proof of payment.

- [ ] **Step 5: Update generated routes, styles, README, and package scripts**

  Keep route generation consistent with TanStack Start, add the test/build scripts needed for parity, and document the exact devnet flow and limitations.

- [ ] **Step 6: Run Solana validation**

  Run `vp check`, `vp test`, `vp build`, and `pnpm test:devnet` with the default no-signature smoke path.

### Task 4: Review and hand off

- [ ] **Step 1: Inspect diffs for scope and secret safety**

  Confirm no Paystack files changed, no private key or secret is sent to the browser, and no unrelated Flutterwave worktree changes are staged.

- [ ] **Step 2: Run final repository checks**

  Re-run the highest-value checks that passed during implementation and inspect their output for warnings.

- [ ] **Step 3: Commit and push only task changes**

  Commit the design and implementation files on the active feature branches, pull with rebase if needed, push, and report exact validation results.
