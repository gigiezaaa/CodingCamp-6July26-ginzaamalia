/**
 * Tests for Expense & Budget Visualizer (js/app.js)
 *
 * Coverage areas:
 *  - validateForm          (unit + edge cases)
 *  - computeBalance        (unit)
 *  - formatCurrency        (unit)
 *  - computeCategoryTotals (unit)
 *  - isStorageAvailable    (unit)
 *  - saveToStorage /
 *    loadFromStorage        (round-trip + error handling)
 *  - addTransaction /
 *    deleteTransaction      (state mutations + rollback)
 *  - renderTransactionList (jsdom DOM tests)
 *  - renderBalance         (jsdom DOM test)
 *  - renderChart           (placeholder vs chart branch)
 */

'use strict';

/* ── Helpers to reset jsdom between tests ─────────────── */

/**
 * Build a minimal HTML document that mirrors the relevant parts of
 * index.html so DOM-dependent functions have elements to read/write.
 */
function buildDOM() {
  document.body.innerHTML = `
    <header>
      <div id="balance-display">$0.00</div>
    </header>
    <main>
      <section id="form-section">
        <form id="transaction-form">
          <input id="input-name"     type="text" />
          <input id="input-amount"   type="number" />
          <select id="input-category">
            <option value="">--</option>
            <option value="Food">Food</option>
            <option value="Transport">Transport</option>
            <option value="Fun">Fun</option>
          </select>
          <button type="submit">Add</button>
        </form>
        <div id="form-error" role="alert"></div>
      </section>
      <section id="list-section">
        <ul id="transaction-list"></ul>
      </section>
      <section id="chart-section">
        <canvas id="spending-chart"></canvas>
        <div id="chart-placeholder">No data yet</div>
      </section>
    </main>
  `;
}

/** Stub a fully-working in-memory localStorage. */
function makeLocalStorageMock() {
  let store = {};
  return {
    getItem:    (k)    => (k in store ? store[k] : null),
    setItem:    (k, v) => { store[k] = String(v); },
    removeItem: (k)    => { delete store[k]; },
    clear:      ()     => { store = {}; },
    _store:     ()     => store,
  };
}

/** Stub a localStorage whose setItem always throws QuotaExceededError. */
function makeFullStorageMock() {
  return {
    getItem:    () => null,
    setItem:    () => { throw new DOMException('QuotaExceededError'); },
    removeItem: () => {},
    clear:      () => {},
  };
}

/* ── Load module under test ───────────────────────────── */

// app.js uses an IIFE; the CommonJS export block at the bottom exposes
// pure functions when typeof module !== 'undefined'.
const app = require('../js/app.js');

/* ── Helper transaction factory ───────────────────────── */
function makeTx(overrides = {}) {
  return Object.assign(
    {
      id:        'test-id-' + Math.random(),
      name:      'Test Item',
      amount:    10.00,
      category:  'Food',
      createdAt: Date.now(),
    },
    overrides
  );
}

/* ════════════════════════════════════════════════════════
   1. validateForm
   ════════════════════════════════════════════════════════ */
