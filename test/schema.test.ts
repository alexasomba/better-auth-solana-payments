import { getSchema } from "../src/schema.ts";

describe("Solana payment schema", () => {
  it("defines the Solana payment persistence fields", () => {
    const schema = getSchema({});
    const fields = schema.solanaPayment?.fields;

    expect(fields).toMatchObject({
      reference: { type: "string", required: true, unique: true },
      referenceType: { type: "string", required: true },
      referenceId: { type: "string", required: true, index: true },
      amount: { type: "string", required: true },
      mint: { type: "string", required: true },
      decimals: { type: "number", required: true },
      recipient: { type: "string", required: true },
      status: { type: "string", required: true, defaultValue: "pending" },
      expiresAt: { type: "date", required: true },
      createdAt: { type: "date", required: true },
      updatedAt: { type: "date", required: true },
    });
  });
});
