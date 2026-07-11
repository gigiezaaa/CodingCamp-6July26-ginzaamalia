(function () {

  /* ── Constants ─────────────────────────────────────── */

  const STORAGE_KEY = 'expense_transactions';
  const CATEGORIES  = ['Food', 'Transport', 'Fun'];
  const MAX_NAME_LEN = 100;
  const CATEGORY_COLORS = {
    Food:      '#FF6384',
    Transport: '#36A2EB',
    Fun:       '#FFCE56'
  };

  /* ── State ─────────────────────────────────────────── */

  let transactions = [];   // Single source of truth; always newest-first
  let chartInstance = null; // Holds the Chart.js instance for destroy/recreate

  /* ── Storage Module ────────────────────────────────── */

  /**
   * Tests whether localStorage is available and usable.
   *
   * Performs a probe write → read → delete inside a try/catch.
   * Returns true only when all three operations succeed without throwing.
   * Returns false for any exception (storage disabled, private-browsing
   * restrictions, SecurityError, QuotaExceededError on probe, etc.).
   *
   * Used by init() to satisfy Requirement 7.4: if localStorage is
   * unavailable the app must show an informative error and must NOT
   * attempt to use the API.
   *
   * @returns {boolean}
   */
  function isStorageAvailable() {
    const PROBE_KEY = '__storage_test__';
    try {
      localStorage.setItem(PROBE_KEY, '1');
      localStorage.getItem(PROBE_KEY);
      localStorage.removeItem(PROBE_KEY);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Reads the transaction array from localStorage.
   *
   * Parses the stored JSON inside a try/catch. Validates that the result
   * is an array before returning it. Returns [] and calls
   * showStorageWarning() if the key is missing, the JSON is malformed,
   * or the parsed value is not an array.
   *
   * Satisfies Requirements 6.3, 6.4, 6.5.
   *
   * @returns {Transaction[]}
   */
  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        showStorageWarning('Stored data is corrupted and could not be loaded. Starting with an empty list.');
        return [];
      }
      return parsed;
    } catch (e) {
      showStorageWarning('Stored data could not be loaded. Starting with an empty list.');
      return [];
    }
  }

  /**
   * Writes the transaction array to localStorage as JSON.
   *
   * Returns true on success. Returns false if a QuotaExceededError or
   * any other exception is thrown, allowing the caller to roll back the
   * in-memory mutation and surface the error.
   *
   * Satisfies Requirements 6.3, 6.4, 6.5.
   *
   * @param {Transaction[]} txList
   * @returns {boolean}
   */
  function saveToStorage(txList) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(txList));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ── Validation Module ──────────────────────────────── */

  /**
   * Validates the three transaction form fields.
   *
   * Collects ALL validation errors (does not short-circuit on first
   * failure) so every failing field is reported in a single pass.
   *
   * Rules:
   *  - name   : required; non-empty after trim; max MAX_NAME_LEN chars
   *  - amount : parseable as float via parseFloat; > 0; ≤ 999_999_999.99
   *  - category: must be one of CATEGORIES
   *
   * Satisfies Requirements 1.3, 1.4, 1.5.
   *
   * @param {string} name
   * @param {string} amount
   * @param {string} category
   * @returns {{ valid: boolean, errors: string[] }}
   */
  function validateForm(name, amount, category) {
    const errors = [];

    // ── Name validation ──────────────────────────────────
    const trimmedName = (name || '').trim();
    if (trimmedName.length === 0) {
      errors.push('Item name is required.');
    } else if (trimmedName.length > MAX_NAME_LEN) {
      errors.push(`Item name must not exceed ${MAX_NAME_LEN} characters.`);
    }

    // ── Amount validation ────────────────────────────────
    const parsedAmount = parseFloat(amount);
    if (amount === '' || amount === null || amount === undefined) {
      errors.push('Amount is required.');
    } else if (isNaN(parsedAmount)) {
      errors.push('Amount must be a valid number.');
    } else if (parsedAmount <= 0) {
      errors.push('Amount must be a positive number.');
    } else if (parsedAmount > 999_999_999.99) {
      errors.push('Amount must not exceed 999,999,999.99.');
    }

    // ── Category validation ──────────────────────────────
    if (!category || !CATEGORIES.includes(category)) {
      errors.push('Please select a valid category (Food, Transport, or Fun).');
    }

    return { valid: errors.length === 0, errors };
  }

  /* ── Transaction Operations ─────────────────────────── */

  /**
   * Creates a new transaction, prepends it to the in-memory array,
   * and persists the updated array to localStorage.
   *
   * If saveToStorage returns false (e.g. QuotaExceededError), the
   * prepend is reverted so the in-memory state stays consistent, a
   * warning is surfaced via showStorageWarning, and null is returned
   * so the caller can detect the failure and skip form reset / renderAll.
   *
   * Satisfies Requirements 1.2, 6.1, 6.5.
   *
   * @param {string} name     - Trimmed item name (1–100 chars)
   * @param {number} amount   - Positive float (0.01 – 999_999_999.99)
   * @param {string} category - One of 'Food' | 'Transport' | 'Fun'
   * @returns {Transaction|null} - The newly created transaction object, or null on save failure
   */
  function addTransaction(name, amount, category) {
    const tx = {
      id:        crypto.randomUUID(),
      name:      name,
      amount:    amount,
      category:  category,
      createdAt: Date.now()
    };

    transactions.unshift(tx);

    const saved = saveToStorage(transactions);
    if (!saved) {
      // Revert the prepend so in-memory state stays consistent
      transactions.shift();
      showStorageWarning('Transaction could not be saved: storage quota exceeded or storage is unavailable.');
      return null; // signal failure to caller — do not reset form or update UI
    }

    return tx;
  }

  /**
   * Removes the transaction with the given id from the in-memory array
   * and persists the updated list to localStorage.
   *
   * If saveToStorage returns false (e.g. QuotaExceededError), the
   * original array is restored so in-memory state stays consistent and
   * the caller can surface an appropriate error.
   *
   * Satisfies Requirements 3.3, 3.4, 3.5, 6.2.
   *
   * @param {string} id - UUID of the transaction to remove
   * @returns {boolean} - true if deletion and save succeeded, false otherwise
   */
  function deleteTransaction(id) {
    const original = transactions.slice(); // snapshot for rollback
    transactions = transactions.filter(tx => tx.id !== id);

    const saved = saveToStorage(transactions);
    if (!saved) {
      // Restore original array so in-memory state stays consistent
      transactions = original;
      return false;
    }

    return true;
  }

  /**
   * Finds and returns the transaction with the given id.
   *
   * Returns undefined if no transaction with that id exists in the
   * current in-memory array.
   *
   * Satisfies Requirements 3.3, 3.4, 3.5, 6.2.
   *
   * @param {string} id - UUID of the transaction to retrieve
   * @returns {Transaction|undefined}
   */
  function getTransaction(id) {
    return transactions.find(tx => tx.id === id);
  }

  /* ── Balance Module ─────────────────────────────────── */

  /**
   * Reduces a transaction array to the arithmetic sum of all amount fields.
   *
   * Returns 0 for an empty array.
   *
   * Satisfies Requirements 4.1, 4.2, 4.3, 4.4, 4.5.
   *
   * @param {Transaction[]} txList
   * @returns {number}
   */
  function computeBalance(txList) {
    return txList.reduce(function (sum, tx) {
      return sum + tx.amount;
    }, 0);
  }

  /**
   * Formats a numeric amount as a currency string with exactly two
   * decimal places and a leading dollar sign.
   *
   * Example: formatCurrency(1234.5) → "$1234.50"
   *
   * Satisfies Requirements 4.1, 4.2, 4.3, 4.4, 4.5.
   *
   * @param {number} amount
   * @returns {string}
   */
  function formatCurrency(amount) {
    return '$' + amount.toFixed(2);
  }

  /* ── Chart Module ───────────────────────────────────── */

  /**
   * Groups transaction amounts by category and returns arrays ready for
   * Chart.js dataset consumption.
   *
   * Only categories with a strictly positive total are included in the
   * output — categories summing to zero are excluded so they do not
   * appear as zero-sized slices in the pie chart.
   *
   * Satisfies Requirements 5.1, 5.6.
   *
   * @param {Transaction[]} txList
   * @returns {{ labels: string[], data: number[], colors: string[] }}
   */
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

  /**
   * Renders (or re-renders) the spending pie chart from the given
   * transaction list.
   *
   * Lifecycle:
   *  1. Destroy any existing Chart.js instance so the canvas is clean.
   *  2. Compute category totals via computeCategoryTotals.
   *  3. If no categories have a positive total: hide the canvas and show
   *     the placeholder text — satisfies Requirement 5.5 (no-data state).
   *  4. Otherwise: show the canvas, hide the placeholder, and create a
   *     new Chart.js pie chart with one dataset.
   *
   * The tooltip callback formats each label as "$X.XX" so currency
   * context is always visible on hover.
   *
   * Satisfies Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6.
   *
   * @param {Transaction[]} txList
   * @returns {void}
   */
  function renderChart(txList) {
    const canvas = document.getElementById('spending-chart');
    const placeholder = document.getElementById('chart-placeholder');

    // Step 1: Destroy existing instance to avoid canvas state corruption
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    // Step 2: Compute category totals (zero-sum categories already excluded)
    const { labels, data, colors } = computeCategoryTotals(txList);

    // Step 3: No data — show placeholder, hide canvas
    if (data.length === 0) {
      canvas.style.display = 'none';
      placeholder.style.display = 'block';
      return;
    }

    // Step 4: Data present — show canvas, hide placeholder, create chart
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

  /* ── Render Module ──────────────────────────────────── */

  /**
   * Renders the transaction list into #transaction-list.
   *
   * Clears the list on every call, then either injects an empty-state
   * message (Requirement 2.5) or builds one <li> per transaction
   * (Requirements 2.1, 2.4, 3.1).
   *
   * The txList is expected to already be in newest-first order because
   * addTransaction always prepends — no re-sorting is performed here.
   *
   * Each list item structure:
   *   <li data-id="{id}">
   *     <span class="tx-name">{name}</span>
   *     <span class="tx-amount">${amount}</span>
   *     <span class="tx-category">{category}</span>
   *     <button class="btn-delete" aria-label="Delete {name}">Delete</button>
   *   </li>
   *
   * Satisfies Requirements 2.1, 2.3, 2.4, 2.5, 3.1.
   *
   * @param {Transaction[]} txList
   * @returns {void}
   */
  function renderTransactionList(txList) {
    const list = document.getElementById('transaction-list');

    // Clear existing content on every render
    list.innerHTML = '';

    // Empty state — no transactions stored yet (Requirement 2.5)
    if (txList.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'tx-empty';
      emptyItem.textContent = 'No transactions yet';
      list.appendChild(emptyItem);
      return;
    }

    // Render one <li> per transaction; txList is already newest-first
    txList.forEach(function (tx) {
      const li = document.createElement('li');
      li.setAttribute('data-id', tx.id);

      const nameSpan = document.createElement('span');
      nameSpan.className = 'tx-name';
      nameSpan.textContent = tx.name;

      const amountSpan = document.createElement('span');
      amountSpan.className = 'tx-amount';
      amountSpan.textContent = formatCurrency(tx.amount);

      const categorySpan = document.createElement('span');
      categorySpan.className = 'tx-category';
      categorySpan.textContent = tx.category;

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-delete';
      deleteBtn.setAttribute('aria-label', 'Delete ' + tx.name);
      deleteBtn.textContent = 'Delete';

      li.appendChild(nameSpan);
      li.appendChild(amountSpan);
      li.appendChild(categorySpan);
      li.appendChild(deleteBtn);

      list.appendChild(li);
    });
  }

  /**
   * Computes the running balance from a transaction list and updates the
   * #balance-display element with the formatted currency string.
   *
   * DOM reads are intentionally deferred to call-time (not cached at
   * module load) to survive any future DOM resets.
   *
   * Satisfies Requirement 4.1.
   *
   * @param {Transaction[]} txList
   * @returns {void}
   */
  function renderBalance(txList) {
    const total = computeBalance(txList);
    document.getElementById('balance-display').textContent = formatCurrency(total);
  }

  /**
   * Re-renders every UI region — transaction list, balance display, and
   * pie chart — from the current in-memory transactions array.
   *
   * This is the single orchestration call that keeps the three output
   * regions in sync after any state mutation (add, delete, or load).
   *
   * Satisfies Requirements 2.1, 4.1.
   *
   * @returns {void}
   */
  function renderAll() {
    renderTransactionList(transactions);
    renderBalance(transactions);
    renderChart(transactions);
  }

  /**
   * Displays one or more validation error messages in the #form-error
   * container.
   *
   * Messages are joined with '<br>' so each error appears on its own
   * line when the container's innerHTML is set. The container uses
   * role="alert" and aria-live="polite" in the HTML, so screen readers
   * will announce the new content automatically.
   *
   * Satisfies Requirement 1.3.
   *
   * @param {string[]} messages - Array of human-readable error strings
   * @returns {void}
   */
  function showFormError(messages) {
    document.getElementById('form-error').innerHTML = messages.join('<br>');
  }

  /**
   * Clears any previously displayed validation error messages from the
   * #form-error container.
   *
   * Satisfies Requirement 1.3.
   *
   * @returns {void}
   */
  function clearFormError() {
    document.getElementById('form-error').innerHTML = '';
  }

  /**
   * Injects a dismissible warning banner at the top of <main>.
   *
   * Guards against duplicate banners: if a .storage-warning element
   * already exists inside <main>, the function returns immediately
   * without injecting another.
   *
   * Banner structure:
   *   <div class="storage-warning">
   *     <span>{msg}</span>
   *     <button class="btn-dismiss-warning" aria-label="Dismiss warning">×</button>
   *   </div>
   *
   * Clicking the dismiss button removes the banner from the DOM.
   * The banner is inserted as the first child of <main> so it appears
   * above all other content.
   *
   * Satisfies Requirements 6.4, 7.4.
   *
   * @param {string} msg - The warning message to display
   * @returns {void}
   */
  function showStorageWarning(msg) {
    const main = document.querySelector('main');

    // Guard: do not inject a duplicate banner
    if (main.querySelector('.storage-warning')) {
      return;
    }

    const banner = document.createElement('div');
    banner.className = 'storage-warning';

    const msgSpan = document.createElement('span');
    msgSpan.textContent = msg;

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'btn-dismiss-warning';
    dismissBtn.setAttribute('aria-label', 'Dismiss warning');
    dismissBtn.textContent = '×';
    dismissBtn.addEventListener('click', function () {
      banner.parentNode.removeChild(banner);
    });

    banner.appendChild(msgSpan);
    banner.appendChild(dismissBtn);

    main.insertBefore(banner, main.firstChild);
  }

  /**
   * Resets the #transaction-form to its default empty/placeholder state
   * and removes any inline validation error styling that was applied to
   * individual inputs during a failed submission attempt.
   *
   * Specifically:
   *  - Calls form.reset() to clear all field values
   *  - Removes aria-invalid attributes from #input-name, #input-amount,
   *    #input-category to restore default accessible state
   *  - Removes the .input-error CSS class from the same three inputs
   *  - Calls clearFormError() to wipe the #form-error message container
   *
   * Satisfies Requirement 1.6.
   *
   * @returns {void}
   */
  function resetForm() {
    document.getElementById('transaction-form').reset();

    const inputIds = ['input-name', 'input-amount', 'input-category'];
    inputIds.forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.removeAttribute('aria-invalid');
        el.classList.remove('input-error');
      }
    });

    clearFormError();
  }

  /* ── Event Handlers ─────────────────────────────────── */

  /**
   * Handles the #transaction-form submit event.
   *
   * Prevents the default browser form submission, reads the current
   * field values directly from the DOM (never cached), validates them,
   * and either surfaces errors or commits the new transaction.
   *
   * Flow:
   *  1. e.preventDefault()
   *  2. Read trimmed values from #input-name, #input-amount, #input-category
   *  3. validateForm(name, amount, category)
   *  4a. On error  → showFormError(errors), return (no transaction added)
   *  4b. On success → addTransaction(name, parseFloat(amount), category)
   *                   If addTransaction returns null (save failed): return without
   *                   resetting form or updating UI (warning already shown inside
   *                   addTransaction; form fields preserved so user doesn't lose data).
   *                   Otherwise: clearFormError(), resetForm(), renderAll()
   *
   * Satisfies Requirements 1.2, 1.3, 1.6, 6.1.
   *
   * @param {Event} e
   * @returns {void}
   */
  function handleFormSubmit(e) {
    e.preventDefault();

    // Read values at call-time (not cached at module load)
    const name     = document.getElementById('input-name').value.trim();
    const amount   = document.getElementById('input-amount').value.trim();
    const category = document.getElementById('input-category').value;

    const { valid, errors } = validateForm(name, amount, category);

    if (!valid) {
      showFormError(errors);
      return;
    }

    // addTransaction returns null on storage write failure (state already reverted)
    const tx = addTransaction(name, parseFloat(amount), category);
    if (!tx) {
      // Save failed — warning already displayed; keep form fields intact
      return;
    }

    clearFormError();
    resetForm();
    renderAll();
  }

  /**
   * Handles click events delegated from #transaction-list.
   *
   * Only acts when the clicked element has the class 'btn-delete'.
   * Reads the transaction id from the closest ancestor <li data-id="...">,
   * prompts the user for confirmation, then calls deleteTransaction.
   * If the deletion fails (storage write error), surfaces a warning banner.
   * renderAll() is always called after a confirmed deletion attempt so the
   * UI reflects the current in-memory state (which is rolled back on failure).
   *
   * Flow:
   *  1. Guard: e.target.classList.contains('btn-delete') — if not, return
   *  2. id = e.target.closest('li').dataset.id
   *  3. window.confirm('Delete this transaction?') — if cancelled, return
   *  4. const success = deleteTransaction(id)
   *  5. if (!success) showStorageWarning('Transaction could not be deleted: storage write failed.')
   *  6. renderAll() (always — re-renders from current in-memory state)
   *
   * Satisfies Requirements 3.2, 3.3, 3.4.
   *
   * @param {Event} e
   * @returns {void}
   */
  function handleDeleteClick(e) {
    if (!e.target.classList.contains('btn-delete')) {
      return;
    }

    const id = e.target.closest('li').dataset.id;

    const confirmed = window.confirm('Delete this transaction?');
    if (!confirmed) {
      return;
    }

    const success = deleteTransaction(id);

    if (!success) {
      showStorageWarning('Transaction could not be deleted: storage write failed.');
    }

    renderAll();
  }

  /* ── Init ───────────────────────────────────────────── */

  /**
   * Bootstraps the application on page load.
   *
   * Steps:
   *  1. Check whether localStorage is available via isStorageAvailable().
   *     If unavailable, show a warning banner and continue in session-only
   *     mode — the app is still usable, data just won't persist across reloads.
   *     (Does NOT return early — satisfies Requirements 7.4 + 6.4.)
   *  2. Load persisted transactions from localStorage via loadFromStorage().
   *  3. Paint the initial UI via renderAll().
   *  4. Attach the submit listener to #transaction-form.
   *  5. Attach a delegated click listener to #transaction-list for deletes.
   *
   * Satisfies Requirements 2.3, 4.4, 6.3, 6.4, 7.4.
   *
   * @returns {void}
   */
  function init() {
    if (!isStorageAvailable()) {
      showStorageWarning('Local Storage is not available in this browser. Data will not be saved.');
      // still proceed (session-only mode) — do NOT return early
    }

    transactions = loadFromStorage();
    renderAll();

    document.getElementById('transaction-form')
      .addEventListener('submit', handleFormSubmit);

    document.getElementById('transaction-list')
      .addEventListener('click', handleDeleteClick);
  }

  document.addEventListener('DOMContentLoaded', init);

  /* ── CommonJS exports (test environment only) ─────── */
  /* This block is guarded so it only runs in Node/Jest and has          */
  /* zero effect when the file is loaded directly in a browser.          */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      // Storage
      isStorageAvailable,
      loadFromStorage,
      saveToStorage,
      // Validation
      validateForm,
      // Transaction operations
      addTransaction,
      deleteTransaction,
      getTransaction,
      // Balance
      computeBalance,
      formatCurrency,
      // Chart
      computeCategoryTotals,
      renderChart,
      // Render
      renderTransactionList,
      renderBalance,
      renderAll,
      showFormError,
      clearFormError,
      showStorageWarning,
      resetForm,
      // State accessors (tests need to read/reset in-memory state)
      _getTransactions: function () { return transactions; },
      _setTransactions: function (arr) { transactions = arr; },
      _resetChart:      function () { chartInstance = null; },
    };
  }

})();
