# Requirements Document

## Introduction

This document defines the Admin Dashboard Design System for the Sierra Leone School Management System (SMS). It establishes a single source of truth for all UI/UX patterns, component specifications, visual language, data-fetching conventions, and accessibility standards that every admin page in the system must follow. The goal is that any page — whether it covers Students, Teachers, Finance, Attendance, Classes, or Reports — is visually consistent, behaviorally predictable, and built from the same shared component library.

The system currently runs React 18 + TypeScript with Tailwind CSS, Recharts, TanStack Table v8, React Hook Form + Zod, react-toastify / sonner for toasts, and Zustand for state management. The design system must codify the conventions already started (KPICard, Badge, Button, Card, ChartComponent, Sidebar) and fill the gaps needed to build every remaining admin module.

---

## Glossary

- **Design_System**: The complete set of UI standards, tokens, components, and patterns defined in this document.
- **Admin_Page**: Any page accessible to users with the roles `super_admin`, `principal`, `accountant`, or `admissions_officer`.
- **Role**: One of `super_admin`, `principal`, `teacher`, `student`, `parent`, `accountant`, `admissions_officer` as defined in `UserRole` type.
- **KPI_Card**: A metric summary card displaying a label, value, optional trend indicator, and icon.
- **Data_Table**: A paginated, sortable, filterable tabular display of list data.
- **Stat_Row**: A horizontal strip of 2–4 KPI_Cards displayed at the top of a page.
- **Page_Shell**: The standard outer scaffold of an Admin_Page: Page_Header + optional Breadcrumb + Page_Content.
- **Page_Header**: The top bar of a page containing the title, optional subtitle, and primary action buttons.
- **Breadcrumb**: A secondary navigation trail showing the current location in the app hierarchy.
- **Action_Bar**: A toolbar row above a Data_Table containing Search_Bar, Filter_Controls, and Action_Buttons.
- **Action_Button**: A Button variant used to trigger primary or secondary page-level actions (add, export, import).
- **Bulk_Toolbar**: A contextual bar that appears when one or more Data_Table rows are selected.
- **Modal**: A dialog overlay used for forms, confirmations, or detail views.
- **Status_Badge**: A coloured pill label representing the state of an entity (active, inactive, pending, etc.).
- **Toast**: A transient notification message displayed at the top-right of the screen.
- **Skeleton**: An animated placeholder rendered in place of content while data is loading.
- **Empty_State**: A placeholder UI shown when a data set is empty.
- **Error_State**: A UI component shown when a data fetch fails.
- **Date_Range_Picker**: An input control that allows the user to select a start and end date.
- **Multi_Select_Filter**: A dropdown control that allows selecting multiple filter values simultaneously.
- **Progress_Bar**: A horizontal bar showing a value as a proportion of a maximum.
- **Avatar_Group**: A stacked set of circular user avatars representing a group of people.
- **Chart**: A data visualisation rendered using Recharts (line, bar, pie, or donut variants).
- **Confirmation_Dialog**: A Modal that asks the user to confirm a destructive or irreversible action before proceeding.
- **Page_Tabs**: A tab strip rendered within a Page_Shell to switch between sub-sections without navigation.
- **Token**: A named design variable (colour, spacing, font size, shadow) stored as a CSS custom property.
- **Currency**: Sierra Leonean Leone (Le / SLL), the default monetary unit for all financial displays.

---

## Requirements

### Requirement 1: Design Token System

**User Story:** As a frontend developer, I want a single set of named design tokens, so that every component uses the same colours, typography, and spacing without hardcoded values.

#### Acceptance Criteria

