# Bursar Finance — Phase A: Tasks

- [x] 1. Migration `165_bursar_finance_a`: new tables and columns, back-fill `payments.receipt_number`, `fees.source`
- [x] 2. `services/finance/core.ts` (sequences, `applyAdjustment` / `reverseAdjustment`, settings, access) and the KPI change: collected = cash applied to fees; discounts and applied credit are separate figures
- [x] 3. Discounts: `discountService` (rules, grants, approval threshold, sibling candidates, revoke) and re-apply after fee-structure billing
- [x] 4. Overdue marking and late fees: `lateFeeService`, Run now, waive/add, `/api/v1/cron/finance-daily` (`CRON_SECRET`), node-cron (`jobs/financeJobs.ts`), `vercel.json` crons, Settings → Financial
- [x] 5. Aging report, export, cash position, dashboard widgets
- [x] 6. Receipts: sequential numbers on manual and Monime payments, `balance_after`, PDF (with a REFUNDED stamp and what the payment covered), automatic email for manual payments, re-send, bulk email, family payment history
- [x] 7. Credit: overpayment to credit (needs "keep as credit"), credit note, apply, refund
- [x] 8. Instalment plans: create, derived schedule, cancel; the minimum-payment policy accepts the next instalment; the late-fee and overdue jobs skip plans that are on track
- [x] 9. Statement of account (JSON + PDF) with brought forward and a reconciliation check; promotion warning for unpaid balances
- [x] 10. Frontend:
  - Discounts & Scholarships and Arrears & Aging pages
  - `StudentAccountModal` (statement / discounts / credit / instalments / receipts)
  - Payments: receipt numbers, PDF, keep-as-credit, Email receipts
  - Settings
  - My Fees: payment history, receipts, plan, credit, statement
  - Dashboard widgets
  - Sidebar entries
- [x] 11. Verified on real data (scratch HTTP, every row removed afterwards). Type-check FE 219, BE 480 (no new errors in changed files).

Deploy note: set `CRON_SECRET` in the Vercel project environment so the daily finance job runs.
