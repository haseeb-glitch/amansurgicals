import { DatabaseSync } from "node:sqlite";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env if present
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    const value = rest.join("=").replace(/^["']|["']$/g, "").trim();
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes("your-project-id")) {
  console.error("Please add your real SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env before running this script.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const localDbPath = resolve(
  process.cwd(),
  ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/faaf2b0445ab934c3aac48ddf0cdfade8f9bac050be98993748742cdd2cb05fb.sqlite"
);

if (!existsSync(localDbPath)) {
  console.error("No local SQLite database found at:", localDbPath);
  process.exit(1);
}

async function run() {
  console.log("Connecting to local SQLite database...");
  const db = new DatabaseSync(localDbPath);

  console.log("Reading local data...");

  const customers = db.prepare("SELECT key, data FROM customers").all();
  const products = db.prepare("SELECT key, data FROM products").all();
  const sales = db.prepare("SELECT number, id, data, revision, created_at, updated_at, deleted_at FROM sales").all();
  const revisions = db.prepare("SELECT id, sale_id, revision, data, saved_at FROM revisions").all();

  console.log(`Found:`);
  console.log(`- ${customers.length} customers`);
  console.log(`- ${products.length} products`);
  console.log(`- ${sales.length} sales`);
  console.log(`- ${revisions.length} revisions`);

  if (customers.length > 0) {
    console.log("Migrating customers to Supabase...");
    const { error } = await supabase.from("customers").upsert(customers, { onConflict: "key" });
    if (error) console.error("Error migrating customers:", error.message);
    else console.log("Customers migrated successfully.");
  }

  if (products.length > 0) {
    console.log("Migrating products to Supabase...");
    const { error } = await supabase.from("products").upsert(products, { onConflict: "key" });
    if (error) console.error("Error migrating products:", error.message);
    else console.log("Products migrated successfully.");
  }

  if (sales.length > 0) {
    console.log("Migrating sales to Supabase...");
    for (const sale of sales) {
      const { error } = await supabase.from("sales").upsert(sale, { onConflict: "id" });
      if (error) console.error(`Error migrating sale ${sale.id}:`, error.message);
    }
    console.log("Sales migrated successfully.");
  }

  if (revisions.length > 0) {
    console.log("Migrating revisions to Supabase...");
    for (const rev of revisions) {
      const { error } = await supabase.from("revisions").upsert(rev, { onConflict: "id" });
      if (error) console.error(`Error migrating revision ${rev.id}:`, error.message);
    }
    console.log("Revisions migrated successfully.");
  }

  db.close();
  console.log("Migration complete!");
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
