# Requirements Document

## Introduction

The system has substantial but fragmented financial code: a Sierra-Leone fee-structure
configurator (`fee_structures` + `fee_structure_expenses`), student `fees`,
`invoices`, `payments`, a live Monime hosted-checkout integration, and finance
pages for staff plus per-child views in the parent portal. However, the domain
has real gaps and inconsistencies that stop it functioning as a coherent
financial system:

- **No school-expense tracking.** The only "expenses" are `fee_structure_expenses`,
  which are charges billed TO students, not the school's own operating costs.
- **Thin financial settings.** The Settings → Financial tab exposes only currency
  and a late-fee percent. There is no payment-gateway (Monime) configuration, no
  accepted-payment-methods control, and no role restriction on who may view or
  change financial configuration.
- **Fragmented fee definition.** Fee amounts are defined in three disconnected
  places (an in-memory service, a `fee_configurations` table, and `fee_structures`);
  only `fee_structures` is wired to the UI.
- **Identity inconsistency.** `feeService.createFee` treats `student_id` as a
  `users.id`, while fee-structure billing uses `students.id`.
- **Dead code.** A generic Stripe/PayPal gateway service and its tables (no
  migration) are unused; Monime is the real gateway.
- **Per-year / per-term tracking is partial.** `fees` and `invoices` carry `term`
  and `academic_year`, but there is no single, reliable per-student ledger that a
  parent or the school can read across academic years and terms.

This feature consolidates the financial domain into a coherent, tenant-scoped
system that tracks each student's bills per academic year and per term, tracks
school operating expenses, lets parents view and pay their children's fees from
their portal, and gives staff the settings and restrictions to run it. The
existing Monime integration and finance pages are retained and extended rather
than replaced.

The system is multi-tenant: every financial record, query, configuration value,
and payment MUST be scoped to a single tenant (school), and no user may read or
act on another tenant's financial data.

## Glossary

- **Tenant**: A single school. All financial data is isolated per tenant.
- **Academic year**: A school year string (e.g. `2026/2027`).
- **Term**: One of First / Second / Third term within an academic year.
- **Fee structure**: The per-class, per-year definition of term tuition plus
  itemised academic-year charges, held in `fee_structures` /
  `fee_structure_expenses`.
- **Bill / charge**: A `fees` row owed by a student for a term or year.
- **Invoice**: A grouped, numbered document (`invoices` + `invoice_items`)
  covering one or more fees for a student.
- **Payment**: A recorded settlement (`payments`) against fees/invoices, made
  manually by staff or online via Monime.
- **Student ledger**: The consolidated per-student view of all charges, payments,
  and balances across academic years and terms.
- **School expense**: An operating cost the school itself incurs (salaries,
  utilities, supplies), distinct from charges billed to students.
- **Monime**: The payment gateway (hosted checkout) used for online fee payment.
- **Finance staff**: Users with a role permitted to manage finance
  (principal, super_admin, accountant).
- **Guardian/Parent**: A user linked to one or more students who may view and
  pay those students' fees.

## Requirements

### Requirement 1: Tenant-scoped financial data isolation

**User Story:** As a school administrator, I want all financial data isolated to
my school, so that no other school can ever see or affect my finances.

#### Acceptance Criteria

1. WHERE a financial record is created (fee, invoice, payment, fee structure,
   expense, payment session) THE system SHALL associate it with the acting
   user's tenant.
2. WHEN any financial read query runs THE system SHALL filter results to the
   requesting user's tenant.
3. IF a user requests a financial record belonging to another tenant THEN THE
   system SHALL deny the request with an authorization error and SHALL NOT
   return the record's data.
4. WHEN a payment is reconciled from a Monime webhook THE system SHALL apply it
   only to fees, invoices, and sessions within the same tenant as the payment
   session.
5. IF a Monime webhook references a session or invoice that cannot be matched to
   a tenant THEN THE system SHALL quarantine the webhook for manual review and
   SHALL NOT apply any payment.

### Requirement 2: Per-student ledger across academic years and terms

**User Story:** As finance staff, I want to see every student's complete billing
history organized by academic year and term, so that I can track what each
student owes and has paid over time.

#### Acceptance Criteria

1. THE system SHALL provide a per-student ledger that lists all charges,
   payments, and running balance for a student within the student's tenant.
2. THE student ledger SHALL group entries by academic year and, within a year,
   by term.
3. THE student ledger SHALL report, per academic year and per term, the total
   billed, total paid, and outstanding balance.
4. WHEN a charge or payment is added, updated, or reversed THE system SHALL
   recompute the affected term and year balances so the ledger stays consistent.
5. WHERE a student has no charges for a term THE ledger SHALL show that term with
   zero billed and zero outstanding rather than omitting it.

### Requirement 3: Per-class fee structure selected from a class dropdown

**User Story:** As finance staff, I want to configure each class's fee structure
by choosing the class from a dropdown of my school's classes, so that every class
can have its own term tuition and charges.

#### Acceptance Criteria

1. WHERE finance staff configure a fee structure THE system SHALL present the
   school's classes as a selectable dropdown list scoped to the tenant.
2. THE system SHALL store one fee structure per (tenant, class, academic year)
   with its own term tuition amounts and itemised academic-year charges.
3. IF a class already has a fee structure for the selected academic year THEN THE
   system SHALL block creating another and SHALL require the existing structure to
   be explicitly removed before a new one is created, while still allowing edits
   to the existing structure's values.
4. THE dropdown SHALL indicate which classes already have a configured structure
   for the selected academic year and which do not.
5. IF finance staff select a class that is not in their tenant THEN THE system
   SHALL reject the configuration request.

