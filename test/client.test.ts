import type { BetterFetch } from "@better-fetch/fetch";
import { describe, expect, it } from "vitest";

import { solanaPaymentsClient } from "../src/client.ts";

describe("solanaPaymentsClient", () => {
  it("registers typed payment actions against the Solana payment routes", async () => {
    const calls: Array<{ path: string; options: Record<string, unknown> }> = [];
    const plugin = solanaPaymentsClient();
    const actions = plugin.getActions(
      ((path: string, options: Record<string, unknown>) => {
        calls.push({ path, options });
        return Promise.resolve({});
      }) as BetterFetch,
      {},
      {},
    );

    expect(plugin.id).toBe("solanaPayments");
    expect(plugin.pathMethods).toEqual({
      "/solana-payments/create-payment": "POST",
      "/solana-payments/verify-payment": "POST",
      "/solana-payments/payment": "GET",
    });
    expect(actions.payment).toMatchObject({
      create: expect.any(Function),
      verify: expect.any(Function),
      get: expect.any(Function),
    });

    await actions.payment.create({ amount: "1000000", metadata: { orderId: "order-1" } });
    await actions.payment.verify({ reference: "payment-1" });
    await actions.payment.get({ reference: "payment-1" });

    expect(calls).toEqual([
      {
        path: "/solana-payments/create-payment",
        options: {
          method: "POST",
          body: { amount: "1000000", metadata: { orderId: "order-1" } },
        },
      },
      {
        path: "/solana-payments/verify-payment",
        options: { method: "POST", body: { reference: "payment-1" } },
      },
      {
        path: "/solana-payments/payment",
        options: { method: "GET", query: { reference: "payment-1" } },
      },
    ]);
  });
});
