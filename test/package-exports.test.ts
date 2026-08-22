import { solanaPayments } from "../src/index";
import { solanaPaymentsClient } from "../src/client";

describe("package exports", () => {
  it("exposes server and client plugin factories", () => {
    expect(solanaPayments).toBeTypeOf("function");
    expect(solanaPaymentsClient).toBeTypeOf("function");
  });
});
