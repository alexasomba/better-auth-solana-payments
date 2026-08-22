import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: { useSession } }));

import { HomePage } from "@/routes/index";

describe("Solana example home route", () => {
  it("gates payment creation behind an authenticated session", () => {
    useSession.mockReturnValue({ data: null, isPending: false });
    render(<HomePage />);
    expect(screen.getByText("Sign in to create a payment")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create payment" })).not.toBeInTheDocument();
  });
});
