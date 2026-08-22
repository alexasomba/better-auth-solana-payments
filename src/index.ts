import { defineErrorCodes, type BetterAuthPlugin } from "better-auth";

import { createPayment, getPayment, verifyPayment } from "./routes.ts";
import { getSchema } from "./schema.ts";
import type { SolanaPaymentsOptions } from "./types.ts";

export { PACKAGE_VERSION } from "./version.ts";
export { getSchema, solanaPaymentsPluginSchema } from "./schema.ts";
export { createSolanaPaymentStore } from "./store.ts";
export type {
  CreateSolanaPaymentInput,
  MarkPaidInput,
  MarkPaidResult,
  SolanaPaymentStore,
  SolanaPaymentStoreContext,
} from "./store.ts";
export type { SolanaPayment, SolanaPaymentsOptions, SolanaPaymentStatus } from "./types.ts";

const ERROR_CODES = defineErrorCodes({
  MISSING_SESSION: "An authenticated session is required.",
  UNAUTHORIZED_PAYMENT: "Payment was not found for this owner.",
  PAYMENT_EXPIRED: "Payment intent has expired.",
  INVALID_PAYMENT: "Payment is invalid.",
  PAYMENT_MISMATCH: "Payment did not exactly match the stored intent.",
});

export function solanaPayments(input: SolanaPaymentsOptions) {
  const normalized = input.client.payments.createRequest({
    amount: "0",
    recipient: input.recipient,
    reference: "solana-payments-recipient-normalization",
  }).recipient;
  if (!normalized) throw new Error("A Solana payment recipient is required.");
  const options = {
    ...input,
    recipient: normalized,
    paymentExpirationMs: input.paymentExpirationMs ?? 30 * 60 * 1000,
  } satisfies SolanaPaymentsOptions;
  const callbacksInFlight = new Set<string>();
  return {
    id: "solanaPayments",
    endpoints: {
      createPayment: createPayment(options, "/solana-payments/create-payment"),
      verifyPayment: verifyPayment(options, "/solana-payments/verify-payment", callbacksInFlight),
      getPayment: getPayment(options, "/solana-payments/payment"),
    },
    schema: getSchema(options),
    $ERROR_CODES: ERROR_CODES,
  } satisfies BetterAuthPlugin;
}
