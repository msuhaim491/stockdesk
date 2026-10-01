import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { db, seed, state, transaction } from "./db.mjs";
const port = Number(process.env.PORT || 5181);
const uuid = z.string().uuid();
const short = z.string().trim().min(2).max(80);
const product = z.object({
  id: uuid,
  name: short,
  sku: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/),
  category: short,
  price: z.number().int().min(1).max(100000000),
  cost: z.number().int().min(0).max(100000000),
  stock: z.number().int().min(0).max(100000),
  reorder: z.number().int().min(0).max(100000),
});
function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
function validate(schema, value) {
  const r = schema.safeParse(value);
  if (!r.success) fail(r.error.issues[0].message);
  return r.data;
}
function mutate(id, b) {
  if (!b || typeof b !== "object") fail("Invalid request.");
  if (b.action === "product") {
    const p = validate(product, b.product);
    const existing = db
      .prepare("SELECT id FROM products WHERE id=? AND session=?")
      .get(p.id, id);
    transaction(() => {
      if (existing)
        db.prepare(
          "UPDATE products SET name=?,sku=?,category=?,price=?,cost=?,reorder=? WHERE id=? AND session=?",
        ).run(p.name, p.sku, p.category, p.price, p.cost, p.reorder, p.id, id);
      else {
        if (db.prepare("SELECT id FROM products WHERE id=?").get(p.id))
          fail("Product ID unavailable.", 409);
        db.prepare(
          "INSERT INTO products(id,session,name,sku,category,price,cost,stock,reorder) VALUES(?,?,?,?,?,?,?,?,?)",
        ).run(
          p.id,
          id,
          p.name,
          p.sku,
          p.category,
          p.price,
          p.cost,
          p.stock,
          p.reorder,
        );
        if (p.stock)
          db.prepare("INSERT INTO movements VALUES(?,?,?,?,?,?,?)").run(
            randomUUID(),
            id,
            p.id,
            p.name,
            p.stock,
            "Opening stock",
            Date.now(),
          );
      }
    });
  } else if (b.action === "stock") {
    const p = validate(
      z.object({
        id: uuid,
        quantity: z
          .number()
          .int()
          .min(-100000)
          .max(100000)
          .refine((n) => n !== 0),
        reason: short,
      }),
      b,
    );
    transaction(() => {
      const item = db
        .prepare(
          "SELECT * FROM products WHERE id=? AND session=? AND archived=0",
        )
        .get(p.id, id);
      if (!item) fail("Product not found.", 404);
      if (item.stock + p.quantity < 0) fail("Stock cannot go below zero.", 409);
      db.prepare("UPDATE products SET stock=stock+? WHERE id=?").run(
        p.quantity,
        p.id,
      );
      db.prepare("INSERT INTO movements VALUES(?,?,?,?,?,?,?)").run(
        randomUUID(),
        id,
        p.id,
        item.name,
        p.quantity,
        p.reason,
        Date.now(),
      );
    });
  } else if (b.action === "archive") {
    const pid = validate(uuid, b.id);
    const item = db.prepare("SELECT stock FROM products WHERE id=? AND session=? AND archived=0").get(pid, id);
    if (!item) fail("Product not found.", 404);
    if (item.stock !== 0) fail("Adjust the remaining stock to zero before archiving this product.", 409);
    db.prepare("UPDATE products SET archived=1 WHERE id=? AND session=?").run(
      pid,
      id,
    );
  } else if (b.action === "customer") {
    const c = validate(
      z.object({
        id: uuid,
        name: short,
        email: z
          .string()
          .trim()
          .max(120)
          .refine(
            (s) => s === "" || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s),
            "Enter a valid email.",
          ),
        phone: z.string().trim().max(30),
      }),
      b.customer,
    );
    const other = db
      .prepare("SELECT session FROM customers WHERE id=?")
      .get(c.id);
    if (other && other.session !== id) fail("Customer unavailable.", 404);
    db.prepare(
      "INSERT INTO customers VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,phone=excluded.phone",
    ).run(c.id, id, c.name, c.email, c.phone);
  } else if (b.action === "sale") {
    const sale = validate(
      z.object({
        id: uuid,
        customerId: z.union([uuid, z.literal("")]),
        items: z
          .array(
            z.object({ id: uuid, quantity: z.number().int().min(1).max(1000) }),
          )
          .min(1)
          .max(50),
      }),
      b.sale,
    );
    transaction(() => {
      const existing = db
        .prepare("SELECT session FROM sales WHERE id=?")
        .get(sale.id);
      if (existing) {
        if (existing.session !== id) fail("Invoice unavailable.", 409);
        return;
      }
      const seen = new Set();
      const lines = [];
      let total = 0,
        cost = 0;
      for (const line of sale.items) {
        if (seen.has(line.id)) fail("Duplicate product.");
        seen.add(line.id);
        const p = db
          .prepare(
            "SELECT * FROM products WHERE id=? AND session=? AND archived=0",
          )
          .get(line.id, id);
        if (!p) fail("A selected product is unavailable.", 409);
        if (p.stock < line.quantity)
          fail(`Only ${p.stock} units of ${p.name} are available.`, 409);
        lines.push({
          id: p.id,
          name: p.name,
          sku: p.sku,
          quantity: line.quantity,
          price: p.price,
          cost: p.cost,
        });
        total += p.price * line.quantity;
        cost += p.cost * line.quantity;
        db.prepare("UPDATE products SET stock=stock-? WHERE id=?").run(
          line.quantity,
          p.id,
        );
        db.prepare("INSERT INTO movements VALUES(?,?,?,?,?,?,?)").run(
          randomUUID(),
          id,
          p.id,
          p.name,
          -line.quantity,
          "Sale " + sale.id.slice(0, 8).toUpperCase(),
          Date.now(),
        );
      }
      let customer = "Walk-in customer";
      if (sale.customerId) {
        const c = db
          .prepare("SELECT name FROM customers WHERE id=? AND session=?")
          .get(sale.customerId, id);
        if (!c) fail("Customer not found.", 404);
        customer = c.name;
      }
      db.prepare("INSERT INTO sales VALUES(?,?,?,?,?,?,?,?)").run(
        sale.id,
        id,
        customer,
        JSON.stringify(lines),
        total,
        cost,
        "completed",
        Date.now(),
      );
    });
  } else if (b.action === "void") {
    const sid = validate(uuid, b.id);
    transaction(() => {
      const sale = db
        .prepare("SELECT * FROM sales WHERE id=? AND session=?")
        .get(sid, id);
      if (!sale) fail("Invoice not found.", 404);
      if (sale.status === "void") return;
      for (const line of JSON.parse(sale.items)) {
        db.prepare(
          "UPDATE products SET stock=stock+? WHERE id=? AND session=?",
        ).run(line.quantity, line.id, id);
        db.prepare("INSERT INTO movements VALUES(?,?,?,?,?,?,?)").run(
          randomUUID(),
          id,
          line.id,
          line.name,
          line.quantity,
          "Void " + sid.slice(0, 8).toUpperCase(),
          Date.now(),
        );
      }
      db.prepare("UPDATE sales SET status=? WHERE id=?").run("void", sid);
    });
  } else fail("Unknown action.");
  return state(id);
}
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};
createServer(async (req, res) => {
  const reply = (status, data, headers = {}) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    });
    res.end(JSON.stringify(data));
  };
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/workspace") {
      let id = req.headers.cookie?.match(
        /(?:^|;\s*)stockdesk_session=([a-f0-9]{64})(?:;|$)/,
      )?.[1];
      if (req.method === "GET") {
        let cookie = {};
        if (!id || !db.prepare("SELECT id FROM sessions WHERE id=?").get(id)) {
          id = randomBytes(32).toString("hex");
          seed(id);
          cookie = {
            "Set-Cookie": `stockdesk_session=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`,
          };
        }
        return reply(200, state(id), cookie);
      }
      if (req.method !== "POST")
        return reply(405, { error: "Method not allowed." });
      if (!id || !db.prepare("SELECT id FROM sessions WHERE id=?").get(id))
        return reply(401, {
          error: "Open the dashboard to start a demo session.",
        });
      const origin = req.headers.origin;
      if (
        origin &&
        !["http://127.0.0.1:5174", `http://127.0.0.1:${port}`].includes(origin)
      )
        return reply(403, { error: "Request origin rejected." });
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 30000)
          return reply(413, { error: "Request too large." });
      }
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return reply(400, { error: "Invalid JSON." });
      }
      return reply(200, mutate(id, body));
    }
    if (req.method !== "GET" && req.method !== "HEAD")
      return reply(405, { error: "Method not allowed." });
    const root = path.resolve("dist");
    let file = path.resolve(root, "." + decodeURIComponent(url.pathname));
    if (file !== root && !file.startsWith(root + path.sep))
      return reply(403, { error: "Invalid path." });
    if (!existsSync(file) || statSync(file).isDirectory())
      file = path.join(root, "index.html");
    if (!existsSync(file))
      return reply(404, {
        error: "Run npm run dev for the UI, or npm run build before npm start.",
      });
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : readFileSync(file));
  } catch (e) {
    const duplicate = String(e.message).includes("UNIQUE constraint");
    reply(e.status || (duplicate ? 409 : 500), {
      error: duplicate
        ? "That SKU is already in use."
        : e.status
          ? e.message
          : "Could not save. Your data has not been partially changed.",
    });
    if (!e.status && !duplicate) console.error(e);
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`StockDesk API http://127.0.0.1:${port}`),
);
