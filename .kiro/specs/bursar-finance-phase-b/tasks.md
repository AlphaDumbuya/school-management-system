# Bursar Finance — Phase B: Tasks

- [x] 1. Migration `166_bursar_finance_b`: expense columns (vendor, method, receipt, source, void), petty cash, budgets, pay profiles, pay runs, payslips
- [x] 2. `expenseService`: fixed categories, school-year from date, past-year 409, no future dates, void instead of delete, linked expenses, budget warning. Legacy `schoolExpenseService` excludes voided rows and soft-voids on delete.
- [x] 3. `pettyCashService`: funds, top up / spend (creates an expense) / return, locked balance (no overdraw), void (voids the linked expense)
- [x] 4. `budgetService`: per-year lines; principal approves; editing reopens it; budget vs actual with near/over flags and unbudgeted spend
- [x] 5. `payrollService`:
  - Sierra Leone PAYE bands (0/15/20/25/30%) and NASSIT 5% + 10%, editable by the principal;
  - pay profiles for professional and support staff;
  - run lifecycle draft → approved (principal) → paid (creates Salaries + employer NASSIT expenses) / cancelled (voids them);
  - one run per month; one-off pay and deductions on drafts;
  - payslip PDF and email; My Payslips; run export
- [x] 6. Routes in `bursarFinanceBRoutes.ts`, mounted before `schoolExpenseRoutes`
- [x] 7. Frontend: Expenses (rewritten), Petty Cash, Budget, Payroll (runs / staff pay / PAYE & NASSIT), My Payslips; sidebar v1 entries; removed the duplicate v2 expenses and payroll routes
- [x] 8. Verified on real data (scratch HTTP) and every row removed afterwards. FE 219, BE 479.
