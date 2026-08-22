import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { solanaPayments } from "better-auth-solana-payments";
import { createReadOnlySolanaPayments } from "solana-payments";

const developmentDefaults = {
  rpcUrl: "https://api.devnet.solana.com",
  mint: "11111111111111111111111111111111",
  recipient: "11111111111111111111111111111111",
};

const data: Record<string, unknown[]> = {
  user: [],
  session: [],
  account: [],
  verification: [],
  solanaPayment: [],
};

const token = {
  mint: process.env.SOLANA_MINT ?? developmentDefaults.mint,
  decimals: Number(process.env.SOLANA_DECIMALS ?? "6"),
  symbol: process.env.SOLANA_SYMBOL ?? "DEV-TOKEN",
};

const solanaClient = createReadOnlySolanaPayments({
  rpcUrl: process.env.SOLANA_RPC_URL ?? developmentDefaults.rpcUrl,
  token,
  commitment: "confirmed",
});

export const auth = betterAuth({
  appName: "Better Auth Solana Payments TanStack Example",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET ?? "local-development-secret-change-this-before-deploying",
  database: memoryAdapter(data),
  emailAndPassword: { enabled: true },
  plugins: [
    solanaPayments({
      client: solanaClient,
      recipient: process.env.SOLANA_RECIPIENT ?? developmentDefaults.recipient,
    }),
    tanstackStartCookies(),
  ],
});
