import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sales = sqliteTable("sales", {
  number: integer("number").primaryKey({ autoIncrement: true }),
  id: text("id").notNull().unique(),
  data: text("data").notNull(),
  revision: integer("revision").notNull().default(1),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
});

export const revisions = sqliteTable("revisions", {
  id: text("id").primaryKey(),
  saleId: text("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
  revision: integer("revision").notNull(),
  data: text("data").notNull(),
  savedAt: integer("saved_at").notNull(),
});

export const customers = sqliteTable("customers", {
  key: text("key").primaryKey(),
  data: text("data").notNull(),
});

export const products = sqliteTable("products", {
  key: text("key").primaryKey(),
  data: text("data").notNull(),
});
