# Bursar Finance — Phase B (school-side money): Requirements

Scope: what the school spends. Covers expenses, petty cash, budgets and payroll (salaries, deductions, payslips, PAYE and NASSIT). Phase C (general ledger, statements, reconciliation) builds on these records.

Roles: **Bursar** = `accountant`, or a teacher with the accountant duty. **Principal** = `principal`. Server-side enforcement, tenant scoping, audit, Le rounded to cents, and `{success:false}` handling everywhere.

## R1. Expenses
1. An expense has:
   - a category from a fixed list: Salaries, Statutory (PAYE/NASSIT), Utilities, Supplies, Maintenance, Transport, Food & Catering, Rent, Events, Administration, Other;
   - amount, date, academic year (from the date's session) and optional term;
   - vendor/payee, payment method (cash, bank transfer, cheque, mobile money), reference, description, an optional receipt photo or PDF, and an optional department.
2. Validation: amount > 0, date not in the future, no new or edited expenses in a past academic year (409).
3. **Void, never delete:** voiding needs a reason and records who and when. Voided expenses are excluded from totals but stay visible.
4. Expenses created by petty cash or payroll are linked to their source. They can only be voided from the source (void the petty cash entry; cancel the payroll run).
5. The Expenses page shows the year's totals by category, a fees-vs-expenses summary, budget usage per category, filters (category, term, source, search) and an export.

## R2. Petty cash
1. A school can have one or more petty cash funds (e.g. "Office float"), each with a custodian and an optional float amount.
2. Fund entries:
   - **top up** (cash into the fund);
   - **spend** (with category, description and receipt; this also creates a linked expense);
   - **return** (unused cash back to the bank).
3. A fund's balance = top-ups − spends − returns. A spend or return larger than the balance is refused.
4. Entries can be voided with a reason; voiding a spend also voids its expense.
5. The page shows each fund's balance, its entries for the year, and a "below float" hint.

## R3. Budgets
1. One budget per academic year, made of lines: category, optional department, amount, notes.
2. Status is draft or approved. Only the principal approves. Editing an approved budget sets it back to draft with an audit entry.
3. **Budget vs actual**: per line, budgeted, spent (non-voided expenses of that category and department for the year), remaining and % used. Over 90% is flagged; over 100% is flagged as overspent.
4. When recording an expense that would push its category over budget, the bursar is warned (not blocked).

## R4. Payroll
1. **Staff pay profiles** cover every professional staff member (teachers, accountants, admissions officers, principal) and support staff:
   - basic monthly salary;
   - allowances (name, amount, taxable yes/no);
   - recurring deductions (name, amount, e.g. a loan or union dues);
   - whether PAYE and NASSIT apply;
   - payment method, bank and account number.
   Inactive staff aren't paid.
2. **Statutory settings** (editable per school, pre-filled with current Sierra Leone rates):
   - monthly PAYE bands: first Le 600 at 0%, next Le 600 at 15%, next Le 600 at 20%, next Le 600 at 25%, above Le 2,400 at 30%;
   - NASSIT employee 5% and employer 10% of basic salary;
   - whether the employee's NASSIT is deducted before PAYE (default yes).
3. **Pay run** for a month (`YYYY-MM`):
   - Generate makes a draft with one payslip per active profile:
     - gross = basic + allowances;
     - NASSIT = % of basic;
     - taxable = taxable gross (− employee NASSIT when configured);
     - PAYE from the bands;
     - net = gross − PAYE − employee NASSIT − deductions.
   - One live run per month.
   - **Draft:** regenerate from the profiles; per-payslip one-off additions (bonus, overtime) and deductions; remove a payslip.
   - **Approve:** principal only. The run is then locked.
   - **Mark paid:** with a payment date. Creates the expenses: Salaries = total gross, and Statutory (PAYE/NASSIT) = employer NASSIT.
   - **Cancel:** with a reason. Voids the expenses of a paid run.
   A run can't be paid twice.
4. **Payslips:** PDF per payslip (school header, earnings, deductions, net, employer NASSIT), emailed to staff who have an email. Staff with a login see their own payslips (approved/paid runs only) under **My Payslips** and can download them.
5. Reports per run: totals of gross, PAYE (to the NRA), NASSIT employee + employer (to NASSIT), other deductions and net. Exportable.

## R5. Cross-cutting
- Sidebar: Expenses, Petty Cash, Budgets and Payroll for finance staff; My Payslips for staff.
- Audit trail on every write. Past-year rules as in R1.2 (payroll is dated by its period).
