# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track personal spending by adding, viewing, and deleting transactions. It provides a real-time total balance and a pie chart breaking down spending by category. The application runs entirely in the browser using HTML, CSS, and vanilla JavaScript, with all data persisted in the browser's Local Storage.

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single expense entry consisting of an item name, a monetary amount, and a category.
- **Category**: A classification label for a transaction. Valid values are: Food, Transport, Fun.
- **Balance**: The computed sum of all transaction amounts currently stored.
- **Transaction List**: The scrollable UI region that displays all stored transactions.
- **Input Form**: The HTML form through which users enter new transactions.
- **Chart**: The pie chart displaying spending distribution by category.
- **Local Storage**: The browser's built-in Web Storage API used to persist transaction data client-side.
- **Chart.js**: A JavaScript chart library used to render the pie chart.

---

## Requirements

### Requirement 1: Transaction Input

**User Story:** As a user, I want to fill in a form with an item name, amount, and category so that I can record a new expense.

#### Acceptance Criteria

1. THE Input_Form SHALL contain a text field for the item name (max 100 characters), a numeric field for the amount (range 0.01 to 999,999,999.99), and a dropdown selector for the category with exactly the options Food, Transport, and Fun.
2. WHEN the user submits the Input_Form with all fields filled and valid, THE App SHALL add the transaction to the Transaction List, persist it to Local Storage, and complete the write within 1 second.
3. IF the user submits the Input_Form with one or more fields empty, THEN THE App SHALL display a validation error message identifying which field(s) are missing and SHALL NOT add the transaction.
4. IF the user submits the Input_Form with an amount of zero, a negative number, or a non-numeric value, THEN THE App SHALL display a validation error message indicating the amount must be a positive number and SHALL NOT add the transaction.
5. IF the user enters an item name exceeding 100 characters, THEN THE App SHALL display a validation error message and SHALL NOT add the transaction.
6. WHEN a transaction is successfully added, THE Input_Form SHALL reset all fields to their default empty or placeholder state.

---

### Requirement 2: Transaction List Display

**User Story:** As a user, I want to see all my recorded transactions in a scrollable list so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display every stored transaction showing the item name, amount formatted to two decimal places with a currency symbol, and category, sorted from most recent to oldest.
2. THE Transaction_List SHALL have a fixed maximum height with overflow scrolling enabled so that all transactions remain accessible regardless of list size.
3. WHEN the App loads, THE Transaction_List SHALL render all transactions persisted in Local Storage.
4. WHEN a new transaction is added, THE Transaction_List SHALL update to include the new transaction at the top of the list without requiring a page reload.
5. WHILE no transactions are stored, THE Transaction_List SHALL display a message indicating there are no transactions yet.

---

### Requirement 3: Transaction Deletion

**User Story:** As a user, I want to delete a transaction from the list so that I can correct mistakes or remove outdated entries.

#### Acceptance Criteria

1. THE Transaction_List SHALL display a clearly labelled delete control (button or icon) for each transaction entry.
2. WHEN the user activates the delete control for a transaction, THE App SHALL display a confirmation prompt before removing the transaction.
3. WHEN the user confirms deletion, THE App SHALL remove that transaction from the Transaction_List, update the Balance and Chart, and write the updated list to Local Storage.
4. IF the Local Storage write fails during deletion, THEN THE App SHALL display an error message and SHALL NOT remove the transaction from the Transaction_List.
5. WHEN a transaction is deleted, THE App SHALL NOT modify, reorder, or affect any other transaction in the list.

---

### Requirement 4: Total Balance

**User Story:** As a user, I want to see my total balance at the top of the page so that I know my overall spending at a glance.

#### Acceptance Criteria

1. THE App SHALL display the total Balance formatted to two decimal places with a currency symbol at the top of the page at all times.
2. WHEN a transaction is added, THE App SHALL recalculate and update the displayed Balance within 500 milliseconds to reflect the new total.
3. WHEN a transaction is deleted, THE App SHALL recalculate and update the displayed Balance within 500 milliseconds to reflect the new total.
4. WHEN the App loads, THE App SHALL calculate and display the Balance from all transactions in Local Storage within 1000 milliseconds.
5. WHILE no transactions are stored, THE App SHALL display a Balance of $0.00 (or the equivalent zero value in the chosen currency format).

