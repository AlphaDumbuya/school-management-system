# Bursar Finance — Phase B: Design

## Data (migration `166_bursar_finance_b`)
- `school_expenses` gains: `vendor, payment_method, reference, receipt_url, department, source` (`manual`, `petty_cash`, `payroll`), `source_id, voided_at, voided_by, void_reason`.
- `petty_cash_funds(id, tenant_id, name, custodian_user_id, float_amount, active)`
- `petty_cash_entries(id, tenant_id, fund_id, kind` (`top_up`, `spend`, `return`), `amount, category, description, entry_date, academic_year, receipt_url, expense_id, recorded_by, voided_at, voided_by, void_reason)`
- `budgets(id, tenant_id, academic_year` (unique per tenant), `status, notes, approved_by, approved_at, created_by)` and `budget_lines(id, budget_id, category, department, amount, notes)`
- `staff_pay_profiles(id, tenant_id, staff_kind` (`staff` → teachers.id, `support` → support_staff.id), `staff_ref_id, basic_salary, allowances jsonb, deductions jsonb, paye_applies, nassit_applies, payment_method, bank_name, account_number, active)`, unique `(tenant, kind, ref)`
- `payroll_runs(id, tenant_id, period, academic_year, status` (`draft`, `approved`, `paid`, `cancelled`), `totals…, created_by, approved_by/at, paid_by/at, payment_date, cancelled_reason, notes)`, plus a partial unique index on `(tenant_id, period)` where status ≠ cancelled.
- `payslips(id, run_id, tenant_id, staff_kind, staff_ref_id, user_id, staff_name, staff_number, designation, basic, allowances jsonb, extras jsonb, deductions jsonb, gross, taxable, paye, nassit_employee, nassit_employer, total_deductions, net, payment_method, bank_name, account_number, email)`
- Settings (`school_config_settings`):
  - `fin_paye_bands` (JSON `[{"upto":600,"rate":0},{"upto":1200,"rate":15},{"upto":1800,"rate":20},{"upto":2400,"rate":25},{"upto":null,"rate":30}]`)
  - `fin_nassit_employee_pct` (5), `fin_nassit_employer_pct` (10)
  - `fin_paye_after_nassit` (true)

## Services (`backend/src/services/finance/`)
- `expenseService`:
  - `CATEGORIES`;
  - `create` / `update` / `void`, with past-year and future-date checks, and a budget warning returned with the response;
  - `createLinked(trx, …)` for petty cash and payroll;
  - list with filters and totals by category.
  The old `schoolExpenseService` sums exclude voided rows.
- `pettyCashService`: funds CRUD, `balance(fund)` (advisory lock per fund for writes), `entry()`, `void()`.
- `budgetService`: `get(year)`, `save(year, lines)` (approved → draft), `approve`, `vsActual(year)`.
- `payrollService`:
  - `paye(taxable, bands)` (pure);
  - `computeSlip(profile, settings, extras)` (pure);
  - profiles: list of all staff joined with their profile, plus upsert;
  - runs: `generate(period)`, `regenerate`, `editSlip`, `removeSlip`, `approve`, `markPaid` (creates the expenses in the same transaction), `cancel`;
  - `slipPdf`, `emailSlips`, `mySlips(userId)`, run export.

## Routes
`backend/src/routes/bursarFinanceBRoutes.ts`, mounted at `/api/v1/finance` before `schoolExpenseRoutes`:
- `/expenses-v2*`, `/petty-cash*`, `/budgets*`, `/payroll*`: finance staff;
- `/payroll/my-payslips*`: any staff member with a payslip.

The old `/finance/expenses` endpoints stay working (they exclude voided rows); the new page uses `/expenses-v2`.

## Frontend
- Pages:
  - `ExpensesPage` (rewritten);
  - `PettyCashPage`;
  - `BudgetsPage`;
  - `PayrollPage`, with tabs Pay runs / Staff pay / Settings and a run detail drawer;
  - `MyPayslipsPage`.
- Routes and sidebar entries (v1). The duplicate `finance/expenses` route is removed.
- `bursarService` is extended (B section).

## Verification
Scratch HTTP on real data:
- PAYE maths on known salaries;
- run lifecycle (generate → edit → approve as bursar 403 → approve as principal → pay → expenses created → pay again 409 → cancel voids expenses);
- petty cash balance and overdraw refusal;
- budget vs actual;
- payslip PDF access (own 200, someone else's 403);
- expense past-year 409.
All rows are removed afterwards.
