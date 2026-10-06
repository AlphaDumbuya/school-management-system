# Bursar Finance — Phase A (fee side): Requirements

Scope: make the bursar's fee work complete for a real school. Covers discounts and scholarships, late fees and overdue marking, aging and defaulter reports, receipts, credit notes, instalment plans, statements of account and balance brought forward. Phase B covers expenses, petty cash, budgets and payroll; Phase C covers the general ledger, statements and reconciliation.

Roles: **Bursar** = `accountant`, or a teacher holding the accountant duty. **Principal** = `principal`. Every rule below is enforced on the server, never only in the UI. Currency is Leones (Le), rounded to cents.

## R1. Discounts, scholarships and waivers
1. The bursar or principal can define **discount rules** per school:
   - **sibling**: a % or fixed amount off for the 2nd, 3rd and later child of the same guardian;
   - **staff child**;
   - **scholarship / bursary**: named;
   - **custom**.
   Each rule is either a percentage or a fixed amount. It applies to tuition only, or to all charges. It has an active flag.
2. A discount is **granted to a student for an academic year**, either from a rule or as a one-off **waiver**. It can cover the whole year or one term. A reason is required for waivers and custom grants.
3. **Approval:** a grant at or below the school's approval threshold (Le amount, set by the principal; default 0 = always needs approval) is approved immediately when the principal grants it, or when the bursar grants it under the threshold. Otherwise it stays `pending` until the principal approves or rejects it, with a reason.
4. An approved discount reduces the outstanding balance of the matching fees. It shows on the student ledger and statement as its own line ("Sibling discount −Le 200"). The billed amount is unchanged.
5. Discounts never make a balance negative. Any excess is dropped and reported.
6. Revoking an approved discount restores the amounts it reduced. This is only allowed on fees that aren't fully paid by payments, and it is audited.
7. Fees billed after a discount is approved get the discount automatically (re-applied on billing).
8. KPIs separate **Collected** (cash received, net of refunds) from **Discounts & waivers**. A discount is never counted as collected.

## R2. Overdue marking and late fees
1. A daily finance job marks fees `overdue` when the due date (school's today) has passed and a balance remains. Paying them clears the flag (status partial or paid).
2. Late fees are **off unless the school enables them**. Settings:
   - percentage, or a fixed amount;
   - grace days;
   - applies once per fee;
   - optional cap.
3. When enabled, a fee that is overdue past the grace period gets **one** "Late fee" charge, linked to the original fee. This is idempotent: running the job twice never charges twice.
4. The bursar can **waive** a late fee with a reason (it becomes a waiver adjustment) and can **add** one manually.
5. Students on an active instalment plan are only charged late fees when an instalment is overdue (R6).
6. The job runs:
   - daily via Vercel Cron, protected by `CRON_SECRET`;
   - via node-cron when the API runs as a long-lived server;
   - on demand with **Run now** (bursar/principal).
   It reports what it did.

## R3. Arrears, aging and defaulters
1. **Aging report** for a selected year, or all years: each student's outstanding balance split into **Not yet due / 1–30 / 31–60 / 61–90 / 90+ days** past the due date. It also gives totals per bucket and per class.
2. Filters: class, section, minimum amount, bucket. It is sortable by amount or age, and lists the class each student was in that year.
3. From the report, the bursar can send reminders to one student, to a bucket, or to everyone listed. This uses the existing reminder email and in-app notification.
4. Exportable (CSV, Excel, PDF), matching the on-screen totals.
5. The dashboard shows an aging summary and **cash position** (cash collected this year, this term and this month).

## R4. Receipts and e-receipts
1. Every completed payment submission gets a **receipt number**. It is sequential per school and year (`RCP-2027-000123`), stored, and unique. Existing payments are back-filled.
2. A receipt is emailed automatically to the guardian (or the student) for **manual** payments too, not only online ones. It's a PDF attachment. If there's no email, it isn't sent, and this is reported.
3. Parents and students see their **payment history** (date, amount, method, receipt number, status) and can **download the PDF receipt**. Parents only see their linked children; students only see themselves.
4. Staff can re-send a receipt, and can **bulk email receipts** for a date range, optionally per class.
5. A receipt reflects the balance **at the time of payment** (stored), not today's balance. A refunded payment's receipt is stamped REFUNDED.

## R5. Credit notes and credit balance
1. A manual payment larger than what's owed can be accepted. The excess becomes the student's **credit balance**. This needs explicit confirmation in the UI.
2. The bursar can issue a **credit note** with a reason (withdrawal, billing error). It adds credit without cash and is audited.
3. Credit can be **applied** to open fees (oldest first), or **refunded** in cash (with a reason, recorded as a refund). Applied credit settles fees but isn't counted as new cash collected.
4. The ledger, statement and parent view show the available credit.

## R6. Instalment plans
1. The bursar can create an instalment plan for a student's year (or one term): number of instalments, or custom dates and amounts that add up to the plan total.
2. Each instalment's status (paid, part paid, due, overdue) is worked out from payments applied to the plan's fees, oldest instalment first.
3. Reminders and late fees follow instalment dates for students on a plan.
4. Parents see the schedule and the next amount due. The minimum-payment policy accepts a payment that covers the next instalment.
5. A plan can be cancelled (with a reason). Fees stay owed.

## R7. Statement of account and balance brought forward
1. A **statement of account** for a student and year:
   - opening balance brought forward from earlier years;
   - every charge, discount, late fee, payment, credit and refund in date order with a running balance;
   - closing balance.
   Available on screen and as a PDF, to staff and to the linked parent or the student.
2. In a new year, a promoted student's ledger shows **"Balance brought forward from 2026/2027: Le X"**. The old fees stay on their own year; nothing is copied.
3. Promotions show a warning (not a block) listing students with unpaid balances.

## R8. Cross-cutting
- Every write is tenant-scoped, role-checked, audited (who, when, what, reason), validated, idempotent where money moves, and transactional.
- Past academic years: no new rules/grants, plans or credit notes dated into a closed year, but collecting arrears and waiving late fees are allowed.
- apiClient `{success:false}` is handled everywhere. Destructive actions use `ConfirmationDialog`. Pages use `YearFilter` (current year by default).
- Live sync: finance writes refresh open student and parent ledgers.
