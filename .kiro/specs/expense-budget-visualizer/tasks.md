# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement a pure client-side web application using plain HTML5, CSS3, and vanilla JavaScript (ES2020). All logic lives in a single IIFE in `js/app.js`; styles in `css/styles.css`; markup in `index.html`. Chart.js is loaded from CDN. Data persists via `localStorage`.

## Tasks

- [x] 1. Project scaffolding — folder structure and HTML skeleton
  - Create `css/` and `js/` subdirectories
  - Create `index.html` with `<!DOCTYPE html>`, `<meta charset>`, `<meta name="viewport">`, `<title>`, and `<link>` to `css/styles.css`
  - Add CDN `<script>` for Chart.js (`chart.umd.min.js@4`) **before** `js/app.js` script tag
  - Add empty `<script src="js/app.js"></script>` tag
  - Create empty `css/styles.css` and `js/app.js` placeholder files
  - _Requirements: 7.2, 7.3_

- [x] 2. HTML structure — all semantic sections
  - [x] 2.1 Implement `<header>` with app title and `#balance-display`
    - Write `<header>` containing `<h1>Expense & Budget Visualizer</h1>` and `<div id="balance-display">Total: $0.00</div>`
    - _Requirements: 4.1_

  - [x] 2.2 Implement `#form-section` with form fields and error container
    - Write `<section id="form-section">` containing `<form id="transaction-form">` with `#input-name` (text, maxlength="100"), `#input-amount` (number, min="0.01", step="0.01"), `#input-category` (select with placeholder + Food/Transport/Fun options), and submit button
    - Add `<div id="form-error" role="alert" aria-live="polite"></div>` after the form
    - Associate each input with a `<label>` via `for`/`id`
    - _Requirements: 1.1, 7.1_

  - [x] 2.3 Implement `#list-section` and `#chart-section`
    - Write `<section id="list-section">` containing `<ul id="transaction-list"></ul>`
    - Write `<section id="chart-section">` containing `<canvas id="spending-chart"></canvas>` and `<div id="chart-placeholder">No data yet</div>`
    - _Requirements: 2.2, 5.5_

- [x] 3. CSS styling — layout and component styles
  - [x] 3.1 Implement CSS custom properties, reset, and base typography
    - Define `:root` custom properties for colors (`--color-food`, `--color-transport`, `--color-fun`), spacing, and font settings
    - Apply a minimal CSS reset (box-sizing, margin/padding zero)
    - Style `body`, `h1`, and general typography
    - _Requirements: 8.3_

  - [x] 3.2 Implement responsive grid layout
    - Style `<header>` to always span full width
    - Style `<main>` as CSS Grid: single column on `< 768px`; two-column (`form` left, `chart` right) on `≥ 768px`; max-width `1100px` centered on `≥ 1200px`
    - Ensure `#list-section` spans full grid width below the two-column row
    - _Requirements: 8.3_

  - [x] 3.3 Implement component styles (form, list, chart, error/warning)
    - Style the input form: field widths, spacing, submit button hover/focus states
    - Style `#transaction-list`: `max-height` with `overflow-y: auto` (scrollable), `<li>` flex row with name/amount/category/delete laid out
    - Style `#balance-display`: prominent font size and weight
    - Style `#form-error` (error) and storage-warning banner: color-coded, readable
    - Ensure delete button is clearly labelled and accessible (focus ring)
    - _Requirements: 2.2, 4.1, 8.3_

- [x] 4. Storage module (`js/app.js` — Storage section)
  - [x] 4.1 Implement `isStorageAvailable()`
    - Write function that performs a probe write/read/delete on `localStorage` inside a `try/catch`; returns `true` on success, `false` on any exception
    - _Requirements: 7.4_

  - [x] 4.2 Implement `loadFromStorage()` and `saveToStorage(txList)`
    - `loadFromStorage`: reads `STORAGE_KEY`, parses JSON in `try/catch`, validates result is an array; on any error returns `[]` and calls `showStorageWarning()`
    - `saveToStorage(txList)`: serializes array to JSON and writes to `localStorage` in `try/catch`; returns `true` on success, `false` on `QuotaExceededError` or other exception
    - _Requirements: 6.3, 6.4, 6.5_

  - [ ]* 4.3 Write property test for serialization round-trip (Property 4)
    - **Property 4: Serialization round-trip preserves all required fields**
    - Use `fc.array(transactionArb)` as generator; assert that mock-writing then mock-reading produces an array deep-equal to the original (same `id`, `name`, `amount`, `category`, `createdAt`, same order)
    - **Validates: Requirements 2.3, 6.3, 6.5**

