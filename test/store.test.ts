import { createSolanaPaymentStore } from "../src/store";

type Row = Record<string, unknown>;
type WhereClause = { field: string; value: unknown }[];

function createInMemoryAdapter(initial: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = structuredClone(initial);
  const matches = (row: Row, where: WhereClause = []) =>
    where.every(({ field, value }) => row[field] === value);

  return {
    adapter: {
      async create<T>({ model, data }: { model: string; data: Row }): Promise<T> {
        const row = { ...data, id: data.id ?? `${model}_${tables[model]?.length ?? 0}` };
        (tables[model] ??= []).push(row);
        return row as T;
      },
      async findOne<T>({
        model,
        where,
      }: {
        model: string;
        where?: WhereClause;
      }): Promise<T | null> {
        return (tables[model]?.find((row) => matches(row, where)) as T | undefined) ?? null;
      },
      async update<T>({
        model,
        update,
        where,
      }: {
        model: string;
        update: Row;
        where: WhereClause;
      }): Promise<T | null> {
        const row = tables[model]?.find((candidate) => matches(candidate, where));
        return row ? (Object.assign(row, update) as T) : null;
      },
    },
    tables,
  };
}

const payment = {
  reference: "reference-1",
  amount: "12345678901234567890",
  mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY1eWAPYxe5hQkzX",
  decimals: 6,
  recipient: "8VfCFVmXRBHtrMFxM41eNNFyqUhCGSzcKpM2gEuQ4pY1",
  expiresAt: new Date("2026-08-22T12:00:00.000Z"),
};

describe("Solana payment store", () => {
  it("creates and reads a user-owned payment without rounding its base-unit amount", async () => {
    const { adapter } = createInMemoryAdapter();
    const store = createSolanaPaymentStore({ adapter, session: { user: { id: "user-1" } } });

    const created = await store.create(payment);

    expect(created).toMatchObject({
      ...payment,
      amount: "12345678901234567890",
      referenceType: "user",
      referenceId: "user-1",
      status: "pending",
    });
    await expect(store.findById(created.id)).resolves.toMatchObject({ id: created.id });
    await expect(store.findByReference(payment.reference)).resolves.toMatchObject({
      id: created.id,
    });
  });

  it("marks a pending payment paid once and returns the same paid record on retry", async () => {
    const { adapter } = createInMemoryAdapter();
    const store = createSolanaPaymentStore({ adapter, session: { user: { id: "user-1" } } });
    await store.create(payment);

    const paid = await store.markPaid(payment.reference, {
      signature: "5XQqoA2BK2CAxyoLhYBU7dd1usTW1wMW3QDKMSmUeEwJ",
      slot: "299123456",
    });
    const retried = await store.markPaid(payment.reference, {
      signature: "different-signature-must-not-overwrite",
      slot: "299123457",
    });

    expect(paid).toMatchObject({ status: "paid", slot: "299123456" });
    expect(retried).toEqual(paid);
  });

  it("requires an authenticated member for organization-owned reads and writes", async () => {
    const { adapter } = createInMemoryAdapter({
      member: [{ id: "member-1", userId: "user-1", organizationId: "organization-1" }],
    });
    const store = createSolanaPaymentStore({
      adapter,
      session: { user: { id: "user-1" } },
      organizationId: "organization-1",
      hasOrganizationPlugin: true,
    });

    const created = await store.create(payment);

    expect(created).toMatchObject({ referenceType: "organization", referenceId: "organization-1" });
    await expect(store.findByReference(payment.reference)).resolves.toMatchObject({
      id: created.id,
    });
  });

  it("rejects organization access when the organization plugin or membership is absent", async () => {
    const { adapter } = createInMemoryAdapter();

    const withoutPlugin = createSolanaPaymentStore({
      adapter,
      session: { user: { id: "user-1" } },
      organizationId: "organization-1",
      hasOrganizationPlugin: false,
    });
    const withoutMembership = createSolanaPaymentStore({
      adapter,
      session: { user: { id: "user-1" } },
      organizationId: "organization-1",
      hasOrganizationPlugin: true,
    });

    await expect(withoutPlugin.create(payment)).rejects.toThrow("organization plugin");
    await expect(withoutMembership.create(payment)).rejects.toThrow("organization member");
  });
});