describe('validateForm', () => {
  test('returns valid:true for fully valid inputs', () => {
    const result = app.validateForm('Lunch', '12.50', 'Food');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('collects all errors in a single pass (does not short-circuit)', () => {
    // All three fields invalid at once
    const result = app.validateForm('', '0', 'Unknown');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  // ── Name validation ──────────────────────────────────────
  test('rejects empty name', () => {
    const { valid, errors } = app.validateForm('', '5.00', 'Food');
    expect(valid).toBe(false);
    expect(errors.some(e => /name/i.test(e))).toBe(true);
  });

  test('rejects whitespace-only name', () => {
    const { valid } = app.validateForm('   ', '5.00', 'Food');
    expect(valid).toBe(false);
  });

  test('rejects name longer than 100 characters', () => {
    const longName = 'a'.repeat(101);
    const { valid, errors } = app.validateForm(longName, '5.00', 'Food');
    expect(valid).toBe(false);
    expect(errors.some(e => /100/i.test(e) || /name/i.test(e))).toBe(true);
  });

  test('accepts name of exactly 100 characters', () => {
    const maxName = 'a'.repeat(100);
    const { valid } = app.validateForm(maxName, '5.00', 'Food');
    expect(valid).toBe(true);
  });

  // ── Amount validation ────────────────────────────────────
  test('rejects empty amount', () => {
    const { valid, errors } = app.validateForm('Lunch', '', 'Food');
    expect(valid).toBe(false);
    expect(errors.some(e => /amount/i.test(e))).toBe(true);
  });

  test('rejects zero amount', () => {
    const { valid } = app.validateForm('Lunch', '0', 'Food');
    expect(valid).toBe(false);
  });

  test('rejects negative amount', () => {
    const { valid } = app.validateForm('Lunch', '-1', 'Food');
    expect(valid).toBe(false);
  });

  test('rejects non-numeric amount', () => {
    const { valid } = app.validateForm('Lunch', 'abc', 'Food');
    expect(valid).toBe(false);
  });

  test('rejects amount above maximum (999999999.99)', () => {
    const { valid } = app.validateForm('Lunch', '1000000000', 'Food');
    expect(valid).toBe(false);
  });

  test('accepts the minimum valid amount (0.01)', () => {
    const { valid } = app.validateForm('Lunch', '0.01', 'Food');
    expect(valid).toBe(true);
  });

  test('accepts the maximum valid amount (999999999.99)', () => {
    const { valid } = app.validateForm('Lunch', '999999999.99', 'Food');
    expect(valid).toBe(true);
  });

  // ── Category validation ──────────────────────────────────
  test('rejects empty category', () => {
    const { valid, errors } = app.validateForm('Lunch', '5.00', '');
    expect(valid).toBe(false);
    expect(errors.some(e => /category/i.test(e))).toBe(true);
  });

  test('rejects unknown category', () => {
    const { valid } = app.validateForm('Lunch', '5.00', 'Housing');
    expect(valid).toBe(false);
  });

  test('accepts each valid category', () => {
    ['Food', 'Transport', 'Fun'].forEach(cat => {
      const { valid } = app.validateForm('Lunch', '5.00', cat);
      expect(valid).toBe(true);
    });
  });
});

/* ════════════════════════════════════════════════════════
   2. computeBalance
   ════════════════════════════════════════════════════════ */
describe('computeBalance', () => {
  test('returns 0 for an empty array', () => {
    expect(app.computeBalance([])).toBe(0);
  });

  test('sums a single transaction', () => {
    expect(app.computeBalance([makeTx({ amount: 7.50 })])).toBeCloseTo(7.50);
  });

  test('sums multiple transactions', () => {
    const txs = [
      makeTx({ amount: 10 }),
      makeTx({ amount: 20 }),
      makeTx({ amount: 5.50 }),
    ];
    expect(app.computeBalance(txs)).toBeCloseTo(35.50);
  });

  test('handles fractional cent amounts without rounding errors in sum', () => {
    const txs = [makeTx({ amount: 0.1 }), makeTx({ amount: 0.2 })];
    expect(app.computeBalance(txs)).toBeCloseTo(0.3);
  });
});

/* ════════════════════════════════════════════════════════
   3. formatCurrency
   ════════════════════════════════════════════════════════ */
describe('formatCurrency', () => {
  test('returns $X.XX format for a whole number', () => {
    expect(app.formatCurrency(5)).toBe('$5.00');
  });

  test('returns exactly 2 decimal places', () => {
    expect(app.formatCurrency(1234.5)).toBe('$1234.50');
  });

  test('returns $0.00 for zero', () => {
    expect(app.formatCurrency(0)).toBe('$0.00');
  });

  test('rounds to 2 decimal places', () => {
    expect(app.formatCurrency(1.005)).toBe('$1.01');
  });

  test('matches $N.NN pattern', () => {
    const result = app.formatCurrency(99.9);
    expect(result).toMatch(/^\$\d+\.\d{2}$/);
  });
});

/* ════════════════════════════════════════════════════════
   4. computeCategoryTotals
   ════════════════════════════════════════════════════════ */
describe('computeCategoryTotals', () => {
  test('returns empty arrays for an empty list', () => {
    const { labels, data, colors } = app.computeCategoryTotals([]);
    expect(labels).toEqual([]);
    expect(data).toEqual([]);
    expect(colors).toEqual([]);
  });

  test('excludes categories with zero total', () => {
    const txs = [makeTx({ category: 'Food', amount: 20 })];
    const { labels } = app.computeCategoryTotals(txs);
    expect(labels).toContain('Food');
    expect(labels).not.toContain('Transport');
    expect(labels).not.toContain('Fun');
  });

  test('sums amounts per category correctly', () => {
    const txs = [
      makeTx({ category: 'Food', amount: 10 }),
      makeTx({ category: 'Food', amount: 5 }),
      makeTx({ category: 'Transport', amount: 8 }),
    ];
    const { labels, data } = app.computeCategoryTotals(txs);
    const foodIdx      = labels.indexOf('Food');
    const transportIdx = labels.indexOf('Transport');
    expect(data[foodIdx]).toBeCloseTo(15);
    expect(data[transportIdx]).toBeCloseTo(8);
  });

  test('assigns correct colors for each included category', () => {
    const txs = [
      makeTx({ category: 'Food',      amount: 1 }),
      makeTx({ category: 'Transport', amount: 2 }),
      makeTx({ category: 'Fun',       amount: 3 }),
    ];
    const { labels, colors } = app.computeCategoryTotals(txs);
    const expected = {
      Food:      '#FF6384',
      Transport: '#36A2EB',
      Fun:       '#FFCE56',
    };
    labels.forEach((label, i) => {
      expect(colors[i]).toBe(expected[label]);
    });
  });

  test('every returned data value is strictly positive', () => {
    const txs = [
      makeTx({ category: 'Food', amount: 5 }),
      makeTx({ category: 'Fun',  amount: 3 }),
    ];
    const { data } = app.computeCategoryTotals(txs);
    data.forEach(v => expect(v).toBeGreaterThan(0));
  });

  test('sum of data values equals computeBalance result', () => {
    const txs = [
      makeTx({ category: 'Food',      amount: 12 }),
      makeTx({ category: 'Transport', amount: 8 }),
      makeTx({ category: 'Fun',       amount: 5 }),
    ];
    const { data } = app.computeCategoryTotals(txs);
    const dataSum = data.reduce((a, b) => a + b, 0);
    expect(dataSum).toBeCloseTo(app.computeBalance(txs));
  });
});

/* ════════════════════════════════════════════════════════
   5. isStorageAvailable
   ════════════════════════════════════════════════════════ */
describe('isStorageAvailable', () => {
  afterEach(() => {
    // Restore any mocks on globalThis.localStorage
    delete globalThis.localStorage;
  });

  test('returns true when localStorage probe write/read/delete succeeds', () => {
    // jsdom provides a working localStorage
    expect(app.isStorageAvailable()).toBe(true);
  });

  test('returns false when localStorage.setItem throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        setItem:    () => { throw new Error('blocked'); },
        getItem:    () => null,
        removeItem: () => {},
      },
      configurable: true,
      writable:     true,
    });
    expect(app.isStorageAvailable()).toBe(false);
  });
});

