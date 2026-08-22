import { defineErrorCodes, type BetterAuthPlugin } from "better-auth";

import { createPayment, getPayment, verifyPayment } from "./routes";
import { getSchema } from "./schema";
import type { SolanaPaymentsOptions } from "./types";

export { PACKAGE_VERSION } from "./version";
export { getSchema, solanaPaymentsPluginSchema } from "./schema";
export { createSolanaPaymentStore } from "./store";
export type {
  CreateSolanaPaymentInput,
  MarkPaidInput,
  SolanaPaymentStore,
  SolanaPaymentStoreContext,
} from "./store";
export type { SolanaPayment, SolanaPaymentsOptions, SolanaPaymentStatus } from "./types";

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
  return {
    id: "solanaPayments",
    endpoints: {
      createPayment: createPayment(options, "/solana-payments/create-payment"),
      verifyPayment: verifyPayment(options, "/solana-payments/verify-payment"),
      getPayment: getPayment(options, "/solana-payments/payment"),
    },
    schema: getSchema(options),
    $ERROR_CODES: ERROR_CODES,
  } satisfies BetterAuthPlugin;
}