---

### Requirement 5: Spending Chart

**User Story:** As a user, I want to see a pie chart of my spending by category so that I can understand where my money is going.

#### Acceptance Criteria

1. THE Chart SHALL display spending distribution across the categories Food, Transport, and Fun as a pie chart using Chart.js or an equivalent lightweight chart library, with each category rendered in a visually distinguishable color.
2. WHEN a transaction is added, THE Chart SHALL update automatically within 500 milliseconds to reflect the new category totals without requiring a page reload.
3. WHEN a transaction is deleted, THE Chart SHALL update automatically within 500 milliseconds to reflect the revised category totals without requiring a page reload.
4. WHEN the App loads, THE Chart SHALL render based on the category totals derived from all transactions in Local Storage within 1000 milliseconds.
5. WHILE no transactions are stored, THE Chart SHALL display a placeholder message indicating no data is available rather than rendering empty or broken segments.
6. WHEN calculating chart segments, THE App SHALL exclude categories with a total of zero from the pie rendering so they do not appear as zero-sized slices.

---

### Requirement 6: Data Persistence

**User Story:** As a user, I want my transactions to be saved between browser sessions so that I do not lose my data when I close and reopen the page.

#### Acceptance Criteria

1. WHEN a transaction is added, THE App SHALL write the updated transaction list to Local Storage before the UI reflects the change.
2. WHEN a transaction is deleted, THE App SHALL write the updated transaction list to Local Storage before the UI reflects the change.
3. WHEN the App loads, THE App SHALL read all transactions from Local Storage and restore them to the Transaction List, Balance, and Chart within 500 milliseconds.
4. IF Local Storage is unavailable or returns a parse error on load, THEN THE App SHALL start with an empty transaction list and display a non-blocking warning message identifying that stored data could not be loaded.
5. WHEN storing transactions, THE App SHALL persist each transaction with at minimum the item name, amount, category, and a unique identifier to ensure full session restoration fidelity.

---

### Requirement 7: Browser Compatibility

**User Story:** As a user, I want the App to work correctly in any modern browser so that I can use my preferred browser without issues.

#### Acceptance Criteria

1. THE App SHALL function correctly in the current stable release of Chrome, Firefox, Edge, and Safari, where "function correctly" means all core features (transaction entry, list display, deletion, balance update, and chart rendering) operate without JavaScript errors, layout breakage, or data loss.
2. THE App SHALL use only standard HTML, CSS, and JavaScript conforming to ES2020 or earlier, with no third-party JavaScript or CSS frameworks loaded at runtime other than the chart library.
3. THE App SHALL include exactly one CSS file located in the `css/` directory and exactly one JavaScript file located in the `js/` directory, verifiable by inspecting the `<link>` and `<script>` tags in the HTML file.
4. IF the user's browser does not support a required Web API (such as Local Storage), THEN THE App SHALL display an informative error message indicating the browser is not supported and SHALL NOT attempt to use the unsupported API.

---

### Requirement 8: Performance and Responsiveness

**User Story:** As a user, I want the App to respond immediately to my interactions so that my experience feels smooth and uninterrupted.

#### Acceptance Criteria

1. WHEN the App is opened in a modern browser on a stable network connection, THE App SHALL complete initial render and display all stored data within 2 seconds, measured from the page load start event.
2. WHEN the user adds or deletes a transaction, THE App SHALL update the Transaction List, Balance, and Chart within 300 milliseconds without requiring a page reload.
3. THE App SHALL remain usable at viewport widths from 320px to 1920px without horizontal scrolling, content clipping, or overlapping layout elements.
4. IF data cannot be loaded from Local Storage within 2 seconds on App start, THEN THE App SHALL display an empty state with an error message rather than leaving the UI in a loading or broken state.