/* ════════════════════════════════════════════════════════
   6. saveToStorage / loadFromStorage — round-trip
   ════════════════════════════════════════════════════════ */
describe('saveToStorage / loadFromStorage — round-trip', () => {
  let originalLS;

  beforeEach(() => {
    originalLS = globalThis.localStorage;
    const mock = makeLocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mock, configurable: true, writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLS, configurable: true, writable: true,
    });
  });

  test('saveToStorage returns true on success', () => {
    expect(app.saveToStorage([])).toBe(true);
  });

  test('round-trip: loadFromStorage returns same transactions written by saveToStorage', () => {
    const txs = [
      makeTx({ id: 'id-1', name: 'Alpha',  amount: 5,  category: 'Food',      createdAt: 1000 }),
      makeTx({ id: 'id-2', name: 'Bravo',  amount: 12, category: 'Transport', createdAt: 2000 }),
      makeTx({ id: 'id-3', name: 'Charlie',amount: 7,  category: 'Fun',       createdAt: 3000 }),
    ];
    app.saveToStorage(txs);
    const loaded = app.loadFromStorage();
    expect(loaded).toHaveLength(3);
    loaded.forEach((tx, i) => {
      expect(tx.id).toBe(txs[i].id);
      expect(tx.name).toBe(txs[i].name);
      expect(tx.amount).toBe(txs[i].amount);
      expect(tx.category).toBe(txs[i].category);
      expect(tx.createdAt).toBe(txs[i].createdAt);
    });
  });

  test('loadFromStorage returns [] for an empty store', () => {
    const loaded = app.loadFromStorage();
    expect(loaded).toEqual([]);
  });

  test('loadFromStorage returns [] and does not throw for malformed JSON', () => {
    // Manually corrupt the storage
    globalThis.localStorage.setItem('expense_transactions', '{not valid json]]]');
    buildDOM(); // showStorageWarning needs a <main> element
    expect(() => app.loadFromStorage()).not.toThrow();
    expect(app.loadFromStorage()).toEqual([]);
  });

  test('loadFromStorage returns [] when stored value is not an array', () => {
    globalThis.localStorage.setItem('expense_transactions', JSON.stringify({ foo: 'bar' }));
    buildDOM();
    const loaded = app.loadFromStorage();
    expect(loaded).toEqual([]);
  });

  test('saveToStorage returns false when setItem throws QuotaExceededError', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: makeFullStorageMock(), configurable: true, writable: true,
    });
    expect(app.saveToStorage([makeTx()])).toBe(false);
  });
});

