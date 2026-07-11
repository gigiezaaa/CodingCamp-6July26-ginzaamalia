# Design Document: Expense & Budget Visualizer

## Overview

The Expense & Budget Visualizer is a single-page, client-side web application built with plain HTML, CSS, and vanilla JavaScript. No build step, no bundler, no framework — just three files the browser loads directly.

The application lets users add, view, and delete expense transactions. It keeps a running total balance and renders a pie chart (via Chart.js) that breaks down spending across three fixed categories: Food, Transport, and Fun. All data is persisted in the browser's Local Storage so it survives page reloads.

### Technology Choices

| Concern | Choice | Rationale |
|---|---|---|
| Markup | HTML5 | Semantic, accessible, no preprocessing |
| Styling | CSS3 (single file) | Flexbox/Grid layout, custom properties for theming |
| Logic | Vanilla JS ES2020 (single file) | No dependencies beyond Chart.js |
| Chart | Chart.js (CDN) | Lightweight, well-documented, supports doughnut/pie |
| Persistence | `window.localStorage` | Built-in, synchronous, sufficient for client-only data |

---

## Architecture

The application follows a simple **event-driven, MVC-lite** pattern with no framework scaffolding.

```
┌─────────────────────────────────────────────────────┐
│                    index.html                       │
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │ Input Form │  │ Tx List    │  │ Balance +    │  │
│  │ (HTML)     │  │ (HTML)     │  │ Chart Canvas │  │
│  └─────┬──────┘  └─────┬──────┘  └──────┬───────┘  │
│        │               │                │           │
│        └───────────────┴────────────────┘           │
│                        │                            │
│              ┌─────────▼──────────┐                 │
│              │   app.js           │                 │
│              │  ┌──────────────┐  │                 │
│              │  │ State        │  │                 │
│              │  │ (in-memory   │  │                 │
│              │  │  array)      │  │                 │
│              │  └──────┬───────┘  │                 │
│              │         │          │                 │
│              │  ┌──────▼───────┐  │                 │
│              │  │ Storage      │  │                 │
│              │  │ Module       │  │                 │
│              │  └──────┬───────┘  │                 │
│              └─────────┼──────────┘                 │
│                        │                            │
│              ┌─────────▼──────────┐                 │
│              │  localStorage      │                 │
│              └────────────────────┘                 │
└─────────────────────────────────────────────────────┘
```

### Data Flow

1. **User submits form** → `handleFormSubmit()` validates → `addTransaction()` updates state → `saveToStorage()` persists → `renderAll()` updates DOM + chart
2. **User clicks delete** → `handleDelete(id)` confirms → `deleteTransaction(id)` updates state → `saveToStorage()` persists → `renderAll()` updates DOM + chart
3. **Page load** → `init()` → `loadFromStorage()` populates state → `renderAll()` paints UI

---

## File / Folder Structure

```
project-root/
├── index.html          ← Single HTML file; references css/styles.css and js/app.js
├── css/
│   └── styles.css      ← All styles (layout, components, responsive breakpoints)
└── js/
    └── app.js          ← All application logic (state, storage, validation, rendering, chart)
```

No subdirectories beyond `css/` and `js/`. Chart.js is loaded from a CDN `<script>` tag in `index.html` before `app.js`.

---

## Components and Interfaces

### HTML Structure (`index.html`)

```
<body>
  <header>
    <h1>Expense & Budget Visualizer</h1>
    <div id="balance-display">Total: $0.00</div>
  </header>

  <main>
    <section id="form-section">
      <form id="transaction-form">
        <input  id="input-name"     type="text"   maxlength="100" />
        <input  id="input-amount"   type="number" min="0.01" step="0.01" />
        <select id="input-category">
          <option value="">-- Select Category --</option>
          <option value="Food">Food</option>
          <option value="Transport">Transport</option>
          <option value="Fun">Fun</option>
        </select>
        <button type="submit">Add Transaction</button>
      </form>
      <div id="form-error" role="alert" aria-live="polite"></div>
    </section>

    <section id="list-section">
      <ul id="transaction-list"></ul>
      <!-- Empty state injected by JS when list is empty -->
    </section>

    <section id="chart-section">
      <canvas id="spending-chart"></canvas>
      <div id="chart-placeholder">No data yet</div>
    </section>
  </main>
</body>
```

Each transaction list item (`<li>`) rendered by JS:

