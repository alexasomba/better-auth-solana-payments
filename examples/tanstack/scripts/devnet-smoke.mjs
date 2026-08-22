const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const mint = process.env.SOLANA_MINT;
const recipient = process.env.SOLANA_RECIPIENT;
const decimals = Number(process.env.SOLANA_DECIMALS ?? "6");
const amount = process.env.SOLANA_AMOUNT ?? "1";
const signature = process.env.SOLANA_SIGNATURE;
const reference = process.env.SOLANA_REFERENCE;

console.log(`RPC URL: ${rpcUrl}`);

const rpcHealthy = await check("Devnet RPC health", async () => {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
  });
  if (!response.ok) throw new Error(`RPC returned HTTP ${response.status}.`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message ?? "RPC health check failed.");
  return body.result;
});

if (!rpcHealthy) process.exit(1);

if (!mint || !recipient) {
  console.log(
    "SKIP live payment request: set SOLANA_MINT and SOLANA_RECIPIENT to exercise the configured devnet token.",
  );
  process.exit(0);
}

const { createReadOnlySolanaPayments } = await import("solana-payments");
const client = createReadOnlySolanaPayments({
  rpcUrl,
  token: { mint, decimals, symbol: process.env.SOLANA_SYMBOL ?? "DEV-TOKEN" },
  commitment: "confirmed",
});

const request = client.payments.createRequest({ amount, recipient });
console.log("PASS SDK payment request");
console.log(
  JSON.stringify(
    {
      reference: request.reference,
      recipient: request.recipient,
      mint: request.mint,
      amount: request.amount.toString(),
      displayAmount: request.displayAmount,
    },
    null,
    2,
  ),
);

if (!signature || !reference) {
  console.log(
    "SKIP on-chain verification: after paying from a devnet wallet, rerun with SOLANA_SIGNATURE and SOLANA_REFERENCE.",
  );
  process.exit(0);
}

const verified = await check("On-chain payment verification", async () => {
  const result = await client.payments.verify({
    signature,
    reference,
    recipient,
    amount,
    maxPages: 3,
  });
  if (!result.found) throw new Error("The matching transfer was not found on devnet.");
  return {
    signature: result.signature,
    reference: result.reference,
    displayAmount: result.displayAmount,
    confirmationStatus: result.confirmationStatus,
  };
});

if (!verified) process.exit(1);

async function check(name, fn) {
  try {
    const result = await fn();
    console.log(`PASS ${name}: ${typeof result === "string" ? result : JSON.stringify(result)}`);
    return true;
  } catch (error) {
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}
