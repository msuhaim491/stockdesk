import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5181";
async function session() {
  const r = await fetch(base + "/api/workspace");
  assert.equal(r.status, 200);
  return {
    cookie: r.headers.get("set-cookie").split(";")[0],
    data: await r.json(),
  };
}
async function post(cookie, body, status = 200) {
  const r = await fetch(base + "/api/workspace", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Origin: base,
    },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  assert.equal(r.status, status, JSON.stringify(data));
  return data;
}
async function read(cookie) {
  return fetch(base + "/api/workspace", { headers: { Cookie: cookie } }).then(
    (r) => r.json(),
  );
}
const a = await session(),
  b = await session();
const [p, q] = a.data.products;
const sale = {
  id: crypto.randomUUID(),
  customerId: "",
  items: [{ id: p.id, quantity: 2 }],
  total: 1,
};
const made = await post(a.cookie, { action: "sale", sale });
assert.equal(made.products.find((i) => i.id === p.id).stock, p.stock - 2);
assert.equal(made.sales[0].total, p.price * 2);
const again = await post(a.cookie, { action: "sale", sale });
assert.equal(again.sales.length, 1);
assert.equal(again.products.find((i) => i.id === p.id).stock, p.stock - 2);
await post(
  a.cookie,
  {
    action: "sale",
    sale: {
      ...sale,
      id: crypto.randomUUID(),
      items: [
        { id: p.id, quantity: 1 },
        { id: q.id, quantity: q.stock + 1 },
      ],
    },
  },
  409,
);
assert.equal(
  (await read(a.cookie)).products.find((i) => i.id === p.id).stock,
  p.stock - 2,
);
await post(
  b.cookie,
  { action: "stock", id: p.id, quantity: 1, reason: "Test stock" },
  404,
);
await post(b.cookie, { action: "void", id: sale.id }, 404);
await post(
  a.cookie,
  { action: "stock", id: p.id, quantity: -100000, reason: "Test invalid" },
  409,
);
assert.equal(
  (await read(a.cookie)).products.find((i) => i.id === p.id).stock,
  p.stock - 2,
);
const voided = await post(a.cookie, { action: "void", id: sale.id });
assert.equal(voided.products.find((i) => i.id === p.id).stock, p.stock);
const twice = await post(a.cookie, { action: "void", id: sale.id });
assert.equal(twice.products.find((i) => i.id === p.id).stock, p.stock);
await post(a.cookie, {
  action: "product",
  product: { ...p, price: p.price + 100 },
});
assert.equal((await read(a.cookie)).sales[0].items[0].price, p.price);
await post(
  a.cookie,
  { action: "product", product: { ...p, id: crypto.randomUUID() } },
  409,
);
await post(
  a.cookie,
  {
    action: "sale",
    sale: {
      ...sale,
      id: crypto.randomUUID(),
      items: [{ id: p.id, quantity: -1 }],
    },
  },
  400,
);
await post("", { action: "sale", sale }, 401);
assert.equal((await read(b.cookie)).sales.length, 0);
const otherOrigin = await fetch(base + "/api/workspace", {
  method: "POST",
  headers: { Cookie: a.cookie, Origin: "https://example.com" },
  body: "{}",
});
assert.equal(otherOrigin.status, 403);
console.log(
  "PASS: stock deductions, price authority, transaction rollback, oversell prevention, isolation, idempotency, void restocking and historical prices.",
);