### Requirement 4: Billing students from a fee structure per term

**User Story:** As finance staff, I want to generate each student's bills for a
term from the class fee structure, so that students are charged consistently.

#### Acceptance Criteria

1. WHEN finance staff bill a term for a class THE system SHALL create fees for
   every actively enrolled student in that class for that term.
2. THE per-term bill SHALL include that term's tuition and SHALL include the
   itemised academic-year charges only once per academic year.
3. IF a student already has a tuition charge for the same class, term, and
   academic year THEN THE system SHALL skip only that duplicate tuition charge
   while still creating the student's other applicable charges.
4. WHEN billing completes THE system SHALL report how many students were billed.
5. WHERE a class has no actively enrolled students THE system SHALL report that
   nothing was billed rather than creating orphan charges.

### Requirement 5: Parents view their children's financial records

**User Story:** As a parent, I want to see the fees, payments, and outstanding
balance for each of my children, so that I know what I owe and what I have paid.

#### Acceptance Criteria

1. WHERE a parent opens their portal THE system SHALL show, for each linked
   child, the total billed, total paid, and outstanding balance.
2. WHEN a parent views a child's financial detail THE system SHALL list that
   child's charges and payments grouped by academic year and term.
3. THE system SHALL only expose financial records for students actually linked to
   the requesting parent and within the parent's tenant.
4. IF a parent has more than one child THE system SHALL let the parent switch
   between children and SHALL show the selected child's records.
5. THE system SHALL show an aggregate outstanding total across all of the
   parent's children, counting only children whose link to the parent is
   verified.

### Requirement 6: Online fee payment from student and parent portals

**User Story:** As a parent or student, I want to pay outstanding fees directly
from my portal, so that I can settle balances without visiting the school.

#### Acceptance Criteria

1. WHERE an outstanding balance exists THE system SHALL offer an online payment
   action in the student and parent portals.
2. WHEN a user starts an online payment THE system SHALL create a tenant-scoped
   payment session and redirect the payer to the Monime hosted checkout.
3. WHEN Monime confirms a completed payment THE system SHALL record the payment,
   reduce the corresponding invoice balance, and settle the underlying fees,
   exactly once per session.
4. IF online payments are not configured for the tenant THEN THE system SHALL
   hide the online payment action and SHALL NOT start a session.
5. WHEN a payment completes THE system SHALL send a receipt to the payer.
6. IF a parent attempts to pay for a student not linked to them THEN THE system
   SHALL reject the payment request.

### Requirement 7: School expense tracking

**User Story:** As finance staff, I want to record my school's operating expenses
by academic year and term, so that I can see spending alongside fee collection.

#### Acceptance Criteria

1. THE system SHALL let finance staff record a school expense with an amount, a
   category, a date, an academic year, and an optional term, scoped to the tenant.
2. THE system SHALL let finance staff view, edit, and delete their tenant's
   recorded expenses.
3. THE system SHALL report total expenses per academic year and per term for the
   tenant.
4. THE system SHALL present a financial summary that shows fee collection against
   school expenses for a selected academic year.
5. IF a non-finance user attempts to create, edit, delete, or view school
   expenses THEN THE system SHALL deny the request.

### Requirement 8: Financial settings and access restrictions

**User Story:** As a school administrator, I want financial configuration and
records restricted to authorized staff, so that sensitive money data is
protected.

#### Acceptance Criteria

1. THE system SHALL restrict viewing and editing of financial configuration to
   finance staff.
2. THE system SHALL restrict creating fees, generating invoices, recording manual
   payments, billing terms, and managing expenses to finance staff.
3. WHERE financial settings are shown THE system SHALL let finance staff
   configure the tenant's currency, late-fee policy, and accepted payment
   methods.
4. THE system SHALL let finance staff configure or confirm the tenant's Monime
   online-payment availability without exposing secret credentials in plain text
   to the browser after they are saved.
5. IF a non-finance user requests a financial management endpoint THEN THE system
   SHALL deny the request with an authorization error.
6. WHILE a user is a student or parent THE system SHALL allow them to view and
   pay only their own (or their children's) fees and SHALL NOT allow them to
   access financial configuration or other students' records.

### Requirement 9: Consistent financial reporting for staff

**User Story:** As finance staff, I want accurate collection and outstanding
figures for my school, so that I can manage the school's finances.

#### Acceptance Criteria

1. THE system SHALL report, for the tenant, total billed, total collected, and
   total outstanding for a selected academic year.
2. THE system SHALL report collection and outstanding figures broken down by
   term, by class, and by level.
3. THE reported totals SHALL be derived from the same underlying charges and
   payments used by the student ledger, so staff and family views agree.
4. WHEN a payment is recorded or a charge changes THE system SHALL update the
   reported figures synchronously, so any report read after the change reflects
   it immediately.

### Requirement 10: Preserve existing behavior and data during consolidation

**User Story:** As an existing user, I want the current finance pages, invoices,
payments, and Monime flow to keep working, so that consolidating the financial
system does not break what already runs.

#### Acceptance Criteria

1. THE existing finance pages (fee structures, invoices, payments, payment
   return) SHALL continue to function.
2. THE existing student and parent portal fee views SHALL continue to function.
3. THE Monime checkout, session polling, and webhook reconciliation SHALL
   continue to function.
4. THE system SHALL resolve all charges against a single, consistent student
   identifier; IF an identity inconsistency is detected between fee creation and
   billing THEN THE system SHALL reject the operation with an error rather than
   guessing a reconciliation.
5. THE consolidation SHALL NOT delete existing fees, invoices, or payment
   records.
