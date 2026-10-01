import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
const folder = process.env.STOCKDESK_DATA_DIR || path.resolve(".data");
mkdirSync(folder, { recursive: true });
export const db = new DatabaseSync(path.join(folder, "stockdesk.sqlite"));
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,session TEXT NOT NULL,name TEXT NOT NULL,sku TEXT NOT NULL,category TEXT NOT NULL,price INTEGER NOT NULL,cost INTEGER NOT NULL,stock INTEGER NOT NULL CHECK(stock>=0),reorder INTEGER NOT NULL,archived INTEGER NOT NULL DEFAULT 0,UNIQUE(session,sku));
CREATE INDEX IF NOT EXISTS idx_products_session ON products(session,archived);
CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY,session TEXT NOT NULL,name TEXT NOT NULL,email TEXT NOT NULL,phone TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_customers_session ON customers(session);
CREATE TABLE IF NOT EXISTS sales(id TEXT PRIMARY KEY,session TEXT NOT NULL,customer TEXT NOT NULL,items TEXT NOT NULL,total INTEGER NOT NULL,cost INTEGER NOT NULL,status TEXT NOT NULL,created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_sales_session ON sales(session,created);
CREATE TABLE IF NOT EXISTS movements(id TEXT PRIMARY KEY,session TEXT NOT NULL,product TEXT NOT NULL,name TEXT NOT NULL,quantity INTEGER NOT NULL,reason TEXT NOT NULL,created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_movements_session ON movements(session,created);`);
export function transaction(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function seed(id) {
  transaction(() => {
    db.prepare("INSERT INTO sessions VALUES(?,?)").run(id, Date.now());
    const rows = [
      ["Wireless Mouse", "ACC-101", "Accessories", 145000, 90000, 35, 8],
      ["USB-C Hub", "ACC-102", "Accessories", 420000, 300000, 7, 10],
      ["Mechanical Keyboard", "ACC-103", "Accessories", 690000, 460000, 18, 5],
      ["Desk Lamp", "OFF-201", "Office", 280000, 175000, 24, 6],
      ["Notebook Set", "OFF-202", "Office", 65000, 38000, 48, 12],
      ["Laptop Stand", "ACC-104", "Accessories", 235000, 150000, 4, 8],
      ["Water Bottle", "LIF-301", "Lifestyle", 120000, 75000, 29, 6],
      ["Desk Organiser", "OFF-203", "Office", 180000, 110000, 16, 5],
    ];
    const insert = db.prepare(
      "INSERT INTO products(id,session,name,sku,category,price,cost,stock,reorder) VALUES(?,?,?,?,?,?,?,?,?)",
    );
    for (const row of rows) insert.run(crypto.randomUUID(), id, ...row);
    db.prepare("INSERT INTO customers VALUES(?,?,?,?,?)").run(
      crypto.randomUUID(),
      id,
      "Demo Customer",
      "demo@example.com",
      "03000000000",
    );
  });
}
export function state(id) {
  return {
    products: db
      .prepare(
        "SELECT * FROM products WHERE session=? AND archived=0 ORDER BY name",
      )
      .all(id)
      .map(({ session, ...v }) => v),
    customers: db
      .prepare(
        "SELECT id,name,email,phone FROM customers WHERE session=? ORDER BY name",
      )
      .all(id),
    sales: db
      .prepare("SELECT * FROM sales WHERE session=? ORDER BY created DESC")
      .all(id)
      .map(({ session, items, ...v }) => ({ ...v, items: JSON.parse(items) })),
    movements: db
      .prepare(
        "SELECT id,product,name,quantity,reason,created FROM movements WHERE session=? ORDER BY created DESC LIMIT 100",
      )
      .all(id),
  };
}