```html
<li data-id="{id}">
  <span class="tx-name">{name}</span>
  <span class="tx-amount">${amount}</span>
  <span class="tx-category">{category}</span>
  <button class="btn-delete" aria-label="Delete {name}">Delete</button>
</li>
```

### JavaScript Module Layout (`js/app.js`)

The file is organized into clearly commented sections. No ES module `import/export` — all functions are in the same IIFE scope to avoid polluting the global namespace.

```
(function () {

  /* ── Constants ─────────────────────────────────────── */
  /* ── State ─────────────────────────────────────────── */
  /* ── Storage Module ────────────────────────────────── */
  /* ── Validation Module ──────────────────────────────── */
  /* ── Transaction Operations ─────────────────────────── */
  /* ── Balance Module ─────────────────────────────────── */
  /* ── Chart Module ───────────────────────────────────── */
  /* ── Render Module ──────────────────────────────────── */
  /* ── Event Handlers ─────────────────────────────────── */
  /* ── Init ───────────────────────────────────────────── */

})();
```

---

## Data Models

### Transaction Object

```js
{
  id:       string,   // UUID v4, generated with crypto.randomUUID()
  name:     string,   // 1–100 characters, trimmed
  amount:   number,   // float, 0.01 – 999_999_999.99 (stored as number, not string)
  category: string,   // "Food" | "Transport" | "Fun"
  createdAt: number   // Date.now() timestamp (ms since epoch), used for sort order
}
```

### Local Storage Schema

Key: `"expense_transactions"`  
Value: JSON-serialized array of Transaction objects.

```json
[
  {
    "id": "a3f1b2c4-...",
    "name": "Lunch",
    "amount": 12.50,
    "category": "Food",
    "createdAt": 1720000000000
  }
]
```

#### Parsing Guard

On load, the stored string is wrapped in a `try/catch`. If parsing fails (malformed JSON, missing fields), the app starts with an empty array and shows a non-blocking warning banner.

### Category Totals (derived, not stored)

```js
{
  Food:      number,   // sum of all Food transaction amounts
  Transport: number,   // sum of all Transport transaction amounts
  Fun:       number    // sum of all Fun transaction amounts
}
```

This object is computed fresh from the in-memory array whenever the chart needs to update; it is never persisted.

---

## Module / Function Design (`js/app.js`)

### Constants

```js
const STORAGE_KEY = 'expense_transactions';
const CATEGORIES  = ['Food', 'Transport', 'Fun'];
const MAX_NAME_LEN = 100;
const CATEGORY_COLORS = {
  Food:      '#FF6384',
  Transport: '#36A2EB',
  Fun:       '#FFCE56'
};
```

### State

```js
let transactions = [];   // Single source of truth; always a sorted (newest-first) array
let chartInstance = null; // Holds the Chart.js instance for destroy/recreate
```

### Storage Module

| Function | Signature | Description |
|---|---|---|
| `loadFromStorage()` | `() → Transaction[]` | Reads `STORAGE_KEY` from localStorage, parses JSON, validates structure, returns array. Returns `[]` on any error and calls `showStorageWarning()`. |
| `saveToStorage(txList)` | `(Transaction[]) → boolean` | Serializes array to JSON, writes to localStorage. Returns `true` on success, `false` on `QuotaExceededError` or other exception. |
| `isStorageAvailable()` | `() → boolean` | Tests localStorage with a probe write/read/delete. Returns `false` if unavailable. |

### Validation Module

| Function | Signature | Description |
|---|---|---|
| `validateForm(name, amount, category)` | `(string, string, string) → { valid: boolean, errors: string[] }` | Validates all three fields. Returns list of human-readable error strings. Trims whitespace before checking. |

Validation rules:
- `name`: required, non-empty after trim, max 100 chars
- `amount`: required, parseable as float, > 0, ≤ 999_999_999.99
- `category`: required, must be one of `CATEGORIES`

### Transaction Operations

| Function | Signature | Description |
|---|---|---|
| `addTransaction(name, amount, category)` | `(string, number, string) → Transaction` | Creates a new Transaction object with `crypto.randomUUID()` and `Date.now()`, prepends to `transactions` array, calls `saveToStorage`. |
| `deleteTransaction(id)` | `(string) → boolean` | Filters `transactions` to remove the item with matching `id`. Calls `saveToStorage`. Returns `false` and reverts if save fails. |
| `getTransaction(id)` | `(string) → Transaction \| undefined` | Finds transaction by id. |

### Balance Module