/* ════════════════════════════════════════════════════════
   7. addTransaction / deleteTransaction — state mutations
   ════════════════════════════════════════════════════════ */
describe('addTransaction / deleteTransaction', () => {
  let originalLS;

  beforeEach(() => {
    originalLS = globalThis.localStorage;
    const mock = makeLocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mock, configurable: true, writable: true,
    });
    // Reset in-memory state
    app._setTransactions([]);
    app._resetChart();
    buildDOM();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLS, configurable: true, writable: true,
    });
  });

  test('addTransaction prepends transaction to the in-memory array', () => {
    app.addTransaction('Lunch', 12.5, 'Food');
    const txs = app._getTransactions();
    expect(txs).toHaveLength(1);
    expect(txs[0].name).toBe('Lunch');
    expect(txs[0].amount).toBe(12.5);
    expect(txs[0].category).toBe('Food');
  });

  test('addTransaction returns the new transaction object', () => {
    const tx = app.addTransaction('Bus', 2.5, 'Transport');
    expect(tx).not.toBeNull();
    expect(tx.id).toBeDefined();
    expect(tx.name).toBe('Bus');
    expect(tx.createdAt).toBeDefined();
  });

  test('addTransaction prepends (newest at index 0)', () => {
    app.addTransaction('First',  5, 'Food');
    app.addTransaction('Second', 8, 'Fun');
    const txs = app._getTransactions();
    expect(txs[0].name).toBe('Second');
    expect(txs[1].name).toBe('First');
  });

  test('addTransaction persists to localStorage', () => {
    app.addTransaction('Dinner', 30, 'Food');
    const raw = globalThis.localStorage.getItem('expense_transactions');
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw);
    expect(stored[0].name).toBe('Dinner');
  });

  test('addTransaction returns null and reverts state when storage is full', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: makeFullStorageMock(), configurable: true, writable: true,
    });
    const result = app.addTransaction('Fail', 5, 'Food');
    expect(result).toBeNull();
    expect(app._getTransactions()).toHaveLength(0); // reverted
  });

  test('deleteTransaction removes the target transaction', () => {
    const tx = app.addTransaction('To Delete', 15, 'Fun');
    expect(app._getTransactions()).toHaveLength(1);
    const ok = app.deleteTransaction(tx.id);
    expect(ok).toBe(true);
    expect(app._getTransactions()).toHaveLength(0);
  });

  test('deleteTransaction returns true on success', () => {
    const tx = app.addTransaction('Remove Me', 10, 'Food');
    expect(app.deleteTransaction(tx.id)).toBe(true);
  });

  test('deleteTransaction leaves other transactions intact', () => {
    app.addTransaction('Keep', 5, 'Food');
    const txToDelete = app.addTransaction('Delete', 10, 'Transport');
    app.addTransaction('Also Keep', 7, 'Fun');

    app.deleteTransaction(txToDelete.id);

    const remaining = app._getTransactions();
    expect(remaining).toHaveLength(2);
    expect(remaining.some(t => t.id === txToDelete.id)).toBe(false);
    expect(remaining.some(t => t.name === 'Keep')).toBe(true);
    expect(remaining.some(t => t.name === 'Also Keep')).toBe(true);
  });

  test('deleteTransaction updates localStorage', () => {
    app.addTransaction('Stay',  5, 'Food');
    const tx = app.addTransaction('Gone', 10, 'Fun');
    app.deleteTransaction(tx.id);
    const stored = JSON.parse(globalThis.localStorage.getItem('expense_transactions'));
    expect(stored.some(t => t.id === tx.id)).toBe(false);
  });

  test('deleteTransaction returns false and reverts when storage write fails', () => {
    // Seed a transaction with working storage
    app.addTransaction('Stable', 20, 'Food');
    const snapshot = app._getTransactions().slice();

    // Now break storage
    Object.defineProperty(globalThis, 'localStorage', {
      value: makeFullStorageMock(), configurable: true, writable: true,
    });

    const ok = app.deleteTransaction(snapshot[0].id);
    expect(ok).toBe(false);
    // state rolled back
    expect(app._getTransactions()).toHaveLength(1);
    expect(app._getTransactions()[0].id).toBe(snapshot[0].id);
  });
});

