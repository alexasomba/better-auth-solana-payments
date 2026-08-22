import { mergeSchema, type BetterAuthPluginDBSchema, type DBFieldAttribute } from "better-auth/db";

import type { SolanaPaymentsOptions } from "./types.ts";

type SolanaPaymentSchema = Record<
  "solanaPayment",
  {
    fields: Record<
      | "reference"
      | "referenceType"
      | "referenceId"
      | "amount"
      | "mint"
      | "decimals"
      | "recipient"
      | "status"
      | "expiresAt"
      | "signature"
      | "slot"
      | "metadata"
      | "createdAt"
      | "updatedAt",
      DBFieldAttribute
    >;
  }
>;

const solanaPaymentSchema: SolanaPaymentSchema = {
  solanaPayment: {
    fields: {
      reference: { type: "string", required: true, unique: true },
      referenceType: { type: "string", required: true },
      referenceId: { type: "string", required: true, index: true },
      amount: { type: "string", required: true },
      mint: { type: "string", required: true },
      decimals: { type: "number", required: true },
      recipient: { type: "string", required: true },
      status: { type: "string", required: true, defaultValue: "pending", index: true },
      expiresAt: { type: "date", required: true },
      signature: { type: "string", required: false, unique: true },
      slot: { type: "string", required: false },
      metadata: { type: "string", required: false },
      createdAt: { type: "date", required: true },
      updatedAt: { type: "date", required: true },
    },
  },
} satisfies BetterAuthPluginDBSchema;

export type SolanaPaymentsPluginSchema = SolanaPaymentSchema;
export const solanaPaymentsPluginSchema: SolanaPaymentSchema = solanaPaymentSchema;

export function getSchema(
  options: Pick<SolanaPaymentsOptions, "schema">,
): BetterAuthPluginDBSchema {
  return mergeSchema(solanaPaymentSchema, options.schema as Parameters<typeof mergeSchema>[1]);
}
