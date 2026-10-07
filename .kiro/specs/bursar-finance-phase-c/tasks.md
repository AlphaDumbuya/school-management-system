# Bursar Finance Phase C — tasks

- [x] 1. Migration 167: gl_accounts, gl_entries, gl_lines, bank_statement_lines, bank_matches
- [x] 2. glService: default chart, account CRUD, expense-category accounts, lock date
- [x] 3. glService.sync: expected lines per source, diff posting, advisory lock, throttle; daily cron
- [x] 4. Manual journals + reversal (validation, control accounts, lock date)
- [x] 5. glReportService: balances, trial balance, income statement, balance sheet, cash flow, ledger, integrity
- [x] 6. bankRecService: import, auto-match, match/unmatch, ignore, add to books, undo import, summary
- [x] 7. Finance audit log query (tenant-scoped, paged)
- [x] 8. Routes + exports, mounted in index.ts
- [x] 9. Frontend: service, Chart of Accounts, Journal, Financial Reports, Bank Reconciliation, Audit Log; sidebar + routes
- [x] 10. Verify on real data (balanced TB, A = L + E, integrity checks, sync idempotent, reconciliation), type-check, build, android:sync
