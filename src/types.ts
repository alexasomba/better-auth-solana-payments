import type { GenericEndpointContext, InferOptionSchema } from "better-auth";
import type { AddressInput, SolanaUsdtReadOnlyClient } from "solana-payments";

import type { SolanaPaymentsPluginSchema } from "./schema.ts";

export type SolanaPaymentStatus = "pending" | "paid" | "expired" | "failed";

export interface SolanaPayment {
  id: string;
  reference: string;
  referenceType: "user" | "organization";
  referenceId: string;
  /** Base-unit token amount, retained as a string to avoid JavaScript number rounding. */
  amount: string;
  mint: string;
  decimals: number;
  recipient: string;
  status: SolanaPaymentStatus;
  expiresAt: Date;
  signature?: string | null;
  /** Ledger slot, retained as a string to avoid JavaScript number rounding. */
  slot?: string | null;
  metadata?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SolanaPaymentsOptions {
  client: SolanaUsdtReadOnlyClient;
  recipient: AddressInput;
  paymentExpirationMs?: number;
  onPaymentComplete?: (
    payment: SolanaPayment,
    context: GenericEndpointContext,
  ) => Promise<void> | void;
  organization?: {
    enabled?: boolean;
  };
  schema?: InferOptionSchema<SolanaPaymentsPluginSchema>;
}
