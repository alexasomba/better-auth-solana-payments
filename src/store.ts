import type { SolanaPayment } from "./types";

const SOLANA_PAYMENT_MODEL = "solanaPayment";

type Adapter = {
  create<T>(input: { model: string; data: Omit<T, "id"> }): Promise<T>;
  findOne<T>(input: { model: string; where: WhereClause }): Promise<T | null>;
  update<T>(input: { model: string; update: Partial<T>; where: WhereClause }): Promise<T | null>;
};
type WhereClause = { field: string; value: string }[];

export interface SolanaPaymentStoreContext {
  adapter: Adapter;
  session?: { user?: { id: string } | null } | null;
  organizationId?: string;
  hasOrganizationPlugin?: boolean;
}

export type CreateSolanaPaymentInput = Omit<
  SolanaPayment,
  "id" | "referenceType" | "referenceId" | "status" | "createdAt" | "updatedAt"
>;

export interface MarkPaidInput {
  signature?: string;
  slot?: string;
}

export interface SolanaPaymentStore {
  create(input: CreateSolanaPaymentInput): Promise<SolanaPayment>;
  findById(id: string): Promise<SolanaPayment | null>;
  findByReference(reference: string): Promise<SolanaPayment | null>;
  markPaid(reference: string, input?: MarkPaidInput): Promise<SolanaPayment | null>;
  markExpired(reference: string): Promise<SolanaPayment | null>;
}

export function createSolanaPaymentStore(context: SolanaPaymentStoreContext): SolanaPaymentStore {
  const getOwner = async (): Promise<{ type: "user" | "organization"; id: string }> => {
    const userId = context.session?.user?.id;
    if (!userId) throw new Error("A session user is required to access Solana payments");

    if (!context.organizationId) return { type: "user", id: userId };
    if (!context.hasOrganizationPlugin) {
      throw new Error("The Better Auth organization plugin is required for organization payments");
    }

    const member = await context.adapter.findOne<{ id: string }>({
      model: "member",
      where: [
        { field: "organizationId", value: context.organizationId },
        { field: "userId", value: userId },
      ],
    });
    if (!member) throw new Error("The session user must be an organization member");
    return { type: "organization", id: context.organizationId };
  };

  const paymentWhere = async (where: WhereClause): Promise<WhereClause> => {
    const owner = await getOwner();
    return [
      ...where,
      { field: "referenceType", value: owner.type },
      { field: "referenceId", value: owner.id },
    ];
  };

  const findByReference = async (reference: string): Promise<SolanaPayment | null> =>
    context.adapter.findOne<SolanaPayment>({
      model: SOLANA_PAYMENT_MODEL,
      where: await paymentWhere([{ field: "reference", value: reference }]),
    });

  return {
    async create(input) {
      const owner = await getOwner();
      const now = new Date();
      return context.adapter.create<SolanaPayment>({
        model: SOLANA_PAYMENT_MODEL,
        data: {
          ...input,
          referenceType: owner.type,
          referenceId: owner.id,
          status: "pending",
          createdAt: now,
          updatedAt: now,
        },
      });
    },
    findById: async (id) =>
      context.adapter.findOne<SolanaPayment>({
        model: SOLANA_PAYMENT_MODEL,
        where: await paymentWhere([{ field: "id", value: id }]),
      }),
    findByReference,
    async markPaid(reference, input = {}) {
      const payment = await findByReference(reference);
      if (!payment || payment.status === "paid") return payment;
      if (payment.status !== "pending") return null;

      return context.adapter.update<SolanaPayment>({
        model: SOLANA_PAYMENT_MODEL,
        update: { status: "paid", ...input, updatedAt: new Date() },
        where: await paymentWhere([
          { field: "id", value: payment.id },
          { field: "status", value: "pending" },
        ]),
      });
    },
    async markExpired(reference) {
      const payment = await findByReference(reference);
      if (!payment || payment.status !== "pending")
        return payment?.status === "expired" ? payment : null;

      return context.adapter.update<SolanaPayment>({
        model: SOLANA_PAYMENT_MODEL,
        update: { status: "expired", updatedAt: new Date() },
        where: await paymentWhere([
          { field: "id", value: payment.id },
          { field: "status", value: "pending" },
        ]),
      });
    },
  };
}
