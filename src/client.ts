import type { BetterFetch, BetterFetchOption, BetterFetchResponse } from "@better-fetch/fetch";
import type { BetterAuthClientPlugin } from "better-auth/client";

import type { solanaPayments as solanaPaymentsServer } from "./index.ts";
import { PACKAGE_VERSION } from "./version.ts";

export type FetchResult<T, O extends BetterFetchOption | undefined> = O extends { throw: true }
  ? T
  : BetterFetchResponse<T>;

export interface SolanaPaymentResponse {
  id: string;
  reference: string;
  amount: string;
  mint: string;
  decimals: number;
  recipient: string;
  status: "pending" | "paid" | "expired" | "failed";
  expiresAt: Date;
  signature?: string;
  slot?: string;
  metadata?: Record<string, unknown>;
  paymentUrl?: string;
}

export interface SolanaPaymentActions {
  create: <O extends BetterFetchOption | undefined = undefined>(
    data: {
      amount: string;
      metadata?: Record<string, unknown>;
      organizationId?: string;
    },
    options?: O,
  ) => Promise<FetchResult<SolanaPaymentResponse, O>>;
  verify: <O extends BetterFetchOption | undefined = undefined>(
    data: { reference: string; organizationId?: string },
    options?: O,
  ) => Promise<FetchResult<SolanaPaymentResponse, O>>;
  get: <O extends BetterFetchOption | undefined = undefined>(
    data: { reference: string; organizationId?: string },
    options?: O,
  ) => Promise<FetchResult<SolanaPaymentResponse, O>>;
}

export interface SolanaPaymentsClientActions {
  payment: SolanaPaymentActions;
}

declare module "better-auth/client" {
  interface BetterAuthClient {
    payment: SolanaPaymentActions;
  }
}

declare module "better-auth" {
  interface BetterAuthClientPlugins {
    solanaPayments: ReturnType<typeof solanaPaymentsClient>;
  }
}

type SolanaPaymentsClientPluginInstance = Omit<
  BetterAuthClientPlugin,
  "id" | "$InferServerPlugin" | "getActions"
> & {
  id: "solanaPayments";
  $InferServerPlugin: ReturnType<typeof solanaPaymentsServer>;
  getActions: (
    $fetch: BetterFetch,
    $store: unknown,
    options: unknown,
  ) => SolanaPaymentsClientActions;
};

export const solanaPaymentsClient = (): SolanaPaymentsClientPluginInstance => ({
  id: "solanaPayments",
  version: PACKAGE_VERSION,
  $InferServerPlugin: {} as ReturnType<typeof solanaPaymentsServer>,
  pathMethods: {
    "/solana-payments/create-payment": "POST",
    "/solana-payments/verify-payment": "POST",
    "/solana-payments/payment": "GET",
  },
  getActions: ($fetch): SolanaPaymentsClientActions => ({
    payment: {
      create: (data, options) =>
        $fetch("/solana-payments/create-payment", {
          ...options,
          method: "POST",
          body: data,
        }),
      verify: (data, options) =>
        $fetch("/solana-payments/verify-payment", {
          ...options,
          method: "POST",
          body: data,
        }),
      get: (data, options) =>
        $fetch("/solana-payments/payment", { ...options, method: "GET", query: data }),
    },
  }),
});