- [x] 5. Validation module (`js/app.js` — Validation section)
  - [x] 5.1 Implement `validateForm(name, amount, category)`
    - Apply all rules: `name` required and non-empty after trim, max 100 chars; `amount` parseable as float, > 0, ≤ 999_999_999.99; `category` must be one of `CATEGORIES`
    - Return `{ valid: boolean, errors: string[] }` with human-readable messages for each failing rule
    - _Requirements: 1.3, 1.4, 1.5_

  - [ ]* 5.2 Write property test for validation rejecting all invalid inputs (Property 2)
    - **Property 2: Validation rejects all classes of invalid input**
    - Use `fc.oneof(fc.constant(''), fc.string({minLength:101}))` for name; `fc.oneof(fc.constant(0), fc.float({max:-0.01}), fc.constant('abc'))` for amount; assert `validateForm` returns `valid: false` with non-empty `errors` array
    - **Validates: Requirements 1.3, 1.4, 1.5**

- [x] 6. Transaction operations (`js/app.js` — Transaction Operations section)
  - [x] 6.1 Implement `addTransaction(name, amount, category)`
    - Generate a unique `id` with `crypto.randomUUID()` and timestamp with `Date.now()`
    - Prepend new Transaction object to the `transactions` array
    - Call `saveToStorage(transactions)`; on failure revert the prepend and surface the error
    - Return the created Transaction object
    - _Requirements: 1.2, 6.1, 6.5_

  - [ ]* 6.2 Write property test for valid transaction addition (Property 1)
    - **Property 1: Valid transaction addition is reflected in state and storage**
    - Use `fc.record({ name: fc.string({minLength:1, maxLength:100}), amount: fc.float({min:0.01, max:999999999.99}), category: fc.constantFrom(...CATEGORIES) })` as generator; assert returned transaction appears at `transactions[0]` and mocked localStorage contains a matching entry
    - **Validates: Requirements 1.2, 6.1, 6.5**

  - [x] 6.3 Implement `deleteTransaction(id)` and `getTransaction(id)`
    - `deleteTransaction(id)`: filter `transactions` to remove matching item; call `saveToStorage`; if save returns `false`, restore the original array and return `false`; otherwise return `true`
    - `getTransaction(id)`: find and return transaction by `id`; return `undefined` if not found
    - _Requirements: 3.3, 3.4, 3.5, 6.2_

  - [ ]* 6.4 Write property test for deletion correctness (Property 5)
    - **Property 5: Deletion removes exactly one transaction and preserves all others**
    - Use `fc.array(transactionArb, {minLength:1})` and a random valid index; assert deleted id is absent, all others are present and unmodified with same relative order, and mocked localStorage reflects the updated array
    - **Validates: Requirements 3.3, 3.5, 6.2**

- [x] 7. Checkpoint — core data layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Balance module (`js/app.js` — Balance section)
  - [x] 8.1 Implement `computeBalance(txList)` and `formatCurrency(amount)`
    - `computeBalance(txList)`: reduce `txList` to sum of `amount` fields; return `0` for empty array
    - `formatCurrency(amount)`: return `"$" + amount.toFixed(2)` with exactly two decimal places
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 8.2 Write property test for balance computation (Property 6)
    - **Property 6: Balance computation is the exact sum of all transaction amounts**
    - Use `fc.array(fc.float({min:0.01, max:1000}))` mapped to transaction objects; assert `computeBalance` equals `amounts.reduce((a,b)=>a+b, 0)` and `formatCurrency` output matches pattern `$N.NN`
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

- [x] 9. Chart module (`js/app.js` — Chart section)
  - [x] 9.1 Implement `computeCategoryTotals(txList)`
    - Accumulate amounts by category into `{ Food: 0, Transport: 0, Fun: 0 }`
    - Build `labels`, `data`, `colors` arrays including only categories with total strictly > 0
    - Return `{ labels, data, colors }`
    - _Requirements: 5.1, 5.6_

  - [ ]* 9.2 Write property test for zero-sum category exclusion (Property 7)
    - **Property 7: Category totals exclude zero-sum categories**
    - Use `fc.array(transactionArb)` with some categories having zero total; assert every entry in returned `data` is > 0, absent categories have zero total, and `data.reduce((a,b)=>a+b,0)` equals `computeBalance(txList)`
    - **Validates: Requirements 5.6**

  - [x] 9.3 Implement `renderChart(txList)`
    - Destroy existing `chartInstance` if non-null before any re-render
    - If `computeCategoryTotals` returns empty `data`: hide canvas, show `#chart-placeholder`, set `chartInstance = null`
    - Otherwise: show canvas, hide placeholder, create new `Chart(ctx, { type: 'pie', data: { labels, datasets: [{ data, backgroundColor: colors }] }, options: { responsive: true, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: ... } } } } })`
    - Store new instance in `chartInstance`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 10. Render module (`js/app.js` — Render section)
  - [x] 10.1 Implement `renderTransactionList(txList)`
    - Clear `#transaction-list` inner HTML
    - If `txList` is empty: inject a `<li>` (or `<p>`) with "No transactions yet" message
    - Otherwise: iterate `txList` (newest-first order is maintained by prepend in `addTransaction`), append `<li data-id="{id}">` containing `<span class="tx-name">`, `<span class="tx-amount">`, `<span class="tx-category">`, and `<button class="btn-delete" aria-label="Delete {name}">Delete</button>`
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 3.1_

  - [ ]* 10.2 Write property test for rendered list formatting and sort order (Property 3)
    - **Property 3: Rendered transaction list is correctly formatted and sorted**
    - Use `fc.array(transactionArb, {minLength:1})` as generator; render to a JSDOM-based DOM; assert each `<li>` contains correctly formatted `$X.XX` amount, displays name and category, is ordered newest-first by `createdAt`, and has a `.btn-delete` element
    - **Validates: Requirements 2.1, 3.1**

  - [x] 10.3 Implement `renderBalance(txList)`, `renderAll()`, `showFormError(messages)`, `clearFormError()`, `showStorageWarning(msg)`, and `resetForm()`
    - `renderBalance(txList)`: compute balance, format, set `#balance-display` text content
    - `renderAll()`: call `renderTransactionList`, `renderBalance`, `renderChart` with current `transactions`
    - `showFormError(messages)`: join messages (newline or `<br>`), set `#form-error` text/innerHTML
    - `clearFormError()`: clear `#form-error`
    - `showStorageWarning(msg)`: inject a dismissible `<div class="storage-warning">` banner at the top of `<main>`; guard against injecting duplicate banners
    - `resetForm()`: reset `#transaction-form` and clear validation error styling
    - _Requirements: 1.3, 1.6, 2.1, 4.1, 6.4, 7.4_

