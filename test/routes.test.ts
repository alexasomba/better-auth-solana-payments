import { describe, expect, it, vi } from "vitest";

import { solanaPayments } from "../src/index.ts";

const RECIPIENT = "8VfCFVmXRBHtrMFxM41eNNFyqUhCGSzcKpM2gEuQ4pY1";
const MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY1eWAPYxe5hQkzX";

type Row = Record<string, unknown>;
type Where = { field: string; value: unknown }[];

function createAdapter(initial: Record<string, Row[]> = {}) {
  const tables = structuredClone(initial);
  const matches = (row: Row, where: Where = []) =>
    where.every(({ field, value }) => row[field] === value);
  return {
    tables,
    async create<T>({ model, data }: { model: string; data: Row }) {
      const row = { ...data, id: `${model}_${tables[model]?.length ?? 0}` };
      (tables[model] ??= []).push(row);
      return row as T;
    },
    async findOne<T>({ model, where }: { model: string; where: Where }) {
      return (tables[model]?.find((row) => matches(row, where)) as T | undefined) ?? null;
    },
    async update<T>({ model, update, where }: { model: string; update: Row; where: Where }) {
      const row = tables[model]?.find((candidate) => matches(candidate, where));
      return row ? (Object.assign(row, update) as T) : null;
    },
  };
}

function createClient(verification = {}) {
  return {
    payments: {
      createRequest: vi.fn(({ amount, recipient, reference }) => ({
        reference: reference ?? "generated-reference",
        recipient,
        mint: MINT,
        amount: BigInt(amount),
        displayAmount: "12.34",
        decimals: 6,
        memo: `solana-usdt:${reference}`,
        createdAt: "2026-08-22T12:00:00.000Z",
      })),
      toSolanaPayUrl: vi.fn(
        (request) =>
          new URL(
            `solana:${request.recipient}?amount=12.34&spl-token=${MINT}&reference=${request.reference}`,
          ),
      ),
      verify: vi.fn(async (input) => ({
        found: true,
        reference: input.reference,
        recipient: input.recipient,
        amount: BigInt(input.amount),
        signature: "5XQqoA2BK2CAxyoLhYBU7dd1usTW1wMW3QDKMSmUeEwJ",
        slot: 299123456n,
        ...verification,
      })),
    },
  };
}

function context(adapter: ReturnType<typeof createAdapter>, userId = "user-1") {
  return {
    context: {
      adapter,
      session: { user: { id: userId }, session: { id: `session-${userId}` } },
      hasPlugin: () => false,
    },
    headers: new Headers(),
  };
}

