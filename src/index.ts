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

export function solanaPayments() {
  return {};
}
