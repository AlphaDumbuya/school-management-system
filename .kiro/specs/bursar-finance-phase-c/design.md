# Bursar Finance Phase C — design

## Data (migration 167, additive)
- `gl_accounts` (tenant, code, name, type asset|liability|equity|income|expense,
  subtype cash|receivable|payable|control|null, system_key unique per tenant,
  is_system, is_active, description).
- `gl_entries` (tenant, entry_no JE-000001, entry_date, academic_year, memo,
  kind auto|manual, source_type, source_id, reverses_id, reversed_by_id,
  reverse_reason, created_by).
- `gl_lines` (entry, tenant, account, debit, credit, memo, student_id).
- `bank_statement_lines` (tenant, account, txn_date, description, reference,
  amount signed: + in / − out, balance, status unmatched|matched|ignored,
  dedupe_key unique per account, import_batch, imported_by).
- `bank_matches` (statement_line → gl_line, gl_line unique).
- Books lock date: `school_config_settings.fin_books_locked_until`.

## Posting by reconciliation (glService.sync)
Instead of hooking every write path (many services, easy to miss one), each
source document has an *expected* set of lines (account → signed amount). The
sync compares it with what is already posted for that document
(Σ debit − credit per account, auto entries only) and posts the difference as
one balanced entry. First posting is dated on the document date; corrections
are dated on the change date (voided_at / reversed_at / updated_at); anything
on or before the lock date moves to the first open day. Runs under a per-school
advisory lock, before every accounting read (throttled) and in the daily cron.

| Source | Expected lines |
|---|---|
| fee (not deleted) | Dr Fees receivable / Cr Tuition (4000), Other charges (4010) or Late fees (4020) |
| payment (completed/refunded) | Dr cash account by method / Cr Fees receivable, or Cr Student credit for an overpayment row |
| refund | Dr Fees receivable / Cr cash account of the payment |
| fee_adjustment (active) | discount, waiver: Dr Discounts & waivers (4500); late_fee_waiver: Dr Late fees; credit_applied: Dr Student credit — Cr Fees receivable |
| student_credit credit_note | Dr Discounts & waivers / Cr Student credit |
| student_credit refunded | Dr Student credit / Cr Cash on hand |
| expense (not void, not payroll) | Dr category expense / Cr Petty cash (petty cash spend) or cash account by method |
| petty cash top_up / return | Dr Petty cash / Cr Bank, and the reverse |
| payroll run (paid) | Dr Salaries (gross), Dr Employer NASSIT / Cr Bank (net), PAYE payable, NASSIT payable, Other deductions payable |

Cash account by method: cash → 1000 Cash on hand; bank, bank_transfer,
cheque, card → 1010 Bank; mobile money / Monime / online → 1020 Mobile money.

## Reports (glReportService)
One query gives per account: opening (before from), period debit/credit,
closing. Trial balance shows balance-sheet accounts at closing and income /
expense for the period, plus "Accumulated surplus b/f" (prior periods' net) so
it balances without year-end closing entries. Balance sheet adds the
accumulated surplus to equity. Cash flow classifies each entry's cash movement
by its source type / counter-accounts; cash-to-cash transfers net to zero.

## Bank reconciliation (bankRecService)
Book side = GL lines on the account (debit − credit). Auto-match is one-to-one
on equal amount within 7 days, preferring a reference found in the memo, then
the closest date. Manual matching allows one statement line to many book lines
of the same total.

## API (`/api/v1/finance`, routes/bursarFinanceCRoutes.ts)
`gl/accounts` (GET/POST/PUT), `gl/journal` (GET paged, GET :id, POST manual,
POST :id/reverse), `gl/sync`, `gl/lock` (GET, PUT principal),
`gl/reports/{trial-balance,income-statement,balance-sheet,cash-flow,ledger/:id}`
(+ `?format=csv|excel|pdf`), `gl/integrity`, `bank/accounts`, `bank/:accountId`,
`bank/:accountId/{import,auto-match}`, `bank/match`, `bank/unmatch`,
`bank/lines/:id/{ignore,book}`, `bank/imports/:batch` (DELETE), `audit`.

## UI
Chart of Accounts, Journal, Financial Reports (tabs), Bank Reconciliation,
Finance Audit Log; all in the Finance sidebar group, using the shared
YearFilter, SearchBar, ConfirmationDialog, Modal, TablePager, ExportButton.