- [x] 11. Event handlers and init (`js/app.js` — Event Handlers and Init sections)
  - [x] 11.1 Implement `handleFormSubmit(e)` and `handleDeleteClick(e)`
    - `handleFormSubmit(e)`: `e.preventDefault()`, read trimmed values from `#input-name`, `#input-amount`, `#input-category`; call `validateForm`; on error call `showFormError(errors)` and return; on success call `addTransaction`, `clearFormError`, `resetForm`, `renderAll`
    - `handleDeleteClick(e)`: check `e.target.classList.contains('btn-delete')`; read `data-id` from closest `<li>`; call `window.confirm('Delete this transaction?')`; on confirm call `deleteTransaction(id)`; if `deleteTransaction` returns `false` call `showStorageWarning` with write-failure message; call `renderAll`
    - _Requirements: 1.2, 1.3, 1.6, 3.2, 3.3, 3.4_

  - [x] 11.2 Implement `init()` and `DOMContentLoaded` bootstrap
    - `init()`: call `isStorageAvailable()`; if false call `showStorageWarning(...)` and still proceed (session-only mode); load `transactions = loadFromStorage()`; call `renderAll()`; attach `submit` listener to `#transaction-form` and delegated `click` listener to `#transaction-list`
    - Wire `document.addEventListener('DOMContentLoaded', init)` outside the IIFE (or at the bottom inside it)
    - Wrap entire logic in an IIFE `(function () { ... })()` to avoid polluting global namespace
    - _Requirements: 2.3, 4.4, 6.3, 6.4, 7.4_

- [x] 12. End-to-end integration and smoke testing
  - [x] 12.1 Wire all modules together and verify the complete data flow
    - Confirm `addTransaction` → `saveToStorage` → `renderAll` pipeline works end-to-end in the browser
    - Confirm `deleteTransaction` → `saveToStorage` → `renderAll` pipeline and rollback on write failure
    - Confirm `init` → `loadFromStorage` → `renderAll` restores all data on page reload
    - Confirm Chart.js instance destroy/recreate cycle does not produce canvas warnings
    - _Requirements: 1.2, 2.3, 2.4, 3.3, 4.2, 4.3, 4.4, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3_

  - [ ]* 12.2 Write integration smoke tests for critical user flows
    - Test: add a transaction → verify list, balance, and chart update
    - Test: delete a transaction → verify list, balance, and chart update
    - Test: reload with seeded localStorage → verify all data restored
    - Test: submit invalid form → verify error shown and state unchanged
    - _Requirements: 1.2, 1.3, 2.3, 3.3, 4.2, 5.2, 6.3_

- [-] 13. Final checkpoint — ensure everything passes
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use **fast-check** with a minimum of 100 iterations per property, tagged with `// Feature: expense-budget-visualizer, Property N: <text>`
- Unit tests complement property tests — both are encouraged
- All DOM element reads (`getElementById`) happen at event-handler call time, not at module load, to survive potential DOM resets
- `transactions` is always a sorted (newest-first) array and is the single source of truth; localStorage is a write-through cache

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 1, "tasks": ["3.1", "4.1", "4.2"] },
    { "id": 2, "tasks": ["3.2", "3.3", "4.3", "5.1"] },
    { "id": 3, "tasks": ["5.2", "6.1"] },
    { "id": 4, "tasks": ["6.2", "6.3", "8.1"] },
    { "id": 5, "tasks": ["6.4", "8.2", "9.1"] },
    { "id": 6, "tasks": ["9.2", "9.3", "10.1"] },
    { "id": 7, "tasks": ["10.2", "10.3"] },
    { "id": 8, "tasks": ["11.1"] },
    { "id": 9, "tasks": ["11.2"] },
    { "id": 10, "tasks": ["12.1"] },
    { "id": 11, "tasks": ["12.2"] }
  ]
}
```
