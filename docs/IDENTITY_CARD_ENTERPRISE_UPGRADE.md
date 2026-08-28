# Identity Card System — Enterprise Upgrade Plan

**Date:** August 2, 2026  
**Module:** `/identity/templates` + `/identity/card`  
**Status:** ✅ Phase 1–4 Complete — August 2, 2026  
**Priority:** Critical → High → Medium

---

## Overview

This document tracks all enhancements needed to bring the Identity Card module to full enterprise standard. The system already has a strong foundation — live drag-and-drop canvas, 14 preset themes, dual-sided printing, bulk generation, and QR verification. This upgrade addresses layout quality, editability, responsiveness, and missing enterprise controls.

---

## Critical Bugs (Broken Functionality)

### BUG-01 — QR Verify API path mismatch (404 error)
- **File:** `frontend/src/services/idCardService.ts`
- **Problem:** Frontend calls `/api/v1/qr-codes/verify` but the backend route is registered at `/api/v1/id-cards/qr-codes/verify`
- **Fix:** Correct the URL in `idCardService.verifyQrCode()`

### BUG-02 — `minimal-clean` header style renders nothing
- **File:** `VisualIdCardRenderer.tsx`
- **Problem:** No render block for `headerStyle === 'minimal-clean'`, so cards using this preset show a blank header area
- **Fix:** Implement the minimal-clean header style (clean top line / thin accent bar)

### BUG-03 — `logoPosition` control is a dead UI control
- **File:** `TemplateFormModal.tsx` + `VisualIdCardRenderer.tsx`
- **Problem:** The `logoPosition` field (`top-left`, `top-center`, `top-right`) in the General tab saves to config but the renderer ignores it — logo position only follows `layoutConfig.logoPositionConfig.x/y`
- **Fix:** Wire `logoPosition` to update `layoutConfig.logoPositionConfig.x` on change so the control has real effect

### BUG-04 — `hexagon` photo shape is not a hexagon
- **File:** `VisualIdCardRenderer.tsx`
- **Problem:** `photoShape === 'hexagon'` resolves to `rounded-xl shadow-inner` — a rectangle with rounded corners
- **Fix:** Implement a real CSS clip-path polygon hexagon

---

## Layout & Visual Quality Issues

### LAYOUT-01 — Back side is not professionally formatted
- **Problem:** The back side is hardcoded HTML, not responsive or visually proportionate. The magnetic stripe text is placeholder, the QR code floats without proper spacing, and the content area feels undesigned compared to the front
- **Fix:** Redesign the back side using the same mm-based scale system as the front. Make it theme-matched with proper zones: stripe zone, info zone, QR/barcode zone, footer

### LAYOUT-02 — Back side is not editable
- **Problem:** Clicking elements on the back side does nothing — there are no `onPointerDown` handlers on back-side elements that route through `handlePositionChange`. The QR code position is hardcoded
- **Fix:** Make the QR code, back-side school name, terms text, and barcode all draggable and selectable on the back canvas — same as front

### LAYOUT-03 — QR code spacing and sizing is broken on small widths
- **Problem:** The QR code `<QrCode>` SVG icon scales with `size=` in pixels but doesn't account for the `scale` factor properly. On cards narrower than 300px the QR overlaps other elements
- **Fix:** Calculate QR size dynamically using `(layout.qrCodePosition.size || 20) * scale` clamped to card bounds, with min/max guards

### LAYOUT-04 — Front side elements overlap at small container widths
- **Problem:** Absolute positions are in mm converted to px, but there are no bounds checks to prevent text/elements from overflowing the card when the card is rendered at small widths (e.g., in the grid view tiles)
- **Fix:** Add overflow hidden with text-ellipsis on all text fields; add responsive font scaling floor values

### LAYOUT-05 — Badge (portrait) layout needs redesign
- **Problem:** The portrait badge format content is cramped and unbalanced — photo takes up too much space leaving little room for text, and the bottom area is wasted
- **Fix:** Recalculate default badge layout proportions to follow ISO/IEC 7810 badge standards with proper zones

### LAYOUT-06 — Card border radius is inconsistent
- **Problem:** The card outer container uses `borderRadius: isPortrait ? '20px' : '14px'` but actual PVC cards use `3.18mm` radius. At different scales this looks inconsistent
- **Fix:** Calculate border radius from mm: `scale * 3.18` for PVC, `scale * 4` for badge

---

## Editor / TemplateFormModal Issues

