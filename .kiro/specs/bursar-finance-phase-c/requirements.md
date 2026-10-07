# Bursar Finance Phase C — Accounting (requirements)

Phase A (fees side) and Phase B (school-side money) record every money event.
Phase C turns those records into a full double-entry set of books, with the
statements a board, auditor or ministry expects, plus bank reconciliation and
a finance audit trail. Finance staff only (principal, accountant, super admin).

## R1 Chart of accounts
- Each school gets a standard chart (assets, liabilities, equity, income,
  expenses) the first time accounting is opened. Codes and names are editable;
  system accounts cannot be deleted or change type.
- Finance staff can add accounts (e.g. Equipment, Loans, Donations) and
  deactivate unused non-system accounts.
- Every expense category (including custom "Other" names) has an expense
  account; custom categories get one automatically.

## R2 Automatic journal
- Fees billed, payments, refunds, discounts/waivers, credit notes, applied and
  refunded credit, expenses, petty cash top-ups/returns and paid payroll runs
  are posted to the journal automatically, balanced, without anyone keying them.
- Posting is idempotent and self-correcting: if a source record changes
  (edited, voided, deleted, cancelled, reversed) a correcting entry is posted;
  nothing is posted twice.
- Payroll posts gross salaries and employer NASSIT as expenses, and net pay,
  PAYE, NASSIT (employee + employer) and other deductions as what is owed.

## R3 Manual journals
- Finance staff can post balanced manual journals (opening balances, bank
  charges, PAYE/NASSIT remittance, cash banked, transfers, depreciation).
- A journal needs a date (not in the future, not in closed books), a memo and
  at least two lines; debits must equal credits.
- Control accounts kept by the sub-ledgers (Fees receivable, Student credit,
  Petty cash) cannot be posted to by hand.
- Entries are never edited or deleted; a manual journal is reversed (once)
  with a reason, which posts the mirror entry.

## R4 Closing the books
- The principal can close the books up to a date. Nothing can be posted on or
  before it; late changes to old records post on the first open day.

## R5 Financial statements (year or date range, exportable CSV/Excel/PDF)
- Trial balance (balanced check shown).
- Income statement (income, discounts, expenses, surplus/deficit).
- Balance sheet as at a date (assets = liabilities + equity check shown).
- Cash flow (direct method): opening cash, receipts and payments by kind,
  closing cash.
- General ledger for one account with running balance.
- Integrity checks: Fees receivable equals the students' balances, Student
  credit equals credit balances, Petty cash equals the funds' balances.

## R6 Bank reconciliation
- For each cash/bank/mobile-money account: import a bank statement (CSV with
  column mapping), duplicates skipped.
- Auto-match statement lines to book lines (same amount, close date,
  reference); match manually (one statement line to one or more book lines of
  equal total); unmatch; ignore a line; add a missing item (bank charges,
  interest) to the books from the statement line.
- Summary: book balance, statement balance, unmatched on each side, difference.
- An import with no matches can be undone.

## R7 Finance audit log
- Read-only list of finance actions (who, when, what, details) for the school,
  filterable by area, person, date and text, paged on the server.
