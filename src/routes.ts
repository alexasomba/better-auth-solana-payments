import { randomUUID } from "node:crypto";

import {
  APIError,
  createAuthEndpoint,
  getSessionFromCtx,
  originCheck,
  sessionMiddleware,
} from "better-auth/api";
import type { GenericEndpointContext } from "better-auth";
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
    | "PAYMENT_MISMATCH",
  message: string,
): never {
  throw new APIError(code === "MISSING_SESSION" ? "UNAUTHORIZED" : "BAD_REQUEST", {
    code,
    message,
  });
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
    expiresAt: payment.expiresAt,
    signature: payment.signature ?? undefined,
    slot: payment.slot ?? undefined,
    metadata: payment.metadata
      ? (JSON.parse(payment.metadata) as Record<string, unknown>)
      : undefined,
    ...(paymentUrl ? { paymentUrl } : {}),
  };
}

export const createPayment = <P extends string = "/create-payment">(
  options: SolanaPaymentsOptions,
  path: P = "/create-payment" as P,
) =>
  createAuthEndpoint(
    path,
    { method: "POST", body: createPaymentBody, use: [sessionMiddleware, originCheck] },
    async (ctx) => {
      const store = await paymentStore(ctx, ctx.body.organizationId);
      const reference = randomUUID();
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
  callbacksInFlight = new Set<string>(),
) =>
  createAuthEndpoint(
    path,
    { method: "POST", body: verifyPaymentBody, use: [sessionMiddleware, originCheck] },
    async (ctx) => {
      const { store, payment } = await loadPayment(
        ctx,
        ctx.body.reference,
        ctx.body.organizationId,
      );
      if (payment.status === "paid") return ctx.json(asResponse(payment));
      if (payment.status === "expired" || payment.expiresAt <= new Date()) {
        if (payment.status === "pending") await store.markExpired(payment.reference);
        routeError("PAYMENT_EXPIRED", "Payment intent has expired.");
      }
      if (payment.status !== "pending") routeError("INVALID_PAYMENT", "Payment is not pending.");
      const wasPending = payment.status === "pending";

      let verified;
      try {
        verified = await options.client.payments.verify({
          reference: payment.reference,
          recipient: payment.recipient,
          amount: payment.amount,
        });
      } catch (error) {
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
      const { payment: paid, transitioned } = await store.markPaidWithTransition(
        payment.reference,
        {
          signature: verified.signature,
          slot: verified.slot?.toString(),
        },
      );
      if (!paid) routeError("INVALID_PAYMENT", "Payment state could not be updated.");
      if (wasPending && transitioned && !callbacksInFlight.has(paid.reference)) {
        callbacksInFlight.add(paid.reference);
        try {
          await options.onPaymentComplete?.(paid, ctx);
        } finally {
          callbacksInFlight.delete(paid.reference);
        }
      }
      return ctx.json(asResponse(paid));
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
