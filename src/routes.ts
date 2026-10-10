import { randomBytes } from "node:crypto";

import {
  APIError,
  createAuthEndpoint,
  getSessionFromCtx,
  originCheckMiddleware,
  sessionMiddleware,
} from "better-auth/api";
import type { GenericEndpointContext } from "better-auth";
import { formatTokenAmount, isSolanaPaymentsError } from "solana-payments";
import { z } from "zod";

import { createSolanaPaymentStore } from "./store.ts";
import type { SolanaPayment, SolanaPaymentsOptions } from "./types.ts";

const createPaymentBody = z.object({
  amount: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  organizationId: z.string().min(1).optional(),
});
const verifyPaymentBody = z.object({
  reference: z.string().min(1),
  /** Transaction signature lets the SDK verify a candidate before scanning recent history. */
  signature: z.string().min(1).optional(),
  organizationId: z.string().min(1).optional(),
});
const getPaymentQuery = z.object({
  reference: z.string().min(1),
  organizationId: z.string().min(1).optional(),
});

function routeError(
  code:
    | "MISSING_SESSION"
    | "UNAUTHORIZED_PAYMENT"
    | "PAYMENT_EXPIRED"
    | "INVALID_PAYMENT"
    | "PAYMENT_MISMATCH"
    | "PAYMENT_PROVIDER_UNAVAILABLE",
  message: string,
): never {
  const status =
    code === "MISSING_SESSION"
      ? "UNAUTHORIZED"
      : code === "PAYMENT_PROVIDER_UNAVAILABLE"
        ? "INTERNAL_SERVER_ERROR"
        : "BAD_REQUEST";
  throw new APIError(status, {
    code,
    message,
  });
}

function assertOrganizationEnabled(options: SolanaPaymentsOptions, organizationId?: string) {
  if (organizationId && options.organization?.enabled !== true) {
    routeError("UNAUTHORIZED_PAYMENT", "Organization payments are not enabled.");
  }
}

async function paymentStore(ctx: GenericEndpointContext, organizationId?: string) {
  const session = await getSessionFromCtx(ctx);
  if (!session) routeError("MISSING_SESSION", "An authenticated session is required.");
  try {
    const store = createSolanaPaymentStore({
      adapter: ctx.context.adapter,
      session,
      organizationId,
      hasOrganizationPlugin: ctx.context.hasPlugin?.("organization") === true,
    });
    await store.assertOwner();
    return store;
  } catch (error) {
    routeError(
      "UNAUTHORIZED_PAYMENT",
      error instanceof Error ? error.message : "Unauthorized payment.",
    );
  }
}

async function loadPayment(
  ctx: GenericEndpointContext,
  reference: string,
  organizationId?: string,
) {
  const store = await paymentStore(ctx, organizationId);
  try {
    const payment = await store.findByReference(reference);
    if (!payment) routeError("UNAUTHORIZED_PAYMENT", "Payment was not found for this owner.");
    return { store, payment };
  } catch (error) {
    if (error instanceof APIError) throw error;
    routeError(
      "UNAUTHORIZED_PAYMENT",
      error instanceof Error ? error.message : "Unauthorized payment.",
    );
  }
}

function asResponse(payment: SolanaPayment, paymentUrl?: string) {
  return {
    id: payment.id,
    reference: payment.reference,
    amount: payment.amount,
    mint: payment.mint,
    decimals: payment.decimals,
    recipient: payment.recipient,
    status: payment.status,
    fulfillmentStatus:
      payment.fulfillmentStatus ?? (payment.status === "paid" ? "completed" : "pending"),
    expiresAt: payment.expiresAt,
    signature: payment.signature ?? undefined,
    slot: payment.slot ?? undefined,
    metadata: payment.metadata
      ? (JSON.parse(payment.metadata) as Record<string, unknown>)
      : undefined,
    ...(paymentUrl ? { paymentUrl } : {}),
  };
}

// Solana Pay references are public keys (base58-encoded 32-byte values).
function createReference() {
  const bytes = randomBytes(32);
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let number = BigInt(`0x${bytes.toString("hex")}`);
  let encoded = "";
  while (number > 0n) {
    encoded = alphabet[Number(number % 58n)] + encoded;
    number /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    encoded = "1" + encoded;
  }
  return encoded;
}

async function fulfillPayment(
  ctx: GenericEndpointContext,
  options: SolanaPaymentsOptions,
  store: Awaited<ReturnType<typeof paymentStore>>,
  payment: SolanaPayment,
) {
  const claimed = await store.claimFulfillment(payment.reference);
  if (!claimed) return (await store.findByReference(payment.reference)) ?? payment;
  const token = claimed.fulfillmentToken!;
  try {
    await options.onPaymentComplete?.(claimed, ctx);
    const completed = await store.finishFulfillment(claimed.reference, token, true);
    if (!completed) throw new Error("Fulfillment lease was lost; retry verification.");
    return completed;
  } catch (error) {
    await store.finishFulfillment(claimed.reference, token, false);
    throw error;
  }
}

