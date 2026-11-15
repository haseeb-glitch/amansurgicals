import { env } from "cloudflare:workers";
import { getUser } from "../../auth";
import { cleanNumber, cleanSale, cleanText, normalized, retention } from "../../../lib/sales";
import { getSupabase } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

function database() {
  if (!env.DB) throw new Error("Database binding unavailable");
  return env.DB;
}

function decode(row: Record<string, unknown>) {
  return { ...row, data: typeof row.data === "string" ? JSON.parse(row.data) : row.data };
}

const saleColumns = "id, number, data, revision, created_at AS createdAt, updated_at AS updatedAt, deleted_at AS deletedAt";

export async function GET(request: Request) {
  if (!(await getUser())) return reply({ error: "Sign in to access this workspace." }, 401);

  const supabase = getSupabase();
  const history = new URL(request.url).searchParams.get("history");

  try {
    if (supabase) {
      if (history) {
        const { data, error } = await supabase
          .from("revisions")
          .select("revision, saved_at, data")
          .eq("sale_id", history)
          .order("revision", { ascending: false });

        if (error) throw error;
        return reply(
          (data || []).map((r) => ({
            revision: r.revision,
            savedAt: r.saved_at,
            data: typeof r.data === "string" ? JSON.parse(r.data) : r.data,
          }))
        );
      }

      // Expire old trash records
      await supabase.from("sales").delete().lte("deleted_at", Date.now() - retention);

      const [salesRes, customersRes, productsRes] = await Promise.all([
        supabase
          .from("sales")
          .select("id, number, data, revision, created_at, updated_at, deleted_at")
          .order("number", { ascending: false }),
        supabase.from("customers").select("data").order("key"),
        supabase.from("products").select("data").order("key"),
      ]);

      if (salesRes.error) throw salesRes.error;
      if (customersRes.error) throw customersRes.error;
      if (productsRes.error) throw productsRes.error;

      return reply({
        rows: (salesRes.data || []).map((r) => ({
          id: r.id,
          number: Number(r.number),
          data: typeof r.data === "string" ? JSON.parse(r.data) : r.data,
          revision: r.revision,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          deletedAt: r.deleted_at,
        })),
        customers: (customersRes.data || []).map((c) =>
          typeof c.data === "string" ? JSON.parse(c.data) : c.data
        ),
        products: (productsRes.data || []).map((p) =>
          typeof p.data === "string" ? JSON.parse(p.data) : p.data
        ),
        storage: "supabase",
      });
    }

    // Fallback: Local Cloudflare D1
    const db = database();
    if (history) {
      const { results } = await db
        .prepare(
          "SELECT r.revision, r.saved_at AS savedAt, r.data FROM revisions r JOIN sales s ON r.sale_id = s.id WHERE s.id = ? AND s.deleted_at IS NULL ORDER BY r.revision DESC"
        )
        .bind(history)
        .all();
      return reply(results.map(decode));
    }

    await db.prepare("DELETE FROM sales WHERE deleted_at <= ?").bind(Date.now() - retention).run();
    const [rows, customers, products] = await db.batch<Record<string, unknown>>([
      db.prepare("SELECT " + saleColumns + " FROM sales ORDER BY number DESC"),
      db.prepare("SELECT data FROM customers ORDER BY key"),
      db.prepare("SELECT data FROM products ORDER BY key"),
    ]);

    return reply({
      rows: rows.results.map(decode),
      customers: customers.results.map((row) => JSON.parse(String(row.data))),
      products: products.results.map((row) => JSON.parse(String(row.data))),
      storage: "local",
    });
  } catch (error) {
    console.error("Workspace read failed", error instanceof Error ? error.message : "Unknown error");
    return reply({ error: "The workspace could not load. Please retry." }, 503);
  }
}

