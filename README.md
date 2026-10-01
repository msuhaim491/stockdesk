# StockDesk

A working inventory and sales portfolio demo by **Muhammad Suhaim**.

## Features

- Overview with revenue, gross profit, stock valuation and reorder alerts.
- Product records, unique SKUs, stock adjustments with reasons and movement history.
- Customer directory, transactional sales, printable receipts and CSV reports.
- Server-calculated prices and totals, overselling prevention, idempotent sales, one-time stock restoration when voiding.
- Isolated sample workspace per browser with an opaque HttpOnly session cookie.
- Responsive layout, accessible native dialogs and keyboard navigation.

## Run

Requires Node.js 24 or later (uses the built-in `node:sqlite` module).

```sh
npm ci
npm run server
# In a second terminal:
npm run dev
```

Open http://127.0.0.1:5174. The API uses port 5181. Alternatively `npm run build` then `npm start` serves the built UI at http://127.0.0.1:5181.

```sh
npx tsc --noEmit
npm run build
npm test
```

API tests require the server. They create their own separate sample sessions and verify totals, stock, rollback, idempotency and workspace isolation.

## Architecture and limits

React + TypeScript + Vite; Node HTTP API; SQLite WAL; Zod validation. Money is stored in integer paisa. Sales and stock mutations are atomic transactions; saved invoice lines preserve historical prices and costs. Nonzero stock must be adjusted with a reason before a product can be archived.

The database lives in `.data/stockdesk.sqlite` and is excluded from source control. A browser session is a demo boundary, not a business login. This is a local portfolio project: no payments, taxation, real customer data, multi-user authentication, backup service or public hosting is configured. The server binds to localhost. Production use needs those decisions and HTTPS before exposure. Gross profit excludes operating expenses and tax.

Built as a personal demonstration project, not a client commission.