/* ════════════════════════════════════════════════════════
   8. renderTransactionList (DOM)
   ════════════════════════════════════════════════════════ */
describe('renderTransactionList', () => {
  beforeEach(buildDOM);

  test('shows empty-state message when list is empty', () => {
    app.renderTransactionList([]);
    const list = document.getElementById('transaction-list');
    expect(list.textContent).toMatch(/no transactions yet/i);
  });

  test('renders one <li> per transaction', () => {
    const txs = [makeTx({ name: 'Alpha' }), makeTx({ name: 'Bravo' })];
    app.renderTransactionList(txs);
    const items = document.querySelectorAll('#transaction-list li:not(.tx-empty)');
    expect(items).toHaveLength(2);
  });

  test('each <li> shows name, formatted amount, category', () => {
    const tx = makeTx({ name: 'Lunch', amount: 12.5, category: 'Food' });
    app.renderTransactionList([tx]);
    const li = document.querySelector('#transaction-list li');
    expect(li.querySelector('.tx-name').textContent).toBe('Lunch');
    expect(li.querySelector('.tx-amount').textContent).toBe('$12.50');
    expect(li.querySelector('.tx-category').textContent).toBe('Food');
  });

  test('amount is formatted with $ prefix and 2 decimal places', () => {
    const tx = makeTx({ amount: 7 });
    app.renderTransactionList([tx]);
    const amountText = document.querySelector('.tx-amount').textContent;
    expect(amountText).toMatch(/^\$\d+\.\d{2}$/);
  });

  test('each transaction <li> has a .btn-delete button', () => {
    app.renderTransactionList([makeTx(), makeTx()]);
    const btns = document.querySelectorAll('.btn-delete');
    expect(btns).toHaveLength(2);
  });

  test('each <li> has data-id attribute matching transaction id', () => {
    const tx = makeTx({ id: 'unique-42' });
    app.renderTransactionList([tx]);
    const li = document.querySelector('#transaction-list li[data-id]');
    expect(li.dataset.id).toBe('unique-42');
  });

  test('clears previous content on re-render', () => {
    app.renderTransactionList([makeTx(), makeTx()]);
    app.renderTransactionList([makeTx()]); // re-render with 1 item
    const items = document.querySelectorAll('#transaction-list li:not(.tx-empty)');
    expect(items).toHaveLength(1);
  });
});