| Function | Signature | Description |
|---|---|---|
| `computeBalance(txList)` | `(Transaction[]) → number` | Reduces array to sum of amounts. Returns `0` for empty array. |
| `formatCurrency(amount)` | `(number) → string` | Returns `"$X.XX"` with exactly 2 decimal places using `toFixed(2)`. |

### Chart Module

| Function | Signature | Description |
|---|---|---|
| `computeCategoryTotals(txList)` | `(Transaction[]) → { labels: string[], data: number[], colors: string[] }` | Groups amounts by category, excludes categories with total === 0, returns arrays ready for Chart.js dataset. |
| `renderChart(txList)` | `(Transaction[]) → void` | If `txList` is empty: destroys `chartInstance` if it exists, hides canvas, shows placeholder. Otherwise: destroys old instance, creates new `Chart(ctx, config)` with `'pie'` type. |

### Render Module

| Function | Signature | Description |
|---|---|---|
| `renderTransactionList(txList)` | `(Transaction[]) → void` | Clears `#transaction-list`, iterates `txList` (newest-first), appends `<li>` elements. Shows empty-state message if `txList.length === 0`. |
| `renderBalance(txList)` | `(Transaction[]) → void` | Computes balance, formats it, sets `#balance-display` text content. |
| `renderAll()` | `() → void` | Calls `renderTransactionList`, `renderBalance`, `renderChart` with current `transactions`. |
| `showFormError(messages)` | `(string[]) → void` | Joins error messages, sets `#form-error` text. |
| `clearFormError()` | `() → void` | Clears `#form-error`. |
| `showStorageWarning(msg)` | `(string) → void` | Injects a dismissible warning banner at the top of `<main>`. |
| `resetForm()` | `() → void` | Clears all form fields and removes validation error styling. |

### Event Handlers

| Handler | Trigger | Behaviour |
|---|---|---|
| `handleFormSubmit(e)` | `#transaction-form` submit | Prevents default, reads fields, calls `validateForm`. On error: shows errors, returns. On success: calls `addTransaction`, `resetForm`, `renderAll`. |
| `handleDeleteClick(e)` | Click delegation on `#transaction-list` | Checks `e.target.classList.contains('btn-delete')`. Reads `data-id` from parent `<li>`. Calls `window.confirm(...)`. On confirm: calls `deleteTransaction(id)`. On save failure: shows error banner. |

### Init

```js
function init() {
  if (!isStorageAvailable()) {
    showStorageWarning('Local Storage is not available in this browser. Data will not be saved.');
    return;
  }
  transactions = loadFromStorage();
  renderAll();
  document.getElementById('transaction-form')
    .addEventListener('submit', handleFormSubmit);
  document.getElementById('transaction-list')
    .addEventListener('click', handleDeleteClick);
}

document.addEventListener('DOMContentLoaded', init);
```

---

## UI Layout and Component Relationships

```
┌──────────────────────────────────────────────┐
│  HEADER                                      │
│  "Expense & Budget Visualizer"               │
│  Total Balance: $XXX.XX                      │
├──────────────────────────────────────────────┤
│  MAIN (CSS Grid: 2 columns on ≥768px,         │
│        stacked single column on <768px)      │
│                                              │
│  ┌─────────────────┐  ┌────────────────────┐ │
│  │ INPUT FORM      │  │ PIE CHART          │ │
│  │  Name field     │  │  (Chart.js canvas) │ │
│  │  Amount field   │  │  or placeholder    │ │
│  │  Category select│  └────────────────────┘ │
│  │  [Add] button   │                         │
│  │  Error message  │                         │
│  └─────────────────┘                         │
│                                              │
│  ┌──────────────────────────────────────────┐ │
│  │ TRANSACTION LIST (max-height + scroll)   │ │
│  │  [name] [$amount] [category] [Delete]    │ │
│  │  [name] [$amount] [category] [Delete]    │ │
│  │  ...                                     │ │
│  │  (or: "No transactions yet" message)     │ │
│  └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

**Responsive breakpoints:**
- `< 768px`: single column; form stacks above chart; list below both
- `≥ 768px`: two-column grid; form left, chart right; list spans full width below
- `≥ 1200px`: constrained max-width (`1100px`) centered

---

## State Management Approach

State is a single module-level array:

```js
let transactions = [];
```

This array is the single source of truth. All reads (balance, chart, list render) go through this array. Local Storage is a write-through cache:

1. **Read on init**: `loadFromStorage()` populates the array once at startup
2. **Write on mutation**: every `addTransaction` and `deleteTransaction` call ends with `saveToStorage(transactions)` before any DOM update
3. **Never read from storage again** after init — the in-memory array is always authoritative

This means:
- No stale reads between operations
- Atomic updates: if `saveToStorage` fails, the mutation is rolled back and the UI is not updated
- Simple reasoning: every rendered value flows from `transactions`

---

## Chart.js Integration Approach

### Loading

Chart.js is loaded via CDN in `index.html` before `app.js`:

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
<script src="js/app.js"></script>
```