export async function POST(request: Request) {
  if (!(await getUser())) return reply({ error: "Sign in to access this workspace." }, 401);
  if (
    request.headers.get("origin") !== new URL(request.url).origin ||
    !request.headers.get("content-type")?.includes("application/json")
  ) {
    return reply({ error: "Invalid request origin or format." }, 403);
  }

  let body;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return reply({ error: "Invalid request." }, 400);
  }
  if (!body || typeof body !== "object") return reply({ error: "Invalid request." }, 400);

  const { action } = body;
  const id = cleanText(body.id, 70);
  const now = Date.now();
  let payload: string | null = null;

  try {
    if (action === "create" || action === "update") payload = JSON.stringify(cleanSale(body.data));
    if (action === "customer")
      payload = JSON.stringify({
        name: cleanText(body.name),
        city: cleanText(body.city),
        fee: cleanNumber(body.fee, true),
      });
    if (action === "product")
      payload = JSON.stringify({
        name: cleanText(body.name),
        rate: cleanNumber(body.rate),
        cost: cleanNumber(body.cost),
      });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Check the entry values." }, 400);
  }

  const supabase = getSupabase();

  try {
    if (supabase) {
      if (action === "create" && payload && /^[a-f0-9-]{36}$/.test(id)) {
        const { data: inserted, error: insertErr } = await supabase
          .from("sales")
          .insert({ id, data: payload, created_at: now, updated_at: now, revision: 1 })
          .select("id, number, data, revision, created_at, updated_at, deleted_at")
          .single();

        if (insertErr) {
          const { data: existing } = await supabase
            .from("sales")
            .select("id, number, data, revision, created_at, updated_at, deleted_at")
            .eq("id", id)
            .is("deleted_at", null)
            .maybeSingle();

          if (existing) {
            return reply({
              id: existing.id,
              number: Number(existing.number),
              data: typeof existing.data === "string" ? JSON.parse(existing.data) : existing.data,
              revision: existing.revision,
              createdAt: existing.created_at,
              updatedAt: existing.updated_at,
              deletedAt: existing.deleted_at,
            });
          }
          return reply({ error: "This entry is in Trash." }, 409);
        }

        await supabase.from("revisions").upsert({
          id: `${id}:1`,
          sale_id: id,
          revision: 1,
          data: payload,
          saved_at: now,
        });

        return reply({
          id: inserted.id,
          number: Number(inserted.number),
          data: typeof inserted.data === "string" ? JSON.parse(inserted.data) : inserted.data,
          revision: inserted.revision,
          createdAt: inserted.created_at,
          updatedAt: inserted.updated_at,
          deletedAt: inserted.deleted_at,
        });
      }

      if (action === "update" && payload && Number.isSafeInteger(body.revision)) {
        const revision = Number(body.revision);
        const revisionId = crypto.randomUUID();

        const { data: updated, error: updateErr } = await supabase
          .from("sales")
          .update({ data: payload, revision: revision + 1, updated_at: now })
          .eq("id", id)
          .eq("revision", revision)
          .is("deleted_at", null)
          .select("id");

        if (updateErr || !updated || updated.length === 0) {
          return reply({ error: "This record changed. Refresh before updating it again." }, 409);
        }

        await supabase.from("revisions").insert({
          id: revisionId,
          sale_id: id,
          revision: revision + 1,
          data: payload,
          saved_at: now,
        });

        return reply({ ok: true });
      }

      if (action === "trash" || action === "restore") {
        const revision = Number(body.revision);
        if (!Number.isSafeInteger(revision)) return reply({ error: "Missing record version." }, 400);

        if (action === "trash") {
          const { data: trashed } = await supabase
            .from("sales")
            .update({ deleted_at: now, revision: revision + 1 })
            .eq("id", id)
            .eq("revision", revision)
            .is("deleted_at", null)
            .select("id");

          return trashed && trashed.length > 0
            ? reply({ ok: true })
            : reply({ error: "This record changed or its Trash period expired. Refresh to see the latest state." }, 409);
        } else {
          const { data: restored } = await supabase
            .from("sales")
            .update({ deleted_at: null, revision: revision + 1 })
            .eq("id", id)
            .eq("revision", revision)
            .gt("deleted_at", now - retention)
            .select("id");

          return restored && restored.length > 0
            ? reply({ ok: true })
            : reply({ error: "This record changed or its Trash period expired. Refresh to see the latest state." }, 409);
        }
      }

      if ((action === "customer" || action === "product") && payload) {
        const key = normalized(cleanText(body.name));
        if (!key) return reply({ error: "Enter a name for this saved profile." }, 400);
        const table = action === "customer" ? "customers" : "products";
        const { error } = await supabase.from(table).upsert({ key, data: payload }, { onConflict: "key" });
        if (error) throw error;
        return reply({ ok: true });
      }

      return reply({ error: "Unknown action or incomplete request." }, 400);
    }

    // Fallback: Local Cloudflare D1
    const db = database();
    if (action === "create" && payload && /^[a-f0-9-]{36}$/.test(id)) {
      const [result] = await db.batch<Record<string, unknown>>([
        db
          .prepare(
            "INSERT INTO sales (id, data, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING RETURNING " +
              saleColumns
          )
          .bind(id, payload, now, now),
        db
          .prepare(
            "INSERT OR IGNORE INTO revisions (id, sale_id, revision, data, saved_at) SELECT id || ':1', id, 1, data, created_at FROM sales WHERE id = ? AND revision = 1"
          )
          .bind(id),
      ]);
      const row =
        result.results[0] ??
        (await db.prepare("SELECT " + saleColumns + " FROM sales WHERE id = ? AND deleted_at IS NULL").bind(id).first());
      return row ? reply(decode(row)) : reply({ error: "This entry is in Trash." }, 409);
    }
    if (action === "update" && payload && Number.isSafeInteger(body.revision)) {
      const revision = Number(body.revision);
      const revisionId = crypto.randomUUID();
      const [saved] = await db.batch([
        db
          .prepare(
            "INSERT INTO revisions (id, sale_id, revision, data, saved_at) SELECT ?, id, revision + 1, ?, ? FROM sales WHERE id = ? AND revision = ? AND deleted_at IS NULL"
          )
          .bind(revisionId, payload, now, id, revision),
        db
          .prepare(
            "UPDATE sales SET data = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND deleted_at IS NULL"
          )
          .bind(payload, now, id, revision),
      ]);
      if (!saved.meta.changes) return reply({ error: "This record changed. Refresh before updating it again." }, 409);
      return reply({ ok: true });
    }
    if (action === "trash" || action === "restore") {
      const revision = Number(body.revision);
      if (!Number.isSafeInteger(revision)) return reply({ error: "Missing record version." }, 400);
      const result =
        action === "trash"
          ? await db
              .prepare(
                "UPDATE sales SET deleted_at = ?, revision = revision + 1 WHERE id = ? AND revision = ? AND deleted_at IS NULL"
              )
              .bind(now, id, revision)
              .run()
          : await db
              .prepare(
                "UPDATE sales SET deleted_at = NULL, revision = revision + 1 WHERE id = ? AND revision = ? AND deleted_at > ?"
              )
              .bind(id, revision, now - retention)
              .run();
      return result.meta.changes
        ? reply({ ok: true })
        : reply({ error: "This record changed or its Trash period expired. Refresh to see the latest state." }, 409);
    }
    if ((action === "customer" || action === "product") && payload) {
      const key = normalized(cleanText(body.name));
      if (!key) return reply({ error: "Enter a name for this saved profile." }, 400);
      const table = action === "customer" ? "customers" : "products";
      await db
        .prepare("INSERT INTO " + table + " (key, data) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET data = excluded.data")
        .bind(key, payload)
        .run();
      return reply({ ok: true });
    }
    return reply({ error: "Unknown action or incomplete request." }, 400);
  } catch (error) {
    console.error("Workspace write failed", error instanceof Error ? error.message : "Unknown error");
    return reply({ error: "The change could not be saved. Please retry." }, 503);
  }
}
