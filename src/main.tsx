import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Package,
  Receipt,
  Users,
  BarChart3,
  Plus,
  Search,
  ArrowUpRight,
  Boxes,
  TriangleAlert,
  RefreshCw,
  X,
  Download,
  TrendingUp,
  Wallet,
  Archive,
  SlidersHorizontal,
} from "lucide-react";
import "./style.css";
type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  reorder: number;
};
type Customer = { id: string; name: string; email: string; phone: string };
type Line = {
  id: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  cost: number;
};
type Sale = {
  id: string;
  customer: string;
  items: Line[];
  total: number;
  cost: number;
  status: string;
  created: number;
};
type Movement = {
  id: string;
  name: string;
  quantity: number;
  reason: string;
  created: number;
};
type Data = {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  movements: Movement[];
};
const money = (n: number) =>
  new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 2,
  }).format(n / 100);
const invoice = (id: string) => "INV-" + id.slice(0, 8).toUpperCase();
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={close}>
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function App() {
  const [data, setData] = useState<Data>({
    products: [],
    customers: [],
    sales: [],
    movements: [],
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [view, setView] = useState("Overview");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [saleCustomer, setSaleCustomer] = useState("");
  const saleId = useRef("");
  async function refresh() {
    setError("");
    try {
      const r = await fetch("/api/workspace");
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setData(d);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load your workspace.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function mutate(body: unknown) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setData(d);
      return d as Data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      return null;
    } finally {
      setBusy(false);
    }
  }
  function close() {
    setModal("");
    setError("");
  }
  function openSale() {
    saleId.current = crypto.randomUUID();
    setDraft({});
    setSaleCustomer("");
    setModal("sale");
    setError("");
  }
  function openProduct(p?: Product) {
    setProduct(
      p || {
        id: crypto.randomUUID(),
        name: "",
        sku: "",
        category: "Accessories",
        price: 0,
        cost: 0,
        stock: 0,
        reorder: 5,
      },
    );
    setModal("product");
    setError("");
  }
  function openCustomer(c?: Customer) {
    setCustomer(
      c || { id: crypto.randomUUID(), name: "", email: "", phone: "" },
    );
    setModal("customer");
    setError("");
  }
  const sales = data.sales.filter((s) => s.status === "completed"),
    revenue = sales.reduce((s, v) => s + v.total, 0),
    grossProfit = sales.reduce((s, v) => s + v.total - v.cost, 0),
    units = data.products.reduce((s, p) => s + p.stock, 0),
    valuation = data.products.reduce((s, p) => s + p.cost * p.stock, 0),
    low = data.products.filter((p) => p.stock <= p.reorder);
  const filteredProducts = data.products.filter((p) =>
    (p.name + " " + p.sku + " " + p.category)
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const filteredCustomers = data.customers.filter((c) =>
    (c.name + " " + c.email).toLowerCase().includes(query.toLowerCase()),
  );
  const filteredSales = data.sales.filter((s) =>
    (invoice(s.id) + " " + s.customer)
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const draftLines = data.products.filter((p) => draft[p.id] > 0);
  const draftTotal = draftLines.reduce((s, p) => s + p.price * draft[p.id], 0);
  function csv() {
    const rows = [
      ["Invoice", "Customer", "Date", "Status", "Total PKR", "Cost PKR"],
      ...data.sales.map((s) => [
        invoice(s.id),
        s.customer,
        new Date(s.created).toISOString(),
        s.status,
        (s.total / 100).toFixed(2),
        (s.cost / 100).toFixed(2),
      ]),
    ];
    const escape = (v: unknown) => {
      let t = String(v);
      if (/^[=+@\-\t\r]/.test(t)) t = "'" + t;
      return '"' + t.replaceAll('"', '""') + '"';
    };
    const blob = new Blob(
      ["\uFEFF" + rows.map((r) => r.map(escape).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stockdesk-sales.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  const productTable = (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Category</th>
            <th>Unit price</th>
            <th>In stock</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredProducts.map((p) => (
            <tr key={p.id}>
              <td>
                <div className="product-cell">
                  <span className="product-avatar">
                    <Package size={21} />
                  </span>
                  <div>
                    <strong>{p.name}</strong>
                    <small>{p.sku}</small>
                  </div>
                </div>
              </td>
              <td>{p.category}</td>
              <td>{money(p.price)}</td>
              <td>
                <strong>{p.stock}</strong> <small>units</small>
              </td>
              <td>
                <span
                  className={
                    "badge " + (p.stock <= p.reorder ? "warning" : "healthy")
                  }
                >
                  {p.stock === 0
                    ? "Out of stock"
                    : p.stock <= p.reorder
                      ? "Low stock"
                      : "In stock"}
                </span>
              </td>
              <td>
                <div className="row-actions">
                  <button onClick={() => openProduct(p)}>Edit</button>
                  <button
                    onClick={() => {
                      setProduct(p);
                      setModal("stock");
                    }}
                  >
                    Stock
                  </button>
                  <button
                    aria-label={"Archive " + p.name}
                    onClick={() => {
                      setProduct(p);
                      setModal("archive");
                    }}
                  >
                    <Archive size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!filteredProducts.length && (
        <p className="empty">
          No matching products. Add a product to get started.
        </p>
      )}
    </div>
  );
  return (
    <div className="app">
      <aside className="sidebar">
        <a className="logo" href="/">
          <span>
            <Boxes size={25} />
          </span>
          StockDesk
        </a>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav>
          {[
            [LayoutDashboard, "Overview"],
            [Package, "Inventory"],
            [Receipt, "Sales"],
            [Users, "Customers"],
            [BarChart3, "Reports"],
          ].map(([Icon, label]: any) => (
            <button
              key={label}
              className={view === label ? "active" : ""}
              onClick={() => {
                setView(label);
                setQuery("");
                setNotice("");
              }}
            >
              <Icon size={20} />
              {label}
              {label === "Inventory" && <span>{data.products.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="badge">PORTFOLIO DEMO</span>
          <h3>
            Your business.
            <br />
            In one place.
          </h3>
          <p>
            Explore with sample data. Changes are saved to your own demo
            session.
          </p>
        </div>
        <div className="author">
          <span>MS</span>
          <div>
            <strong>Muhammad Suhaim</strong>
            <small>Project creator</small>
          </div>
        </div>
      </aside>
      <section className="main">
        <header className="topbar">
          <div>
            <span>Workspace</span>
            <span>/</span>
            <strong>{view}</strong>
          </div>
          <div>
            <span className="demo-tag">Demo workspace</span>
            <button
              className="icon-button"
              aria-label="Refresh data"
              onClick={refresh}
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <span className="eyebrow">KEEP YOUR BUSINESS MOVING</span>
              <h1>{view === "Overview" ? "Business overview" : view}</h1>
              <p>
                {
                  (
                    {
                      Overview:
                        "A clear view of your stock, sales and what needs attention.",
                      Inventory:
                        "Every product, every unit, always accounted for.",
                      Sales: "Record sales and keep your inventory in sync.",
                      Customers: "Keep customer details close to every sale.",
                      Reports: "Understand your sales and stock at a glance.",
                    } as any
                  )[view]
                }
              </p>
            </div>
            <div className="actions">
              <button className="secondary" onClick={() => openProduct()}>
                <Plus size={17} />
                Add product
              </button>
              <button className="primary" onClick={openSale}>
                <Plus size={17} />
                New sale
              </button>
            </div>
          </div>
          {error && !modal && (
            <div className="error" role="alert">
              {error} <button onClick={refresh}>Try again</button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          {loading ? (
            <div className="panel empty">Loading your workspace…</div>
          ) : (
            <>
              {["Overview", "Reports"].includes(view) && (
                <div className="stats">
                  <article>
                    <div>
                      <span>Sales revenue</span>
                      <Wallet size={19} />
                    </div>
                    <strong>{money(revenue)}</strong>
                    <small>{sales.length} completed invoices</small>
                  </article>
                  <article>
                    <div>
                      <span>Gross profit</span>
                      <TrendingUp size={19} />
                    </div>
                    <strong>{money(grossProfit)}</strong>
                    <small>Sales less recorded item cost</small>
                  </article>
                  <article>
                    <div>
                      <span>Inventory units</span>
                      <Boxes size={19} />
                    </div>
                    <strong>{units.toLocaleString()}</strong>
                    <small>{data.products.length} active products</small>
                  </article>
                  <article>
                    <div>
                      <span>Needs restocking</span>
                      <TriangleAlert size={19} />
                    </div>
                    <strong>{low.length.toString().padStart(2, "0")}</strong>
                    <small>At or below reorder level</small>
                  </article>
                </div>
              )}
              {view === "Overview" && (
                <>
                  <div className="overview-grid">
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>Stock health</h2>
                        <button
                          className="text-button"
                          onClick={() => setView("Inventory")}
                        >
                          View inventory
                        </button>
                      </div>
                      <div className="stock-health">
                        <div
                          className="ring"
                          style={
                            {
                              "--ratio":
                                ((data.products.length - low.length) /
                                  Math.max(1, data.products.length)) *
                                  100 +
                                "%",
                            } as React.CSSProperties
                          }
                        >
                          <div>
                            <strong>
                              {Math.round(
                                ((data.products.length - low.length) /
                                  Math.max(1, data.products.length)) *
                                  100,
                              )}
                              %
                            </strong>
                            <span>well stocked</span>
                          </div>
                        </div>
                        <div className="health-legend">
                          <p>
                            <i className="blue-dot" />
                            Healthy stock
                            <strong>{data.products.length - low.length}</strong>
                          </p>
                          <p>
                            <i className="amber-dot" />
                            Low or empty<strong>{low.length}</strong>
                          </p>
                          <p>
                            Stock value at cost
                            <strong>{money(valuation)}</strong>
                          </p>
                        </div>
                      </div>
                      {low.length > 0 && (
                        <div className="stock-alert">
                          <TriangleAlert size={18} />
                          <span>
                            {low.map((p) => p.name).join(", ")} need attention.
                          </span>
                        </div>
                      )}
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>Recent activity</h2>
                        <span className="muted">Stock movements</span>
                      </div>
                      {data.movements.slice(0, 4).map((m) => (
                        <div className="activity" key={m.id}>
                          <span className="activity-icon">
                            <Package size={16} />
                          </span>
                          <div>
                            <strong>{m.name}</strong>
                            <small>{m.reason}</small>
                          </div>
                          <b
                            className={m.quantity > 0 ? "positive" : "negative"}
                          >
                            {m.quantity > 0 ? "+" : ""}
                            {m.quantity}
                          </b>
                        </div>
                      ))}
                      {!data.movements.length && (
                        <div className="empty">
                          <Receipt size={32} />
                          <h3>Your next sale starts here</h3>
                          <p>Record a sale or adjust stock to see activity.</p>
                          <button className="secondary" onClick={openSale}>
                            Record a demo sale
                          </button>
                        </div>
                      )}
                    </section>
                  </div>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Your products</h2>
                      <span className="muted">
                        {data.products.length} products
                      </span>
                    </div>
                    {productTable}
                  </section>
                </>
              )}
              {view === "Inventory" && (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Product catalogue</h2>
                    <label className="search">
                      <Search size={17} />
                      <input
                        aria-label="Search products"
                        placeholder="Search name, SKU or category"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                  </div>
                  {productTable}
                </section>
              )}
              {view === "Sales" && (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Sales invoices</h2>
                    <label className="search">
                      <Search size={17} />
                      <input
                        aria-label="Search invoices"
                        placeholder="Search invoices"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Invoice</th>
                          <th>Customer</th>
                          <th>Date</th>
                          <th>Total</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSales.map((s) => (
                          <tr key={s.id}>
                            <td>
                              <strong>{invoice(s.id)}</strong>
                            </td>
                            <td>{s.customer}</td>
                            <td>{new Date(s.created).toLocaleDateString()}</td>
                            <td>{money(s.total)}</td>
                            <td>
                              <span
                                className={
                                  "badge " +
                                  (s.status === "void" ? "neutral" : "healthy")
                                }
                              >
                                {s.status}
                              </span>
                            </td>
                            <td>
                              <div className="row-actions">
                                <button
                                  onClick={() => {
                                    setReceipt(s);
                                    setModal("receipt");
                                  }}
                                >
                                  View
                                </button>
                                {s.status !== "void" && (
                                  <button
                                    onClick={() => {
                                      setReceipt(s);
                                      setModal("void");
                                    }}
                                  >
                                    Void
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!filteredSales.length && (
                      <div className="empty">
                        <Receipt size={32} />
                        <h3>No invoices yet</h3>
                        <p>Create a sale to automatically deduct stock.</p>
                        <button className="primary" onClick={openSale}>
                          New sale
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              )}
              {view === "Customers" && (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Customer directory</h2>
                    <button className="primary" onClick={() => openCustomer()}>
                      <Plus size={17} />
                      Add customer
                    </button>
                  </div>
                  <div className="panel-heading">
                    <label className="search">
                      <Search size={17} />
                      <input
                        aria-label="Search customers"
                        placeholder="Search customers"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="customer-grid">
                    {filteredCustomers.map((c) => (
                      <article key={c.id}>
                        <span className="customer-avatar">
                          {c.name.slice(0, 2).toUpperCase()}
                        </span>
                        <h3>{c.name}</h3>
                        <p>{c.email || "No email"}</p>
                        <p>{c.phone || "No phone"}</p>
                        <button
                          className="secondary"
                          onClick={() => openCustomer(c)}
                        >
                          Edit customer
                        </button>
                      </article>
                    ))}
                  </div>
                  {!filteredCustomers.length && (
                    <p className="empty">No matching customers.</p>
                  )}
                </section>
              )}
              {view === "Reports" && (
                <div className="overview-grid">
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Sales by product</h2>
                      <button className="secondary" onClick={csv}>
                        <Download size={16} />
                        Export CSV
                      </button>
                    </div>
                    <div className="report-bars">
                      {Object.values(
                        sales
                          .flatMap((s) => s.items)
                          .reduce(
                            (acc, l) => {
                              acc[l.id] ??= {
                                name: l.name,
                                total: 0,
                                units: 0,
                              };
                              acc[l.id].total += l.price * l.quantity;
                              acc[l.id].units += l.quantity;
                              return acc;
                            },
                            {} as Record<
                              string,
                              { name: string; total: number; units: number }
                            >,
                          ),
                      )
                        .sort((a, b) => b.total - a.total)
                        .map((p) => (
                          <div className="report-line" key={p.name}>
                            <div>
                              <strong>{p.name}</strong>
                              <span>
                                {money(p.total)} · {p.units} units
                              </span>
                            </div>
                            <div className="bar">
                              <i
                                style={{
                                  width:
                                    (p.total / Math.max(1, revenue)) * 100 +
                                    "%",
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      {!sales.length && (
                        <p className="empty">
                          Record a completed sale to see product performance.
                        </p>
                      )}
                    </div>
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Inventory summary</h2>
                    </div>
                    <div className="summary-list">
                      <p>
                        Stock value at cost<strong>{money(valuation)}</strong>
                      </p>
                      <p>
                        Potential retail value
                        <strong>
                          {money(
                            data.products.reduce(
                              (s, p) => s + p.price * p.stock,
                              0,
                            ),
                          )}
                        </strong>
                      </p>
                      <p>
                        Gross margin on completed sales
                        <strong>
                          {revenue
                            ? ((grossProfit / revenue) * 100).toFixed(1)
                            : "0.0"}
                          %
                        </strong>
                      </p>
                      <p>
                        Voided invoices
                        <strong>
                          {data.sales.filter((s) => s.status === "void").length}
                        </strong>
                      </p>
                    </div>
                    <p className="report-note">
                      Amounts exclude tax, discounts and operating expenses.
                      Voided invoices are excluded from sales revenue and gross
                      profit.
                    </p>
                  </section>
                </div>
              )}
            </>
          )}
          <footer>
            StockDesk · A working portfolio demo by Muhammad Suhaim{" "}
            <span>Sample data. No real payments.</span>
          </footer>
        </main>
      </section>
      {modal && (
        <Modal
          title={
            (
              {
                product:
                  product && data.products.some((p) => p.id === product.id)
                    ? "Edit product"
                    : "Add product",
                customer: "Customer details",
                stock: "Adjust stock",
                sale: "Record a sale",
                receipt: "Sales invoice",
                void: "Void this invoice?",
                archive: "Archive this product?",
              } as any
            )[modal]
          }
          close={close}
        >
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {modal === "product" && product && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (await mutate({ action: "product", product })) {
                  close();
                  setNotice("Product saved.");
                }
              }}
            >
              <div className="form-grid">
                <label>
                  Product name
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    value={product.name}
                    onChange={(e) =>
                      setProduct({ ...product, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  SKU
                  <input
                    required
                    minLength={2}
                    maxLength={30}
                    pattern="[A-Za-z0-9_\-]+"
                    value={product.sku}
                    onChange={(e) =>
                      setProduct({ ...product, sku: e.target.value })
                    }
                  />
                </label>
                <label>
                  Category
                  <select
                    value={product.category}
                    onChange={(e) =>
                      setProduct({ ...product, category: e.target.value })
                    }
                  >
                    {["Accessories", "Office", "Lifestyle", "Other"].map(
                      (c) => (
                        <option key={c}>{c}</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Reorder at
                  <input
                    type="number"
                    required
                    min={0}
                    max={100000}
                    value={product.reorder}
                    onChange={(e) =>
                      setProduct({
                        ...product,
                        reorder: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Selling price (PKR)
                  <input
                    type="number"
                    required
                    min={0.01}
                    max={1000000}
                    step="0.01"
                    value={product.price / 100}
                    onChange={(e) =>
                      setProduct({
                        ...product,
                        price: Math.round(Number(e.target.value) * 100),
                      })
                    }
                  />
                </label>
                <label>
                  Unit cost (PKR)
                  <input
                    type="number"
                    required
                    min={0}
                    max={1000000}
                    step="0.01"
                    value={product.cost / 100}
                    onChange={(e) =>
                      setProduct({
                        ...product,
                        cost: Math.round(Number(e.target.value) * 100),
                      })
                    }
                  />
                </label>
                {!data.products.some((p) => p.id === product.id) && (
                  <label>
                    Opening stock
                    <input
                      type="number"
                      required
                      min={0}
                      max={100000}
                      value={product.stock}
                      onChange={(e) =>
                        setProduct({
                          ...product,
                          stock: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                )}
              </div>
              <p className="muted">
                Use stock adjustments to change the quantity of existing
                products.
              </p>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={close}>
                  Cancel
                </button>
                <button className="primary" disabled={busy}>
                  {busy ? "Saving…" : "Save product"}
                </button>
              </div>
            </form>
          )}
          {modal === "stock" && product && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (
                  await mutate({
                    action: "stock",
                    id: product.id,
                    quantity: Number(f.get("quantity")),
                    reason: f.get("reason"),
                  })
                ) {
                  close();
                  setNotice("Stock adjustment recorded.");
                }
              }}
            >
              <p>
                <strong>{product.name}</strong> · {product.stock} units
                currently in stock
              </p>
              <label>
                Quantity change
                <input
                  type="number"
                  required
                  name="quantity"
                  placeholder="10 to add, -2 to remove"
                  min={-100000}
                  max={100000}
                />
              </label>
              <label>
                Reason
                <input
                  required
                  name="reason"
                  minLength={2}
                  maxLength={80}
                  placeholder="New shipment, damaged goods…"
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={close}>
                  Cancel
                </button>
                <button className="primary" disabled={busy}>
                  Save adjustment
                </button>
              </div>
            </form>
          )}
          {modal === "customer" && customer && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (await mutate({ action: "customer", customer })) {
                  close();
                  setNotice("Customer saved.");
                }
              }}
            >
              <label>
                Name
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  value={customer.name}
                  onChange={(e) =>
                    setCustomer({ ...customer, name: e.target.value })
                  }
                />
              </label>
              <label>
                Email (optional)
                <input
                  type="email"
                  maxLength={120}
                  value={customer.email}
                  onChange={(e) =>
                    setCustomer({ ...customer, email: e.target.value })
                  }
                />
              </label>
              <label>
                Phone (optional)
                <input
                  type="tel"
                  maxLength={30}
                  value={customer.phone}
                  onChange={(e) =>
                    setCustomer({ ...customer, phone: e.target.value })
                  }
                />
              </label>
              <p className="muted">
                Use sample contact information in this demo.
              </p>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={close}>
                  Cancel
                </button>
                <button className="primary" disabled={busy}>
                  Save customer
                </button>
              </div>
            </form>
          )}
          {modal === "sale" && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const result = await mutate({
                  action: "sale",
                  sale: {
                    id: saleId.current,
                    customerId: saleCustomer,
                    items: draftLines.map((p) => ({
                      id: p.id,
                      quantity: draft[p.id],
                    })),
                  },
                });
                if (result) {
                  setReceipt(
                    result.sales.find((s) => s.id === saleId.current) || null,
                  );
                  setModal("receipt");
                  setNotice("Sale recorded and stock updated.");
                }
              }}
            >
              <label>
                Customer
                <select
                  value={saleCustomer}
                  onChange={(e) => setSaleCustomer(e.target.value)}
                >
                  <option value="">Walk-in customer</option>
                  {data.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Add a product
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value)
                      setDraft({
                        ...draft,
                        [e.target.value]: (draft[e.target.value] || 0) + 1,
                      });
                  }}
                >
                  <option value="">Select a product</option>
                  {data.products
                    .filter((p) => p.stock > 0)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.stock} in stock · {money(p.price)}
                      </option>
                    ))}
                </select>
              </label>
              <div className="sale-lines">
                {draftLines.map((p) => (
                  <div key={p.id}>
                    <div>
                      <strong>{p.name}</strong>
                      <small>
                        {money(p.price)} each · {p.stock} available
                      </small>
                    </div>
                    <input
                      aria-label={"Quantity for " + p.name}
                      type="number"
                      min={1}
                      max={p.stock}
                      value={draft[p.id]}
                      onChange={(e) =>
                        setDraft({ ...draft, [p.id]: Number(e.target.value) })
                      }
                    />
                    <strong>{money(p.price * draft[p.id])}</strong>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={"Remove " + p.name}
                      onClick={() => setDraft({ ...draft, [p.id]: 0 })}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              {!draftLines.length && (
                <p className="empty">
                  Add at least one product to this invoice.
                </p>
              )}
              <div className="invoice-total">
                <span>Total</span>
                <strong>{money(draftTotal)}</strong>
              </div>
              <p className="muted">
                This records a simulated sale. No money is collected.
              </p>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={close}>
                  Cancel
                </button>
                <button
                  className="primary"
                  disabled={busy || !draftLines.length}
                >
                  {busy ? "Recording…" : "Record sale"}
                </button>
              </div>
            </form>
          )}
          {modal === "receipt" && receipt && (
            <div className="receipt">
              <span className="badge">{receipt.status}</span>
              <h3>{invoice(receipt.id)}</h3>
              <p>
                {receipt.customer} ·{" "}
                {new Date(receipt.created).toLocaleString()}
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.items.map((l) => (
                    <tr key={l.id}>
                      <td>{l.name}</td>
                      <td>{l.quantity}</td>
                      <td>{money(l.price * l.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="invoice-total">
                <span>Total</span>
                <strong>{money(receipt.total)}</strong>
              </div>
              <p className="muted">
                Portfolio demo invoice · No tax or payment collected.
              </p>
              <div className="modal-actions">
                <button className="secondary" onClick={() => window.print()}>
                  Print invoice
                </button>
                <button className="primary" onClick={close}>
                  Done
                </button>
              </div>
            </div>
          )}
          {modal === "void" && receipt && (
            <>
              <p>
                Void <strong>{invoice(receipt.id)}</strong>? Its stock
                quantities will be restored once and the invoice will stay in
                the sales history.
              </p>
              <div className="modal-actions">
                <button className="secondary" onClick={close}>
                  Keep invoice
                </button>
                <button
                  className="danger"
                  disabled={busy}
                  onClick={async () => {
                    if (await mutate({ action: "void", id: receipt.id })) {
                      close();
                      setNotice("Invoice voided and stock restored.");
                    }
                  }}
                >
                  Void invoice
                </button>
              </div>
            </>
          )}
          {modal === "archive" && product && (
            <>
              <p>
                Archive <strong>{product.name}</strong>? It will be hidden from
                the active catalogue. Existing invoice records will remain
                intact.
              </p>
              <div className="modal-actions">
                <button className="secondary" onClick={close}>
                  Keep product
                </button>
                <button
                  className="danger"
                  disabled={busy}
                  onClick={async () => {
                    if (await mutate({ action: "archive", id: product.id })) {
                      close();
                      setNotice("Product archived.");
                    }
                  }}
                >
                  Archive product
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