### Instance Management

Chart.js `Chart` instances must be explicitly destroyed before recreating, otherwise the canvas retains the old chart and throws warnings.

```js
function renderChart(txList) {
  const canvas = document.getElementById('spending-chart');
  const placeholder = document.getElementById('chart-placeholder');

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const { labels, data, colors } = computeCategoryTotals(txList);

  if (data.length === 0) {
    canvas.style.display = 'none';
    placeholder.style.display = 'block';
    return;
  }

  canvas.style.display = 'block';
  placeholder.style.display = 'none';

  chartInstance = new Chart(canvas.getContext('2d'), {
    type: 'pie',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: $${ctx.parsed.toFixed(2)}`
          }
        }
      }
    }
  });
}
```

### Zero-Category Exclusion

`computeCategoryTotals` only pushes a category into the output arrays if its sum is strictly greater than zero:

```js
function computeCategoryTotals(txList) {
  const totals = { Food: 0, Transport: 0, Fun: 0 };
  txList.forEach(tx => { totals[tx.category] += tx.amount; });

  const labels = [], data = [], colors = [];
  CATEGORIES.forEach(cat => {
    if (totals[cat] > 0) {
      labels.push(cat);
      data.push(totals[cat]);
      colors.push(CATEGORY_COLORS[cat]);
    }
  });
  return { labels, data, colors };
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid transaction addition is reflected in state and storage

*For any* valid transaction input (non-empty name ≤ 100 chars, positive numeric amount within range, valid category), calling `addTransaction` should result in the returned transaction appearing at the front of the `transactions` array and the serialized localStorage value containing an entry with matching `id`, `name`, `amount`, `category`, and `createdAt` fields.

**Validates: Requirements 1.2, 6.1, 6.5**

---

### Property 2: Validation rejects all classes of invalid input

*For any* input where at least one field is invalid — including any combination of: empty/whitespace-only name, name exceeding 100 characters, amount of zero, negative amount, non-numeric amount, or category not in {Food, Transport, Fun} — `validateForm` should return `{ valid: false, errors: [...] }` with a non-empty errors array, and the `transactions` array should remain unchanged after the attempted submission.

**Validates: Requirements 1.3, 1.4, 1.5**

---

### Property 3: Rendered transaction list is correctly formatted and sorted

*For any* non-empty array of transactions, `renderTransactionList` should produce a list where: (a) every item displays the transaction's name, amount formatted to exactly two decimal places with a `$` prefix, and category; (b) the list is ordered from newest `createdAt` to oldest; and (c) every item contains an element with class `btn-delete`.

**Validates: Requirements 2.1, 3.1**

---

### Property 4: Serialization round-trip preserves all required fields

*For any* array of transactions, serializing to JSON via `saveToStorage` and then deserializing via `loadFromStorage` should produce an array where every transaction object has the same `id`, `name`, `amount`, `category`, and `createdAt` values as the original, in the same order.

**Validates: Requirements 2.3, 6.3, 6.5**

---

### Property 5: Deletion removes exactly one transaction and preserves all others

*For any* non-empty transaction array and any valid transaction `id` from that array, calling `deleteTransaction(id)` should result in: (a) the deleted transaction no longer appearing in `transactions`; (b) all other transactions remaining present and unmodified (same field values, same relative order); and (c) the updated array being reflected in localStorage.

**Validates: Requirements 3.3, 3.5, 6.2**

---

### Property 6: Balance computation is the exact sum of all transaction amounts

*For any* array of transactions with numeric amounts, `computeBalance` should return a value equal to the arithmetic sum of all `amount` fields, and `formatCurrency` should render that value as a string matching the pattern `$N.NN` with exactly two decimal places.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

---

### Property 7: Category totals exclude zero-sum categories

*For any* transaction array, `computeCategoryTotals` should return label/data/color arrays where every included entry has a strictly positive total, and categories with a total of zero are absent from the output. The sum of all returned data values should equal `computeBalance` of the input array.

**Validates: Requirements 5.6**

---

## Error Handling

### Validation Errors (user input)

- Displayed immediately in `#form-error` via `showFormError(messages)`
- `aria-live="polite"` ensures screen readers announce the message
- Cleared on next successful submission or when the user starts typing (optional UX enhancement)
- Transaction is never added to state if validation fails

### Local Storage Errors (storage failure)

| Scenario | Handler | UI Response |
|---|---|---|
| `localStorage` not available (private mode, old browser) | `isStorageAvailable()` returns false in `init()` | Warning banner; app runs in session-only mode |
| JSON parse error on load | `try/catch` in `loadFromStorage()` | Empty array used; non-blocking warning banner shown |
| `QuotaExceededError` on write | `try/catch` in `saveToStorage()` | Returns `false`; caller shows inline error; state rolled back |
| Write failure during delete | `deleteTransaction` checks return value of `saveToStorage` | Transaction restored; error banner shown to user |

### Chart Errors

- If `computeCategoryTotals` returns empty arrays, the canvas is hidden and the placeholder text is shown
- `chartInstance.destroy()` is called defensively before every chart render to prevent canvas state corruption

### Defensive Guards

- `transactions` array is initialized to `[]` and is never set to `null` or `undefined`
- All DOM reads (`getElementById`) are done at event-handler time, not cached at module load, to survive potential DOM resets
- `amount` stored as `number` (parsed via `parseFloat`) to avoid locale-specific string comparison bugs

---

## Testing Strategy

### Unit Tests (example-based)

Target: pure functions that have no side effects or can be tested with simple stubs.

| Test | Function | What is asserted |
|---|---|---|
| Empty list balance | `computeBalance([])` | Returns `0` |
| Currency formatting | `formatCurrency(1234.5)` | Returns `"$1234.50"` |
| All-zero chart | `computeCategoryTotals([])` | Returns empty arrays |
| Storage unavailable | `init()` with mocked localStorage=null | Warning shown, no crash |
| Parse error on load | `loadFromStorage()` with corrupted JSON | Returns `[]`, triggers warning |
| Storage quota exceeded | `saveToStorage(...)` with mock that throws QuotaExceeded | Returns `false` |
| Empty state message | `renderTransactionList([])` | DOM contains empty-state message |
| No-data chart placeholder | `renderChart([])` | Canvas hidden, placeholder visible |

### Property-Based Tests

Use **fast-check** (JavaScript PBT library) with a minimum of **100 iterations per property**.

Each test is tagged with a comment referencing the property it validates:
```
// Feature: expense-budget-visualizer, Property N: <property text>
```

| Property | Generator inputs | Assertion |
|---|---|---|
| Property 1: Add transaction | `fc.record({ name: fc.string({minLength:1, maxLength:100}), amount: fc.float({min:0.01, max:999999999.99}), category: fc.constantFrom(...CATEGORIES) })` | Transaction in array at index 0; localStorage contains matching entry |
| Property 2: Validation rejects invalid inputs | `fc.oneof(fc.constant(''), fc.string({minLength:101}))` for name; `fc.oneof(fc.constant(0), fc.float({max:-0.01}), fc.constant('abc'))` for amount | `validateForm` returns `valid: false`; array unchanged |
| Property 3: Rendered list is formatted and sorted | `fc.array(transactionArb, {minLength:1})` | Each `<li>` has correct fields; order is newest-first; each has `.btn-delete` |
| Property 4: Serialization round-trip | `fc.array(transactionArb)` | `loadFromStorage(saveToStorage(arr))` deep-equals original array |
| Property 5: Deletion is correct | `fc.array(transactionArb, {minLength:1})` + random index | Deleted id gone; others unchanged; localStorage updated |
| Property 6: Balance is sum of amounts | `fc.array(fc.float({min:0.01, max:1000}))` → map to transactions | `computeBalance` equals `amounts.reduce((a,b)=>a+b,0)` |
| Property 7: Zero-sum categories excluded | `fc.array(transactionArb)` with some categories having zero total | No zero-value entry in returned data array; total equals balance |

### Integration / Smoke Tests

- Manual cross-browser smoke test in Chrome, Firefox, Edge, Safari
- Responsive layout check at 320px, 768px, 1280px, 1920px viewports
- Performance: initial render timed at < 2 seconds; add/delete operations < 300ms (browser DevTools profiling)

### Accessibility

- Form labels associated with inputs via `for`/`id` pairs
- `aria-live="polite"` on error container
- Delete buttons have descriptive `aria-label="Delete {name}"`
- Color contrast meets WCAG AA (verified manually)
