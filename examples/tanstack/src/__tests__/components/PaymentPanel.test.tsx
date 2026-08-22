import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

const { payment } = vi.hoisted(() => ({
  payment: {
    create: vi.fn(),
    get: vi.fn(),
    verify: vi.fn(),
  },
}));

vi.mock("@/lib/auth-client", () => ({ authClient: { payment } }));

import PaymentPanel from "@/components/PaymentPanel";

describe("Solana PaymentPanel", () => {
  it("creates an exact decimal-token payment and renders the wallet URL", async () => {
    payment.create.mockResolvedValue({
      data: {
        amount: "2500000",
        decimals: 6,
        mint: "mint-1",
        paymentUrl: "solana:recipient?amount=2.5",
        recipient: "recipient-1",
        reference: "payment-1",
        status: "pending",
      },
    });

    render(<PaymentPanel onCreated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Token amount"), { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Create payment" }));

    await waitFor(() =>
      expect(payment.create).toHaveBeenCalledWith({
        amount: "2.5",
        metadata: { source: "tanstack-solana-example" },
      }),
    );
    expect(await screen.findByRole("link", { name: /open in a solana wallet/i })).toHaveAttribute(
      "href",
      "solana:recipient?amount=2.5",
    );
    expect(screen.getByText("payment-1")).toBeInTheDocument();
  });

  it("verifies the current payment and displays the paid status", async () => {
    payment.create.mockResolvedValue({
      data: {
        amount: "1000000",
        decimals: 6,
        mint: "mint-1",
        paymentUrl: "solana:recipient?amount=1",
        recipient: "recipient-1",
        reference: "payment-2",
        status: "pending",
      },
    });
    payment.verify.mockResolvedValue({ data: { reference: "payment-2", status: "paid" } });

    render(<PaymentPanel onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Create payment" }));
    await screen.findByRole("button", { name: "Verify payment on-chain" });
    fireEvent.click(screen.getByRole("button", { name: "Verify payment on-chain" }));

    await waitFor(() => expect(payment.verify).toHaveBeenCalledWith({ reference: "payment-2" }));
    expect(await screen.findByText("paid")).toBeInTheDocument();
  });
});
