import type { InferOptionSchema } from "better-auth";
import type { SolanaPaymentsReadOnlyClient } from "solana-payments";

import type { SolanaPaymentsPluginSchema } from "./schema";

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
  client?: SolanaPaymentsReadOnlyClient;
  recipient?: string;
  mint?: string;
  decimals?: number;
  organization?: {
    enabled?: boolean;
  };
  schema?: InferOptionSchema<SolanaPaymentsPluginSchema>;
}
