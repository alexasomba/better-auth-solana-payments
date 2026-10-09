import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vite-plus/test";

it("preserves fulfilled legacy payments while adding durable retry fields", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`CREATE TABLE solanaPayment (id TEXT PRIMARY KEY, status TEXT NOT NULL);
      INSERT INTO solanaPayment VALUES ('paid', 'paid'), ('pending', 'pending');`);
    db.exec(readFileSync(new URL("../migrations/0.2.0-sqlite.sql", import.meta.url), "utf8"));
    expect(
      db
        .prepare(
          "SELECT fulfillmentStatus, fulfillmentToken, fulfillmentClaimedAt FROM solanaPayment WHERE id = ?",
        )
        .get("paid"),
    ).toMatchObject({
      fulfillmentStatus: "completed",
      fulfillmentToken: null,
      fulfillmentClaimedAt: null,
    });
    expect(
      db.prepare("SELECT fulfillmentStatus FROM solanaPayment WHERE id = ?").get("pending"),
    ).toMatchObject({ fulfillmentStatus: "pending" });
  } finally {
    db.close();
  }
});
