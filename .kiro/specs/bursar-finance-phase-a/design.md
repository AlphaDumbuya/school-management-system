# Bursar Finance — Phase A: Design

## Data model (migration `165_bursar_finance_a`)

| Table | Purpose | Key columns |
|---|---|---|
| `finance_sequences` | Per-tenant counters | `tenant_id, key` (PK), `value` |
| `fee_adjustments` | Signed changes to a fee's balance that are not cash | `id, tenant_id, fee_id, student_id, kind` (`discount`, `waiver`, `credit_applied`, `late_fee_waiver`), `amount` (>0 = reduces balance), `reason, discount_grant_id, credit_id, created_by, reversed_at, reversed_by` |
| `discount_rules` | School rules | `id, tenant_id, name, kind` (`sibling`, `staff_child`, `scholarship`, `custom`), `basis` (`percent`, `fixed`), `value, applies_to` (`tuition`, `all`), `sibling_order` (int, nullable; 2 = second child and later), `active` |
| `discount_grants` | A discount given to a student | `id, tenant_id, student_id, rule_id` (nullable = one-off waiver), `academic_year, term` (null = whole year), `basis, value, applies_to, reason, status` (`pending`, `approved`, `rejected`, `revoked`), `requested_by, decided_by, decided_at, decision_reason` |
| `student_credits` | Credit balance movements | `id, tenant_id, student_id, kind` (`overpayment`, `credit_note`, `applied`, `refunded`), `amount` (signed: + adds, − uses), `payment_id, reason, created_by` |
| `payment_plans` (existing, extended) | Instalment plan | add `tenant_id, academic_year, term, cancelled_reason`; reuse `payment_plan_installments` |
| `fees` (add) | | `source` (`structure`, `manual`, `late_fee`), `parent_fee_id` (late fee → original fee) with a partial unique index `(parent_fee_id) where source='late_fee' and status<>'deleted'`, `overdue_marked_at` |
| `payments` (add) | | `receipt_number` (unique per tenant), `balance_after` (student's total outstanding after this submission) |

## Balance identity
`fee.balance = fee.amount − Σ completed payments on it + Σ refunds − Σ active adjustments`.
Every money path changes `fees.balance` in the same transaction as its record row, so the existing balance-based ledger, KPIs and parent views stay correct. All new code goes through **one** service, `feeAdjustmentService.apply(trx, fee, amount, kind, …)`, which caps the amount at the remaining balance and returns what it actually applied.

KPIs (`/finance/overview`, `/finance/analytics`):
- `billed` = Σ fee.amount
- `discounts` = Σ active adjustments of kind discount/waiver/late_fee_waiver
- `credit_applied` = Σ active adjustments of kind credit_applied
- `collected` = Σ completed payments − Σ refunds (cash)
- `outstanding` = Σ balance

Each figure is scoped by fee year (payments via `fee_id`, or the date window when unlinked).

## Services (backend/src/services/finance/)
- `sequenceService.next(trx, tenantId, key)`: `INSERT … ON CONFLICT DO UPDATE SET value = value + 1 RETURNING value`.
- `discountService`:
  - rules CRUD;
  - `grant()` (with the approval threshold from `fin_discount_approval_threshold`);
  - `approve` / `reject` / `revoke`;
  - `applyGrant(trx, grant)`: walks the matching open fees for the year or term (tuition or all) and applies percent or fixed adjustments;
  - `applyApprovedGrantsForStudent(trx, studentId, year)` is called after billing, and is idempotent per (grant, fee).
- `lateFeeService`:
  - `markOverdue(tenantId)`;
  - `applyLateFees(tenantId)`, which honours instalment plans;
  - `runDaily(tenantId?)` → summary;
  - `waive(feeId, reason)` and `addManual`.
- `agingService.report(tenantId, {year, classId, section, minAmount, bucket})`, using `tenantToday`.
- `receiptService`:
  - `assign(trx, tenantId, paymentIds, year)`;
  - `pdf(receiptNumber)`;
  - `email(receiptNumber)`;
  - `bulkEmail(range)`;
  - `history(studentId)`.
  Reuses `email/receiptPdf.ts` and `sendPaymentReceiptEmail`.
- `creditService`:
  - `balance(studentId)`;
  - `addOverpayment`;
  - `creditNote`;
  - `apply(studentId)`;
  - `refund(studentId, amount, reason)`.
- `planService`:
  - `create` (even split or custom rows; the sum must equal the total);
  - `schedule(planId)` (allocation of payments oldest first);
  - `cancel`;
  - `nextDue(studentId)`.
- `statementService.statement(studentId, year)` → `{opening, lines[], closing, credit}`, plus a pdfkit PDF.

## API (all under `/api/v1/finance`, `requireFinanceStaff` unless noted)
- `GET/POST/PUT /discounts/rules`
- `GET /discounts/grants?year&status`
- `POST /discounts/grants`
- `POST /discounts/grants/:id/(approve|reject|revoke)`: approve/reject are principal only.
- `POST /late-fees/run`
- `POST /fees/:id/waive-late-fee`
- `POST /fees/:id/late-fee`
- `GET /aging?year&class_id&section&min&bucket`
- `GET /aging/export`
- `GET /receipts?from&to&class_id`
- `POST /receipts/:no/email`
- `POST /receipts/bulk-email`
- `GET /receipts/:no/pdf`: staff, or the owner / linked guardian.
- `GET /students/:id/payments` and `GET /me/payments`: staff, guardian or self.
- `GET /credits/:studentId`
- `POST /credits/:studentId/(note|apply|refund)`
- `GET/POST /plans`
- `POST /plans/:id/cancel`
- `GET /plans/student/:studentId`: staff, guardian or self.
- `GET /statements/:studentId?year&format=pdf`: staff, guardian or self.
- `GET/POST /cron/finance-daily` (outside `/finance`, public path guarded by `Authorization: Bearer ${CRON_SECRET}`) → `lateFeeService.runDaily()` for every active tenant. Registered in `vercel.json` `crons`.

`POST /finance/payments/record` gains:
- `allowCredit` (the excess goes to `student_credits` as an extra fee-less payment row);
- receipt assignment and `balance_after`;
- the email after commit (best-effort).

The Monime reconcile path assigns receipts the same way.

## Frontend
- **Finance → Discounts & Scholarships** (`/finance/discounts`):
  - rules tab;
  - grants tab: year filter, status filter, Grant modal (student search, rule or one-off, scope, reason), approve/reject for the principal with `ConfirmationDialog` and a reason.
- **Finance → Arrears & Aging** (`/finance/aging`): bucket KPIs, table, filters, export, and remind (row / bucket / all).
- **Payments page:**
  - receipt number column;
  - Download PDF / Email receipt;
  - overpayment → credit confirmation;
  - a Bulk receipts modal.
- **Student account drawer** (opened from any student name in finance pages):
  - ledger with brought forward;
  - discounts;
  - credit (note / apply / refund);
  - plan (create / view / cancel);
  - statement PDF;
  - waive late fee.
- **Settings → Financial:** late fee enable, %/fixed, grace, cap; discount approval threshold.
- **Parent and student (My Fees):**
  - payment history with receipt download;
  - instalment schedule and next due;
  - brought forward line;
  - credit;
  - statement PDF.
- **Dashboard:** aging summary, cash position, pending approvals (principal).

## Testing
Scratch HTTP verification on real data for every route, including the deny paths, idempotency (parallel requests), and balance identity checks before and after. All test rows are removed afterwards.