export const createPayment = <P extends string = "/create-payment">(
  options: SolanaPaymentsOptions,
  path: P = "/create-payment" as P,
) =>
  createAuthEndpoint(
    path,
    { method: "POST", body: createPaymentBody, use: [sessionMiddleware, originCheckMiddleware] },
    async (ctx) => {
      assertOrganizationEnabled(options, ctx.body.organizationId);
      const store = await paymentStore(ctx, ctx.body.organizationId);
      const reference = createReference();
      const request = options.client.payments.createRequest({
        amount: ctx.body.amount,
        recipient: options.recipient,
        reference,
        metadata: ctx.body.metadata,
      });
      const payment = await store.create({
        reference: request.reference,
        amount: request.amount.toString(),
        mint: request.mint,
        decimals: request.decimals,
        recipient: request.recipient ?? options.recipient,
        expiresAt: new Date(Date.now() + (options.paymentExpirationMs ?? 30 * 60 * 1000)),
        metadata: ctx.body.metadata ? JSON.stringify(ctx.body.metadata) : null,
        signature: null,
        slot: null,
      });
      const paymentUrl = options.client.payments.toSolanaPayUrl(request).toString();
      return ctx.json(asResponse(payment, paymentUrl));
    },
  );

export const verifyPayment = <P extends string = "/verify-payment">(
  options: SolanaPaymentsOptions,
  path: P = "/verify-payment" as P,
) =>
  createAuthEndpoint(
    path,
    { method: "POST", body: verifyPaymentBody, use: [sessionMiddleware, originCheckMiddleware] },
    async (ctx) => {
      assertOrganizationEnabled(options, ctx.body.organizationId);
      const { store, payment } = await loadPayment(
        ctx,
        ctx.body.reference,
        ctx.body.organizationId,
      );
      if (payment.status === "paid")
        return ctx.json(asResponse(await fulfillPayment(ctx, options, store, payment)));
      if (payment.status === "expired" || payment.expiresAt <= new Date()) {
        if (payment.status === "pending") await store.markExpired(payment.reference);
        routeError("PAYMENT_EXPIRED", "Payment intent has expired.");
      }
      if (payment.status !== "pending") routeError("INVALID_PAYMENT", "Payment is not pending.");

      let verified;
      try {
        verified = await options.client.payments.verify({
          reference: payment.reference,
          ...(ctx.body.signature ? { signature: ctx.body.signature } : {}),
          recipient: payment.recipient,
          amount: formatTokenAmount(payment.amount, payment.decimals),
        });
      } catch (error) {
        if (
          isSolanaPaymentsError(error) &&
          ["RPC_ERROR", "RPC_TIMEOUT", "TRANSACTION_TIMEOUT"].includes(error.code)
        ) {
          routeError(
            "PAYMENT_PROVIDER_UNAVAILABLE",
            "Solana RPC could not confirm the payment. Retry verification with the same reference.",
          );
        }
        routeError(
          "PAYMENT_MISMATCH",
          error instanceof Error ? error.message : "Payment did not match intent.",
        );
      }
      if (
        !verified.found ||
        verified.reference !== payment.reference ||
        verified.recipient !== payment.recipient ||
        verified.amount?.toString() !== payment.amount
      ) {
        routeError("PAYMENT_MISMATCH", "Payment did not exactly match the stored intent.");
      }
      const { payment: paid } = await store.markPaidWithTransition(payment.reference, {
        signature: verified.signature,
        slot: verified.slot?.toString(),
      });
      if (!paid) routeError("INVALID_PAYMENT", "Payment state could not be updated.");
      return ctx.json(asResponse(await fulfillPayment(ctx, options, store, paid)));
    },
  );

export const getPayment = <P extends string = "/payment">(
  options: SolanaPaymentsOptions,
  path: P = "/payment" as P,
) =>
  createAuthEndpoint(
    path,
    { method: "GET", query: getPaymentQuery, use: [sessionMiddleware] },
    async (ctx) => {
      assertOrganizationEnabled(options, ctx.query.organizationId);
      const { store, payment } = await loadPayment(
        ctx,
        ctx.query.reference,
        ctx.query.organizationId,
      );
      const current =
        payment.status === "pending" && payment.expiresAt <= new Date()
          ? await store.markExpired(payment.reference)
          : payment;
      return ctx.json(asResponse(current ?? payment));
    },
  );
