import { eq } from "drizzle-orm";
import { sandboxes } from "sandock-core/db/schema";
import { getDb } from "~/db";

async function main() {
  const db = await getDb();
  const [inserted] = await db
    .insert(sandboxes)
    .values({
      userId: "verify-user",
      spaceId: null,
      title: "verify-sandbox",
      provider: "LOCAL",
      status: "CREATING",
    })
    .returning();
  console.log("inserted:", inserted.id, inserted.title, inserted.status);

  const [selected] = await db.select().from(sandboxes).where(eq(sandboxes.id, inserted.id));
  if (!selected || selected.title !== "verify-sandbox") {
    throw new Error("verification failed: row not found or mismatched after select");
  }
  console.log("selected OK:", selected.id, selected.title);

  await db.delete(sandboxes).where(eq(sandboxes.id, inserted.id));
  console.log("cleanup OK");
}

main()
  .then(() => {
    console.log("VERIFY_DB_OK");
    process.exit(0);
  })
  .catch((e) => {
    console.error("VERIFY_DB_FAILED", e);
    process.exit(1);
  });
