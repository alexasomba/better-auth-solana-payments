import { createAuthClient } from "better-auth/react";
import { solanaPaymentsClient } from "better-auth-solana-payments/client";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.VITE_BETTER_AUTH_URL ?? "http://localhost:3000"),
  plugins: [solanaPaymentsClient()],
});