describe("Solana payment routes", () => {
  it("creates a configured-recipient payment and persists the SDK mint and exact base-unit amount", async () => {
    const adapter = createAdapter();
    const client = createClient();
    const plugin = solanaPayments({ client: client as never, recipient: RECIPIENT });

    const payment = await plugin.endpoints.createPayment({
      ...context(adapter),
      body: { amount: "12340000", metadata: { orderId: "order-1" } },
    });

    expect(payment).toMatchObject({
      amount: "12340000",
      mint: MINT,
      recipient: RECIPIENT,
      status: "pending",
      paymentUrl: expect.stringContaining(`solana:${RECIPIENT}`),
    });
    expect(adapter.tables.solanaPayment).toHaveLength(1);
    expect(adapter.tables.solanaPayment?.[0]).toMatchObject({
      amount: "12340000",
      mint: MINT,
      recipient: RECIPIENT,
      metadata: JSON.stringify({ orderId: "order-1" }),
    });
  });

  it("rejects a verifier result whose amount or recipient does not exactly match the stored intent", async () => {
    const adapter = createAdapter();
    const client = createClient({ amount: 1n, recipient: "wrong-recipient" });
    const plugin = solanaPayments({ client: client as never, recipient: RECIPIENT });
    const created = await plugin.endpoints.createPayment({
      ...context(adapter),
      body: { amount: "12340000" },
    });

    await expect(
      plugin.endpoints.verifyPayment({
        ...context(adapter),
        body: { reference: created.reference },
      }),
    ).rejects.toMatchObject({ body: { code: "PAYMENT_MISMATCH" } });
    expect(client.payments.verify).toHaveBeenCalledWith({
      reference: created.reference,
      recipient: RECIPIENT,
      amount: "12340000",
    });
  });

  it("expires pending records, enforces ownership and invokes completion only for the first paid transition", async () => {
    const adapter = createAdapter();
    const callback = vi.fn();
    const plugin = solanaPayments({
      client: createClient() as never,
      recipient: RECIPIENT,
      paymentExpirationMs: 0,
      onPaymentComplete: callback,
    });
    const created = await plugin.endpoints.createPayment({
      ...context(adapter),
      body: { amount: "12340000" },
    });

    await expect(
      plugin.endpoints.getPayment({
        ...context(adapter, "other-user"),
        query: { reference: created.reference },
      }),
    ).rejects.toMatchObject({ body: { code: "UNAUTHORIZED_PAYMENT" } });
    await expect(
      plugin.endpoints.verifyPayment({
        ...context(adapter),
        body: { reference: created.reference },
      }),
    ).rejects.toMatchObject({ body: { code: "PAYMENT_EXPIRED" } });
    expect(callback).not.toHaveBeenCalled();
  });

  it("supports organization members and returns the stored paid result idempotently", async () => {
    const adapter = createAdapter({
      member: [{ id: "member-1", userId: "user-1", organizationId: "org-1" }],
    });
    const callback = vi.fn();
    const client = createClient();
    const plugin = solanaPayments({
      client: client as never,
      recipient: RECIPIENT,
      onPaymentComplete: callback,
    });
    const orgContext = {
      context: {
        adapter,
        session: { user: { id: "user-1" }, session: { id: "session-user-1" } },
        hasPlugin: (id: string) => id === "organization",
      },
      headers: new Headers(),
    };
    const created = await plugin.endpoints.createPayment({
      ...orgContext,
      body: { amount: "12340000", organizationId: "org-1" },
    });
    const first = await plugin.endpoints.verifyPayment({
      ...orgContext,
      body: { reference: created.reference, organizationId: "org-1" },
    });
    const retry = await plugin.endpoints.verifyPayment({
      ...orgContext,
      body: { reference: created.reference, organizationId: "org-1" },
    });

    expect(first).toMatchObject({
      status: "paid",
      reference: created.reference,
      slot: "299123456",
    });
    expect(retry).toEqual(first);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(client.payments.verify).toHaveBeenCalledTimes(1);
  });

  it("maps missing organization plugin and membership during payment creation to unauthorized payment", async () => {
    const adapter = createAdapter();
    const plugin = solanaPayments({ client: createClient() as never, recipient: RECIPIENT });

    await expect(
      plugin.endpoints.createPayment({
        ...context(adapter),
        body: { amount: "12340000", organizationId: "org-1" },
      }),
    ).rejects.toMatchObject({ body: { code: "UNAUTHORIZED_PAYMENT" } });
    await expect(
      plugin.endpoints.createPayment({
        ...context(adapter),
        context: {
          ...context(adapter).context,
          hasPlugin: (id: string) => id === "organization",
        },
        body: { amount: "12340000", organizationId: "org-1" },
      }),
    ).rejects.toMatchObject({ body: { code: "UNAUTHORIZED_PAYMENT" } });
  });

  it("does not convert adapter create failures into unauthorized payment errors", async () => {
    const adapter = createAdapter();
    adapter.create = async () => {
      throw new Error("database unavailable");
    };
    const plugin = solanaPayments({ client: createClient() as never, recipient: RECIPIENT });

    const error = await plugin.endpoints
      .createPayment({ ...context(adapter), body: { amount: "12340000" } })
      .catch((error: unknown) => error);

    expect(error).toMatchObject({ message: "database unavailable" });
    expect(error).not.toHaveProperty("body");
  });

  it("calls completion once when concurrent verification races for the pending transition", async () => {
    const adapter = createAdapter();
    const callback = vi.fn();
    const plugin = solanaPayments({
      client: createClient() as never,
      recipient: RECIPIENT,
      onPaymentComplete: callback,
    });
    const created = await plugin.endpoints.createPayment({
      ...context(adapter),
      body: { amount: "12340000" },
    });

    await Promise.all([
      plugin.endpoints.verifyPayment({
        ...context(adapter),
        body: { reference: created.reference },
      }),
      plugin.endpoints.verifyPayment({
        ...context(adapter),
        body: { reference: created.reference },
      }),
    ]);

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
