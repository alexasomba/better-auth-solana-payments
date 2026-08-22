import { describe, expect, it } from "vitest";

import { solanaPayments } from "../src/index.ts";

const RECIPIENT = "8VfCFVmXRBHtrMFxM41eNNFyqUhCGSzcKpM2gEuQ4pY1";

describe("solanaPayments plugin", () => {
  it("registers stable endpoint paths, schema, and error codes", () => {
    const plugin = solanaPayments({
      recipient: RECIPIENT,
      client: {
        payments: {
          createRequest: () => ({ recipient: RECIPIENT }),
        },
      } as never,
    });

    expect(plugin).toMatchObject({ id: "solanaPayments" });
    expect(plugin.endpoints.createPayment.path).toBe("/solana-payments/create-payment");
    expect(plugin.endpoints.verifyPayment.path).toBe("/solana-payments/verify-payment");
    expect(plugin.endpoints.getPayment.path).toBe("/solana-payments/payment");
    expect(plugin.schema.solanaPayment?.fields.reference?.unique).toBe(true);
    expect(Object.keys(plugin.$ERROR_CODES)).toEqual(
      expect.arrayContaining([
        "MISSING_SESSION",
        "UNAUTHORIZED_PAYMENT",
        "PAYMENT_EXPIRED",
        "INVALID_PAYMENT",
        "PAYMENT_MISMATCH",
      ]),
    );
  });
});
