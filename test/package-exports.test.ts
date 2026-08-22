import { getSchema, solanaPayments } from "../src/index.ts";
import { solanaPaymentsClient } from "../src/client.ts";

describe("package exports", () => {
  it("exposes server and client plugin factories", () => {
    expect(solanaPayments).toBeTypeOf("function");
    expect(solanaPaymentsClient).toBeTypeOf("function");
    expect(getSchema).toBeTypeOf("function");
  });
});