### EDITOR-01 — Settings panel is not usable on medium screens (768px–1200px)
- **Problem:** The left settings panel is 380–400px wide. On tablets and medium laptops, this leaves almost no room for the canvas preview. The collapse behavior works but the UX is rough
- **Fix:** Convert to a bottom-sheet drawer on screens below 1024px, keeping the canvas full-width. Use a floating toolbar pill to toggle settings

### EDITOR-02 — No undo/redo for position changes
- **Problem:** After accidentally dragging an element to the wrong position, there's no way to undo. The user must manually drag it back or remember the original position
- **Fix:** Implement a simple undo stack (up to 20 states) with Ctrl+Z / Ctrl+Y keyboard shortcuts

### EDITOR-03 — No grid/ruler overlay option
- **Problem:** Professional card editors (Canva, Adobe Express) offer a ruler and grid overlay to help with alignment. The magnetic snap helps but there's no visual reference
- **Fix:** Add an optional mm-grid overlay toggle button in the canvas toolbar (dotted grid lines at 5mm intervals)

### EDITOR-04 — Element resize handles missing
- **Problem:** Elements can be dragged (repositioned) but cannot be resized. The photo frame, QR code size, and custom elements have fixed dimensions once placed
- **Fix:** Add resize handles (corner dots) on selected elements for photo, QR code, and custom badge/text elements

### EDITOR-05 — No `description` field in template creation
- **Problem:** The backend stores and returns a `description` field for templates, but there's no input for it in the form — it's always empty
- **Fix:** Add a description textarea in the General tab

### EDITOR-06 — Font selection is too limited (only 4 options)
- **Problem:** Only Helvetica, Times New Roman, Courier, and Inter are available. Enterprise clients expect a broader range of professional typography
- **Fix:** Add: Georgia, Garamond, Roboto, Open Sans, Lato, Montserrat, Raleway, Oswald, Playfair Display, Source Sans Pro (loaded via Google Fonts or system fallback)

### EDITOR-07 — No per-element opacity control
- **Problem:** Elements can be colored and sized but there's no opacity/transparency control. This is a common design need (e.g., watermark text, semi-transparent badge pills)
- **Fix:** Add an opacity slider (0–100%) to the selected element style panel

### EDITOR-08 — Logo upload only supports PNG/JPEG, not SVG
- **Problem:** The file input filter accepts `image/png, image/jpeg` only. SVG logos are extremely common for schools and scale perfectly on cards
- **Fix:** Add `image/svg+xml` to the accepted file types and handle SVG rendering correctly in the renderer

### EDITOR-09 — No background image/pattern support
- **Problem:** The card background is a solid color only. Enterprise cards often use subtle patterns (dots, lines, geometric shapes) or watermark images as the card background
- **Fix:** Add a background options section: solid color (existing), subtle pattern (built-in patterns: dots, crosshatch, diagonal lines, grid), or uploaded background image with opacity control

### EDITOR-10 — Custom element label edit is only available in the floating action bar
- **Problem:** To edit a custom element's text, you have to click on it in the canvas to get the floating bar, then type in it. This is unintuitive — the Fields & Text tab should also list all custom elements for editing
- **Fix:** Show custom elements in the Layout tab with inline label editors, color pickers, and a delete button

### EDITOR-11 — No "Submit for Approval" action in the template list
- **Problem:** Draft templates have no way to be submitted for approval from the TemplatesPage. The backend endpoint `POST /:templateId/submit-approval` exists but no button in the UI calls it
- **Fix:** Add "Submit for Approval" to row actions for `draft` status templates

### EDITOR-12 — No template preview (read-only card render from the list)
- **Problem:** Viewing a template requires opening the full editor. There's no quick read-only preview showing front and back of the actual card
- **Fix:** Add a "Preview" row action that opens a lightweight modal showing both sides of the rendered card

### EDITOR-13 — No template duplicate action
- **Problem:** To create a similar template, the user must create from scratch. Standard for all template systems is "Duplicate as Draft"
- **Fix:** Add "Duplicate" row action that clones the template with `(Copy)` suffix and `draft` status

---

## Cards Page (`/identity/card`) Issues

### CARD-01 — No "Report Lost" UI action
- **Problem:** The backend supports `POST /:cardId/report-lost` and the service has `reportLost()`, but there is no button anywhere in the UI to report a card as lost
- **Fix:** Add "Report Lost" to the card's row actions (for active cards) and inside CardDetailsModal

### CARD-02 — No "Reactivate" action for suspended cards
- **Problem:** Suspended cards have no reactivation button in the UI. The row actions only show "Revoke" for active cards — suspended cards are stuck
- **Fix:** Add "Reactivate" action for `suspended` status cards in both grid hover actions and table row actions