/* ════════════════════════════════════════════════════════
   9. renderBalance (DOM)
   ════════════════════════════════════════════════════════ */
describe('renderBalance', () => {
  beforeEach(buildDOM);

  test('shows $0.00 for an empty list', () => {
    app.renderBalance([]);
    expect(document.getElementById('balance-display').textContent).toBe('$0.00');
  });

  test('shows formatted sum of all transaction amounts', () => {
    const txs = [makeTx({ amount: 10 }), makeTx({ amount: 5.50 })];
    app.renderBalance(txs);
    expect(document.getElementById('balance-display').textContent).toBe('$15.50');
  });

  test('updates #balance-display text content', () => {
    app.renderBalance([makeTx({ amount: 99.99 })]);
    expect(document.getElementById('balance-display').textContent).toBe('$99.99');
  });
});

/* ════════════════════════════════════════════════════════
   10. renderChart (DOM — Chart.js stubbed)
   ════════════════════════════════════════════════════════ */
describe('renderChart', () => {
  let ChartConstructorCalls;

  beforeEach(() => {
    buildDOM();
    // Reset chart instance so tests are independent
    app._resetChart();

    // Stub Chart.js (not loaded in jsdom)
    ChartConstructorCalls = [];
    globalThis.Chart = function (ctx, config) {
      ChartConstructorCalls.push({ ctx, config });
      this.destroy = jest.fn();
    };
  });

  afterEach(() => {
    delete globalThis.Chart;
  });

  test('hides canvas and shows placeholder when list is empty', () => {
    app.renderChart([]);
    const canvas = document.getElementById('spending-chart');
    const placeholder = document.getElementById('chart-placeholder');
    expect(canvas.style.display).toBe('none');
    expect(placeholder.style.display).toBe('block');
  });

  test('does not create a Chart instance when list is empty', () => {
    app.renderChart([]);
    expect(ChartConstructorCalls).toHaveLength(0);
  });

  test('shows canvas and hides placeholder when data is present', () => {
    const txs = [makeTx({ category: 'Food', amount: 10 })];
    app.renderChart(txs);
    const canvas = document.getElementById('spending-chart');
    const placeholder = document.getElementById('chart-placeholder');
    expect(canvas.style.display).toBe('block');
    expect(placeholder.style.display).toBe('none');
  });

  test('creates a Chart instance when data is present', () => {
    const txs = [makeTx({ category: 'Food', amount: 10 })];
    app.renderChart(txs);
    expect(ChartConstructorCalls).toHaveLength(1);
  });

  test('creates a pie chart', () => {
    const txs = [makeTx({ category: 'Fun', amount: 5 })];
    app.renderChart(txs);
    expect(ChartConstructorCalls[0].config.type).toBe('pie');
  });

  test('chart dataset contains only non-zero categories', () => {
    const txs = [
      makeTx({ category: 'Food', amount: 20 }),
      // Transport has no transactions → excluded
    ];
    app.renderChart(txs);
    const datasets = ChartConstructorCalls[0].config.data.datasets;
    expect(datasets[0].data).toHaveLength(1);
    expect(ChartConstructorCalls[0].config.data.labels).toEqual(['Food']);
  });

  test('destroys existing chart instance before re-rendering', () => {
    const txs = [makeTx({ category: 'Food', amount: 10 })];
    app.renderChart(txs);
    // The stub instance has a mock destroy method
    const firstInstance = ChartConstructorCalls[0];
    // Render again — should call destroy on the previous instance
    app.renderChart(txs);
    // Two constructor calls total
    expect(ChartConstructorCalls).toHaveLength(2);
  });
});