1. THE Design_System SHALL define a primary colour palette using CSS custom properties: `--color-primary` (#2563EB), `--color-primary-hover` (#1D4ED8), `--color-primary-light` (#EFF6FF), and their dark-mode counterparts.
2. THE Design_System SHALL define semantic colour tokens for success (#10B981), warning (#F59E0B), error (#EF4444), and info (#3B82F6), each paired with a light background variant and a dark-mode variant.
3. THE Design_System SHALL define a neutral grey scale from `--color-gray-50` through `--color-gray-900` aligned with Tailwind's default slate/gray scale.
4. THE Design_System SHALL define typography tokens for font sizes (`--text-xs` through `--text-4xl`), font weights (`--font-normal`, `--font-medium`, `--font-semibold`, `--font-bold`), and line heights.
5. THE Design_System SHALL define spacing tokens (`--space-1` through `--space-16`) that map to Tailwind's 4 px grid.
6. THE Design_System SHALL define shadow tokens (`--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`) matching the values already declared in `theme.css`.
7. THE Design_System SHALL define border-radius tokens: `--radius-sm` (4 px), `--radius-md` (8 px), `--radius-lg` (12 px), `--radius-xl` (16 px), `--radius-full` (9999 px).
8. THE Design_System SHALL define a transition token `--transition-default` (all 0.2 s ease-in-out) for interactive elements.
9. WHEN the user's OS or the `data-theme` attribute is set to `dark`, THE Design_System SHALL switch all tokens to their dark-mode counterparts automatically.
10. IF any component uses a colour value that is not defined as a Token, THEN THE Design_System SHALL document the usage as a design standard violation without enforcing a build-time failure.

---

### Requirement 2: Page Shell and Layout Standard

**User Story:** As a user, I want every admin page to have the same layout structure, so that I always know where to find the title, actions, and content regardless of which module I am on.

#### Acceptance Criteria

1. THE Page_Shell SHALL consist of, in order from top to bottom: Breadcrumb (optional), Page_Header, Page_Content.
2. THE Page_Header SHALL render the page title as an `h1` element using `--text-2xl --font-bold` on desktop and `--text-xl --font-bold` on mobile, regardless of whether other `h1` elements exist on the same page.
3. WHEN a page has a contextual subtitle (e.g., "Manage student enrolment records"), THE Page_Header SHALL display it below the title using `--text-sm --color-text-secondary`.
4. THE Page_Header SHALL render primary Action_Buttons in a flex row aligned to the right of the title on desktop, and below the title on mobile.
5. THE Page_Shell SHALL maintain the existing `MainLayout` scaffold (Header + Sidebar + main content area) established in `MainLayout.tsx`.
6. THE Page_Shell content area SHALL use a maximum width of `max-w-7xl` centred with horizontal padding `px-4 sm:px-6 lg:px-8` and vertical padding `py-6`.
7. WHEN the Breadcrumb is rendered, THE Breadcrumb SHALL display a home icon followed by slash-separated segment links, with the last segment non-clickable.
8. THE Breadcrumb SHALL be rendered above the Page_Header at `text-sm` size using `--color-text-secondary` for parent segments and `--color-text` for the current page.
9. WHILE a page is loading its initial data, THE Page_Shell SHALL render a Skeleton in place of the Page_Content area.
10. THE Page_Shell SHALL be fully responsive across three breakpoints: mobile (< 640 px), tablet (640 px – 1023 px), and desktop (≥ 1024 px).

---

### Requirement 3: KPI / Stat Cards

**User Story:** As an admin, I want a consistent summary card at the top of every list or report page, so that I can immediately see the most important numbers before drilling into the data.

#### Acceptance Criteria

1. THE KPI_Card SHALL display, at minimum, a label, a numeric or textual value, and a colour-coded accent.
2. THE KPI_Card SHALL support an optional trend indicator showing percentage change. The arrow direction SHALL be set independently of the colour; the colour SHALL automatically follow the direction — green for positive and red for negative — without requiring the caller to set both properties together.
3. THE KPI_Card SHALL support an optional icon placed in the top-right corner at 32 px size.
4. THE KPI_Card SHALL support the colour variants: `blue`, `green`, `red`, `amber`, `purple`, and `indigo`, matching the existing `KPICard.tsx` implementation.
5. WHEN `isLoading` is true, THE KPI_Card SHALL replace the value and trend areas with animated Skeleton elements.
6. WHEN a KPI_Card has an `onClick` handler, THE KPI_Card SHALL display a pointer cursor and apply a hover shadow transition.
7. THE Stat_Row SHALL render 2–4 KPI_Cards in a responsive CSS grid: 1 column on mobile, 2 columns on tablet, and 4 columns on desktop.
8. THE KPI_Card SHALL apply a left-border accent of 4 px in the card's accent colour using `border-l-4`.
9. WHEN a monetary value is displayed in a KPI_Card, THE KPI_Card SHALL prefix the value with "Le" to represent Sierra Leonean Leone.
10. THE KPI_Card value field SHALL support both `string` and `number` types to accommodate formatted values such as "Le 1,250,000" or "94.5%".

---

### Requirement 4: Data Table

**User Story:** As an admin, I want every list view to use the same table component with sorting, filtering, and pagination, so that I can work with all data sets using the same familiar interactions.

#### Acceptance Criteria

1. THE Data_Table SHALL support column-level ascending and descending sort, toggled by clicking the column header.
2. WHEN a column is sorted, THE Data_Table SHALL display a sort indicator arrow in the column header.
3. THE Data_Table SHALL support server-side and client-side pagination with configurable page sizes of 10, 25, 50, and 100 rows.
4. THE Data_Table SHALL display the current page, total pages, and total record count in a pagination footer. THE Data_Table SHALL keep the pagination footer visible even when an error state or empty state is displayed in the table body.
5. THE Data_Table SHALL support row selection via checkboxes, with a header checkbox that selects or deselects all visible rows.
6. WHEN one or more rows are selected, THE Data_Table SHALL display the Bulk_Toolbar above the table listing the count of selected rows and available bulk actions. WHEN no rows are selected, THE Data_Table SHALL hide the Bulk_Toolbar.
7. THE Data_Table SHALL support column-level search via the Action_Bar Search_Bar filtering visible rows in real time for client-side mode or debouncing and emitting a search event for server-side mode.
8. THE Data_Table SHALL support an optional row-level action menu rendered in the last column with at minimum "Edit" and "Delete" options.
9. WHEN the Data_Table fetch fails, THE Data_Table SHALL render the Error_State with a "Retry" button inside the table body, regardless of whether a filter is active or the data set is empty.
10. WHILE data is loading, THE Data_Table SHALL render 5 Skeleton rows of the same column structure in place of real data.
11. WHEN the data set is empty after a successful fetch and no fetch error is present, THE Data_Table SHALL render an Empty_State inside the table body.
12. THE Data_Table SHALL be horizontally scrollable on mobile so that all columns remain accessible without layout breakage.
13. THE Data_Table SHALL support fixed column widths via optional `width` configuration per column.
14. THE Data_Table SHALL be built on TanStack Table v8 to leverage the existing `@tanstack/react-table` dependency.

---

### Requirement 5: Action Bar (Search, Filters, Action Buttons)

**User Story:** As an admin, I want a consistent toolbar above every data table, so that I can search, filter, and trigger page actions without hunting for controls.

#### Acceptance Criteria

1. THE Action_Bar SHALL render as a flex row above the Data_Table containing, from left to right: Search_Bar, Filter_Controls, and Action_Buttons.
2. THE Search_Bar SHALL display a search icon on the left, accept free-text input, and emit a debounced `onSearch` event after 300 ms of inactivity.
3. THE Search_Bar SHALL display a clear (×) button when the input is non-empty.
4. THE Action_Bar SHALL support an "Add" primary Action_Button in the top-right using the `default` Button variant (blue).
5. THE Action_Bar SHALL support an "Export" secondary Action_Button using the `outline` Button variant with a download icon.
6. WHERE bulk import is supported by the page, THE Action_Bar SHALL include an "Import" Action_Button using the `outline` Button variant with an upload icon.
7. THE Multi_Select_Filter SHALL display a labelled dropdown that supports selecting multiple options; selected options SHALL be shown as removable chips inside the dropdown trigger.
8. THE Date_Range_Picker SHALL display two date inputs (Start and End) and SHALL use the existing `react-datepicker` dependency.
9. THE Action_Bar SHALL always display a "Filters" toggle button on mobile that opens a slide-over panel, regardless of how many filter controls are present. WHEN the page has more than 3 filter controls on mobile, the filter controls SHALL be rendered exclusively inside the slide-over panel rather than inline.
10. THE Action_Bar SHALL display an active filter count badge on the "Filters" button when any filter has a non-default value.

---

### Requirement 6: Modals and Dialogs

**User Story:** As an admin, I want all pop-up forms and confirmations to use a consistent modal pattern, so that interactions feel familiar and accessible across every module.

#### Acceptance Criteria

1. THE Modal SHALL render as a centred overlay with a semi-transparent dark backdrop (`bg-black/50`).
2. THE Modal SHALL trap focus within the dialog while open, and return focus to the trigger element when closed.
3. WHEN the user presses the Escape key, THE Modal SHALL close and discard unsaved changes.
4. WHEN the user clicks the backdrop, THE Modal SHALL close regardless of the event that triggered the close (Escape key press and backdrop click are processed independently; either one closes the modal).
5. THE Modal SHALL support three size variants: `sm` (448 px), `md` (576 px), and `lg` (768 px) maximum width.
6. THE Modal SHALL render a header with a title and close button when those elements are provided. WHEN header elements are absent, THE Modal SHALL render without them rather than blocking rendering.
7. THE Confirmation_Dialog SHALL be a specialised Modal variant with a warning icon, a descriptive message, a `Cancel` ghost button, and a `Confirm` destructive button.
8. WHEN the Confirmation_Dialog confirm action is in progress, THE Confirmation_Dialog SHALL disable both buttons and show a spinner on the Confirm button.
9. THE Modal footer SHALL render action buttons right-aligned with the primary action on the right.
10. THE Modal SHALL be accessible with `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing to the modal title element.

---

### Requirement 7: Forms and Validation

**User Story:** As an admin, I want all forms across the system to look and validate consistently, so that data entry is predictable and errors are clearly communicated.

#### Acceptance Criteria

1. THE Design_System SHALL define a standard form field composed of: a `label` element, an `input` / `select` / `textarea`, an optional helper text line, and an optional error message line.
2. THE Design_System form field SHALL use React Hook Form as the form state manager and Zod for schema validation, matching the existing `@hookform/resolvers` and `zod` dependencies.
3. WHEN a form field value fails Zod validation, THE Design_System form field SHALL display a red border (`border-error`), a red error message below the input, and a red icon inside the input.
4. THE Design_System form field SHALL display a helper text in `--color-text-secondary` below the input when the field is in its default state.
5. THE Design_System form field label SHALL render a red asterisk (*) when the field is required.
6. WHEN a form is submitted while any required field is empty, THE Design_System SHALL prevent submission. THE Design_System SHALL attempt to focus the first invalid field; focusing a field is independent of whether submission is blocked.
7. THE Design_System SHALL provide a `FormSection` wrapper component that groups related fields under a section title and divider.
8. WHEN a form is submitted successfully, THE Design_System SHALL close the Modal (if form is in a Modal), clear the form state, and show a success Toast. These three actions are performed in sequence; partial completion is acceptable if an individual action fails.
9. IF a form submission API call fails, THEN THE Design_System SHALL display the server error message in a red alert banner inside the form without closing the Modal.
10. THE Design_System form field SHALL support read-only mode that renders the value as styled plain text rather than an editable input.

---

### Requirement 8: Status Badges

**User Story:** As an admin, I want all status labels to use a consistent badge style, so that entity states are immediately recognisable across every module.

#### Acceptance Criteria

1. THE Status_Badge SHALL map the following canonical status values to specific colour variants: `active` → success-green, `inactive` → gray, `pending` → warning-amber, `suspended` → destructive-red, `paid` → success-green, `overdue` → destructive-red, `partial` → warning-amber, `draft` → gray, `published` → info-blue, `cancelled` → destructive-red.
2. THE Status_Badge SHALL render as a rounded-full pill using `px-2.5 py-0.5 text-xs font-medium` following the existing `Badge` component API.
3. THE Status_Badge SHALL accept a `status` string prop and derive its colour variant from the canonical mapping automatically.
4. THE Status_Badge SHALL support an optional leading dot indicator of exactly 4 px in diameter in the same colour as the badge variant, applied uniformly regardless of badge size.
5. WHEN a status value does not match any canonical mapping, THE Status_Badge SHALL render with the `secondary` (gray) variant and display the raw status string capitalised.
6. THE Design_System SHALL use the existing `badge.tsx` component as the base and extend it with the `Status_Badge` wrapper rather than creating a parallel implementation.

---

### Requirement 9: Charts and Data Visualisation

**User Story:** As an admin, I want every report and dashboard chart to look and behave consistently, so that I can read data quickly across different modules.

#### Acceptance Criteria

1. THE Design_System SHALL provide a `ChartCard` wrapper that adds a standard card shell (title, optional subtitle, optional date range filter) around every Chart.
2. THE ChartCard SHALL support four chart types: `line`, `bar`, `pie`, and `donut`, using the Recharts library already installed.
3. THE ChartCard SHALL use the canonical Design_System colour palette as the default series colours: blue (#2563EB), green (#10B981), amber (#F59E0B), red (#EF4444), purple (#8B5CF6), cyan (#06B6D4).
4. THE ChartCard SHALL use `ResponsiveContainer` from Recharts so that charts resize correctly at all breakpoints.
5. WHEN `isLoading` is true, THE ChartCard SHALL display an animated Skeleton placeholder of the same dimensions as the chart. WHEN `isLoading` is false and the data set is empty, THE ChartCard SHALL display the Empty_State message. Both states may be displayed simultaneously when the implementation requires it.
6. WHEN the chart data set is empty, THE ChartCard SHALL display an Empty_State message inside the chart area.
7. THE ChartCard SHALL support an optional Export button in the card header that triggers a PNG download of the chart.
8. THE donut chart variant SHALL display a centred label inside the donut showing the total or a key metric.
9. THE ChartCard tooltips SHALL use a dark background (`bg-gray-800 text-white`) with rounded corners and `--shadow-md` for visibility against light page backgrounds.
10. THE ChartCard x-axis labels SHALL be rotated 45° when the chart has more than 8 data points and the chart width is below 600 px to prevent label overlap.

---

### Requirement 10: Loading Skeletons

**User Story:** As a user, I want to see placeholder shapes while data is loading, so that the page doesn't jump or show blank areas.

#### Acceptance Criteria

1. THE Skeleton SHALL render as an animated grey rectangle (`bg-gray-200 animate-pulse rounded`) with configurable width and height.
2. THE Design_System SHALL provide the following pre-composed Skeleton variants: `SkeletonText` (full-width line), `SkeletonCard` (KPI_Card shape), `SkeletonTableRow` (row of cells matching table column widths), and `SkeletonChart` (rectangular chart area).
3. WHEN a Data_Table is loading, THE Design_System SHALL render exactly 5 `SkeletonTableRow` elements in the table body.
4. WHEN a Stat_Row is loading, THE Design_System SHALL render `SkeletonCard` elements matching the configured column count.
5. WHEN a ChartCard is loading, THE Design_System SHALL render one `SkeletonChart` of the same configured height.
6. THE Skeleton pulse animation duration SHALL be 1.5 s to match Tailwind's default `animate-pulse` timing.

---

### Requirement 11: Empty States and Error States

**User Story:** As a user, I want clear and helpful messages when there is no data or a data fetch fails, so that I understand what happened and what to do next.

#### Acceptance Criteria

1. THE Empty_State SHALL display a centred illustration or icon, a primary message in `--font-semibold`, and an optional secondary message in `--color-text-secondary`.
2. THE Empty_State SHALL support an optional call-to-action Button (e.g., "Add your first student").
3. THE Empty_State primary message SHALL be specific to the context (e.g., "No students found" rather than "No records").
4. WHEN a search filter produces no results, THE Empty_State SHALL display a message indicating the search term produced no matches and a "Clear search" link.
5. THE Error_State SHALL display a red icon, an error message, and a "Try again" Button that retriggers the failed data fetch.
6. IF the Error_State receives an HTTP 403 status, THEN THE Error_State SHALL display "You do not have permission to view this data" instead of a technical error message.
7. IF the Error_State receives an HTTP 404 status, THEN THE Error_State SHALL display "This page or record could not be found" instead of a technical error message.
8. THE Empty_State and Error_State SHALL both be vertically centred within their container and maintain a minimum height of 200 px.

---

### Requirement 12: Notification Toasts

**User Story:** As a user, I want brief feedback messages after my actions (save, delete, error), so that I always know whether my action succeeded or failed.

#### Acceptance Criteria

1. THE Toast SHALL appear in the top-right corner of the screen, 16 px from the top and right edges.
2. THE Toast SHALL support four types: `success` (green), `error` (red), `warning` (amber), and `info` (blue), with a matching icon and left-border accent.
3. THE Toast SHALL auto-dismiss after exactly 4 seconds for `success` and `info` types and remain until dismissed by the user for `error` and `warning` types.
4. THE Toast SHALL support an explicit close (×) button.
5. WHEN multiple toasts are shown, THE Toast container SHALL stack them vertically with a 8 px gap.
6. THE Toast system SHALL use the existing `react-toastify` or `sonner` dependency rather than a custom implementation.
7. WHEN a form save succeeds, THE Design_System SHALL display a `success` Toast with the message "[Entity] saved successfully."
8. WHEN a record is deleted, THE Design_System SHALL display a `success` Toast with the message "[Entity] deleted successfully."
9. IF an API request fails, THEN THE Design_System SHALL display an `error` Toast with the server error message or a fallback message of "Something went wrong. Please try again."

---

### Requirement 13: Export and Bulk Actions

**User Story:** As an admin, I want to export data and act on multiple records at once, so that I can produce reports and manage records efficiently.

#### Acceptance Criteria

1. THE Export button SHALL support exporting the current filtered Data_Table view to CSV and PDF formats via a dropdown menu.
2. WHEN the user selects "Export to CSV", THE Design_System SHALL generate and download a UTF-8 CSV file whose filename includes the entity name and the current date (e.g., `students-2025-07-10.csv`).
3. WHEN the user selects "Export to PDF", THE Design_System SHALL generate a formatted PDF report with the school name, a report title, the generation date, and the table data.
4. THE Bulk_Toolbar SHALL appear as a fixed bar above the Data_Table only when one or more rows are selected, showing the selected row count and available bulk actions. THE Bulk_Toolbar SHALL be hidden when no rows are selected.
5. THE Bulk_Toolbar SHALL include a "Deselect All" link on the left and bulk action buttons on the right.
6. WHEN a bulk destructive action (e.g., "Delete selected") is triggered from the Bulk_Toolbar, THE Design_System SHALL show a Confirmation_Dialog before proceeding.
7. THE Bulk_Toolbar SHALL support the following standard bulk actions where applicable: Delete, Export selected, Change status, Assign to class.
8. WHEN a bulk action completes, THE Bulk_Toolbar SHALL dismiss, the selection SHALL be cleared, and the Data_Table SHALL refresh.

---

### Requirement 14: Advanced UI Components

**User Story:** As an admin, I want polished secondary components (progress bars, avatar groups, date pickers) that match the design system, so that every corner of the UI feels cohesive.

#### Acceptance Criteria

1. THE Progress_Bar SHALL accept a `value` (0–100), an optional `label`, and a `colour` variant matching the Design_System's semantic colour tokens.
2. THE Progress_Bar SHALL animate from 0 to the target value on initial mount using a 600 ms transition.
3. THE Progress_Bar height SHALL be configurable: `sm` (4 px), `md` (8 px), `lg` (12 px).
4. THE Avatar_Group SHALL display up to 5 circular user avatar images stacked with a −8 px negative margin and a white border ring.
5. WHEN the Avatar_Group contains more than 5 members, THE Avatar_Group SHALL display a "+N" overflow circle where N equals the total member count minus 5 (the maximum number of displayed avatars).
6. THE Date_Range_Picker SHALL use `react-datepicker` and format dates as `DD/MM/YYYY` matching the Sierra Leone locale convention.
7. WHEN the Date_Range_Picker start date is set to a date after the current end date, THE Date_Range_Picker SHALL automatically clear the end date and display a validation message indicating the conflict.
8. THE Multi_Select_Filter dropdown SHALL close when the user clicks outside the dropdown container.
9. THE Multi_Select_Filter SHALL display a "Select all" and "Clear all" option at the top of the option list.
10. THE Multi_Select_Filter trigger button SHALL display the first selected option's label followed by "+N more" when more than one option is selected.

---

### Requirement 15: Navigation Patterns — Page Tabs and Breadcrumbs

**User Story:** As a user, I want consistent tab navigation within pages and clear breadcrumbs, so that I always know where I am and can navigate back without confusion.

#### Acceptance Criteria

1. THE Page_Tabs SHALL render as a horizontal tab strip below the Page_Header using `border-b-2 border-blue-600` for the active tab and `border-transparent text-gray-600` for inactive tabs.
2. THE Page_Tabs SHALL support overflow scrolling on mobile so that all tabs remain accessible when the screen is narrow.
3. WHEN a tab is active, THE Page_Tabs SHALL update the URL query parameter `?tab=<tabId>` so that the active tab is preserved on page refresh. WHEN a tab becomes inactive, THE URL parameter SHALL retain the last active tab value and SHALL NOT be removed.
4. THE Breadcrumb SHALL render using `aria-label="breadcrumb"` and `<nav>` element for screen reader accessibility.
5. THE Breadcrumb home segment SHALL link to the role-aware dashboard path returned by `getDashboardPath()`.
6. WHEN back navigation is applicable (e.g., from a detail view to a list view), THE Page_Header SHALL include a left-chevron "Back" link above the title styled in `--color-text-secondary`.
7. WHEN navigating between tabs or performing any tab-related interaction (including initial tab load and URL updates), THE Design_System SHALL not trigger a full page reload; tab content SHALL render via conditional React rendering.

---

### Requirement 16: Role-Based Visibility

**User Story:** As a system administrator, I want the UI to automatically hide controls and pages that a user's role cannot access, so that users only see what is relevant and safe for them.

#### Acceptance Criteria

1. THE Design_System SHALL provide a `<RoleGuard>` component that accepts a `roles` prop and renders its children only when `canAccess(roles)` returns true.
2. WHEN `canAccess(roles)` returns false, THE RoleGuard SHALL render nothing by default, or render a fallback element if a `fallback` prop is provided.
3. THE Design_System SHALL specify role-visibility rules for Action_Buttons as restrictions: "Add" and "Delete" buttons SHALL be hidden for users whose role is not in the authorised set (`super_admin`, `principal`, and role-specific managers), but may be hidden for other reasons even for authorised roles.
4. THE Design_System SHALL specify that destructive Bulk_Toolbar actions are only visible to `super_admin` and `principal`.
5. THE Design_System SHALL specify that the Export button is visible to `super_admin`, `principal`, `accountant`, and `admissions_officer` roles.
6. WHEN a user with the `teacher` role accesses a page, THE Design_System SHALL hide the "Add", "Delete", "Export", and Bulk_Toolbar destructive actions.
7. WHEN a user with the `student` or `parent` role accesses the admin section, THE Design_System SHALL redirect the user to their role-specific dashboard path.
8. THE RoleGuard component SHALL read role data from the `useAuth` hook, not from local component state, to ensure consistency with session state.

---

### Requirement 17: Data Fetching Patterns

**User Story:** As a frontend developer, I want a standard approach for all data fetching, so that every admin page handles loading, error, and empty states consistently and without duplicated boilerplate.

#### Acceptance Criteria

1. THE Design_System SHALL define a standard async data-fetching hook pattern: `useEntityList<T>({ endpoint, params })` returning `{ data, isLoading, error, refetch, pagination }`.
2. THE Design_System SHALL define a standard detail hook pattern: `useEntityDetail<T>({ endpoint, id })` returning `{ data, isLoading, error, refetch }`.
3. THE Design_System SHALL define a standard mutation hook pattern: `useEntityMutation<T>({ endpoint, method })` returning `{ mutate, isLoading, error }` that automatically shows a Toast on success or failure.
4. WHEN `isLoading` is true and `data` is null, THE Design_System SHALL instruct pages to render the Skeleton state. WHEN `isLoading` is false and `data` is an empty array, THE Design_System SHALL also render the Skeleton state while stale data is being refreshed.
5. WHEN `isLoading` is false, `data` is an empty array, and no stale data refresh is in progress, THE Design_System SHALL instruct pages to render the Empty_State.
6. WHEN `error` is non-null, THE Design_System SHALL instruct pages to render the Error_State, regardless of whether data is also available.
7. THE Design_System SHOULD use TanStack Query (`@tanstack/react-query`) as the caching layer for all entity fetches, applying a default `staleTime` of 30 seconds.
8. THE Design_System SHALL not make duplicate simultaneous API calls for the same resource; TanStack Query's deduplication SHALL be used.
9. WHEN a mutation (create, update, delete) completes successfully, THE Design_System SHALL automatically invalidate the corresponding list query cache entry.
10. THE Design_System SHALL document that all API calls go through the centralised `apiClient.ts` instance so that authentication headers and base URL are applied uniformly.

---

### Requirement 18: Responsive Behaviour

**User Story:** As a user on a mobile device or tablet, I want every admin page to be usable on smaller screens, so that staff can work from phones and tablets in the field.

#### Acceptance Criteria

1. THE Design_System SHALL define three breakpoints: mobile (`< 640 px`), tablet (`640 px – 1023 px`), and desktop (`≥ 1024 px`), matching Tailwind's `sm` and `lg` breakpoints.
2. THE Sidebar SHALL be hidden off-screen on mobile and tablet, accessible via a hamburger menu button in the Header, consistent with the existing `MainLayout` implementation.
3. WHEN the Sidebar is open on mobile or any screen size, THE Sidebar SHALL render a dark overlay behind it and close when the overlay is tapped.
4. THE Data_Table SHALL be horizontally scrollable with `overflow-x-auto` on mobile.
5. THE Stat_Row SHALL collapse from 4 columns to 2 columns on tablet and 1 column on mobile.
6. THE Page_Header action buttons SHALL display icon-only on mobile (with tooltips) and icon + label on tablet and desktop.
7. THE Action_Bar SHALL stack the Search_Bar above the Action_Buttons on mobile.
8. THE Modal SHALL expand to full-screen on mobile (`width: 100vw; height: 100dvh`) and use the standard centred overlay on tablet and desktop.
9. THE Page_Tabs SHALL enable horizontal scroll on mobile without wrapping to a second row.
10. THE ChartCard charts SHALL render at a minimum height of 200 px on mobile, scaling up to 300 px on desktop.

---

### Requirement 19: Accessibility

**User Story:** As a user with assistive technology needs, I want the admin interface to be keyboard navigable and screen-reader friendly, so that the system is usable by all staff regardless of ability.

#### Acceptance Criteria

1. THE Design_System SHALL ensure all interactive elements (buttons, links, inputs, checkboxes) are reachable and activatable by keyboard using Tab, Enter, and Space.
2. THE Design_System SHALL ensure all form inputs have associated `<label>` elements linked via `htmlFor` / `id` attributes.
3. THE Design_System SHALL ensure all icon-only buttons have an `aria-label` attribute that describes their action.
4. THE Design_System SHALL ensure all images and illustrations used in the UI have meaningful `alt` text, or `alt=""` if decorative.
5. THE Design_System SHALL ensure colour is not the sole means of conveying information (e.g., Status_Badge SHALL also include a text label).
6. THE Design_System SHALL ensure the focus ring is visible on all interactive elements using a 2 px solid blue outline with 2 px offset (`focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`).
7. THE Design_System SHALL ensure text contrast meets WCAG 2.1 AA standards: 4.5:1 for normal text and 3:1 for large text.
8. THE Modal SHALL set `aria-modal="true"` and `role="dialog"` and lock scroll on the body while open.
9. THE Data_Table SHALL use `<table>`, `<thead>`, `<tbody>`, `<th scope="col">`, and `<td>` semantic HTML elements.
10. THE Toast container SHALL have `aria-live="polite"` so that screen readers announce new notifications.

---

### Requirement 20: Component Library Structure and Conventions

**User Story:** As a developer building new admin pages, I want a clear component folder structure and naming convention, so that I can find, use, and extend components predictably.

#### Acceptance Criteria

1. THE Design_System SHALL co-locate all shared admin components under `frontend/src/components/admin/` with sub-folders: `layout/`, `table/`, `forms/`, `charts/`, `feedback/`, and `common/`.
2. THE Design_System SHALL export all components from a barrel file at `frontend/src/components/admin/index.ts`.
3. THE Design_System SHALL name every component file in PascalCase matching its exported component name (e.g., `DataTable.tsx` exports `DataTable`).
4. THE Design_System SHALL provide a TypeScript interface for every component's props, exported alongside the component.
5. THE Design_System SHALL define a standard admin page template at `frontend/src/templates/AdminPageTemplate.tsx` that composes Page_Shell + Stat_Row + Action_Bar + Data_Table as a ready-to-use scaffold.
6. THE Design_System SHALL document each component's props, variants, and usage example in a `COMPONENTS.md` file in the `admin/` folder.
7. THE Design_System SHALL not introduce any new third-party libraries; all components SHALL be built from the packages already declared in `package.json`.
8. WHEN creating a new admin page, THE Design_System SHALL require developers to compose the page exclusively from the shared component library; custom inline HTML structures are not permitted for any admin page.