### CARD-03 — CardDetailsModal lacks action buttons
- **Problem:** The details modal is purely read-only. Enterprise standard requires inline Revoke, Suspend/Reactivate, Report Lost, and Regenerate from within the detail view
- **Fix:** Add action buttons to the modal footer based on current card status

### CARD-04 — CardDetailsModal only shows front side
- **Problem:** Double-sided templates have a back design, but the details modal only renders the front. The back is never visible
- **Fix:** Add a front/back toggle or side-by-side view in the details modal

### CARD-05 — Bulk job has no progress tracking UI
- **Problem:** After creating a bulk job, the UI shows a success state. There's no polling of `GET /bulk/:jobId/status` to show generation progress, counts (X of Y processed), or failure details
- **Fix:** After job creation, transition to a progress panel that polls `/bulk/:jobId/status` every 3 seconds and shows a progress bar, counts, and a download button when completed

### CARD-06 — No template thumbnail in table view
- **Problem:** Table view shows "Template: [name]" as plain text. Compared to the grid view's full card render, this is a regression
- **Fix:** Add a small card thumbnail (mini `VisualIdCardRenderer` at ~60px width) in the template column of the table view

### CARD-07 — Missing bulk job PDF download button
- **Problem:** Completed bulk jobs generate a PDF but there's no download button for it anywhere in the UI
- **Fix:** Add a download button in the bulk generate tab for the most recently completed job, and in job status results

---

## Missing Enterprise Features

### ENT-01 — No template version history / changelog
- **Problem:** The template has a `version` field that increments on each update, but there is no UI to see what changed between versions or to restore a previous version
- **Fix:** Add a version history panel in the template details/editor showing: version number, changed by, changed at, status at that version

### ENT-02 — No card issuance analytics chart on the Cards page
- **Problem:** The backend has full reporting endpoints (`/reports/issuance`, `/reports/volume`, `/reports/dashboard`, `/reports/security-alerts`) but none of these are surfaced in the cards page UI — just raw KPI numbers
- **Fix:** Add a mini analytics section with: issuance trend chart (last 30 days), role distribution (student vs teacher vs staff), and a security alerts badge

### ENT-03 — No card print-ready export
- **Problem:** Individual card PDFs exist (when `pdfUrl` is set), but many cards don't have a PDF because the generation service may not have created one yet. There's no on-demand "Print this card" that generates a fresh render
- **Fix:** Add a "Print / Export PDF" button that calls `POST /preview` on the backend and streams the PDF for download

### ENT-04 — No accessibility labels on canvas elements
- **Problem:** The drag-and-drop canvas uses pointer events without ARIA roles, making it inaccessible to screen readers and keyboard-only users (beyond the arrow key nudge)
- **Fix:** Add `role="button"`, `aria-label`, `tabIndex={0}`, and `onKeyDown` Enter/Space handlers to all canvas elements

---

## Implementation Order

| Phase | Items | Target |
|---|---|---|
| **Phase 1 — Critical Fixes** | BUG-01, BUG-02, BUG-03, BUG-04 | Immediate |
| **Phase 2 — Layout Overhaul** | LAYOUT-01 through LAYOUT-06 | Session 1 |
| **Phase 3 — Editor Enhancements** | EDITOR-01 through EDITOR-13 | Session 1–2 |
| **Phase 4 — Cards Page** | CARD-01 through CARD-07 | Session 2 |
| **Phase 5 — Enterprise Features** | ENT-01 through ENT-04 | Session 2–3 |

---

## Files Being Modified

| File | Changes |
|---|---|
| `frontend/src/pages/identity/components/VisualIdCardRenderer.tsx` | Full rewrite — layout system, back-side editability, responsive QR, hexagon shape, minimal-clean, background patterns |
| `frontend/src/pages/identity/components/TemplateFormModal.tsx` | Undo/redo, grid overlay, resize handles, description field, more fonts, opacity, SVG logo, background options, bottom-sheet on mobile, custom element list in Fields tab |
| `frontend/src/pages/identity/TemplatesPage.tsx` | Preview modal, duplicate action, submit-for-approval action, template thumbnail in table |
| `frontend/src/pages/identity/IdCardsPage.tsx` | Report Lost, Reactivate, bulk progress tracking, table thumbnail, bulk PDF download |
| `frontend/src/pages/identity/components/CardDetailsModal.tsx` | Action buttons, back-side preview toggle |
| `frontend/src/services/idCardService.ts` | Fix QR verify URL |

---

*Last updated: August 2, 2026*
