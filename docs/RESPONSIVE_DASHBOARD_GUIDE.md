# Responsive Dashboard Design Guide

## Overview
This guide provides standardized responsive design patterns for all dashboards in the School Management System. All dashboards should follow these patterns for consistency.

## Currency Display
All currency amounts are displayed in **Sierra Leonean Leone (SLE)** with the symbol **Le**.

```typescript
import { formatCurrency } from '@utils/formatting';

// Always use the formatCurrency utility
const amount = formatCurrency(5000); // Returns: "Le 5,000"
```

## Responsive Breakpoints

| Breakpoint | Min Width | Max Width | Class Prefix |
|------------|-----------|-----------|--------------|
| Mobile (sm) | 0px | 640px | sm: |
| Tablet (md) | 641px | 768px | md: |
| Desktop (lg) | 769px | 1024px | lg: |
| Large (xl) | 1025px+ | - | xl: |

## Standard Dashboard Layout

```tsx
<div className="dashboard-container">
  {/* Header */}
  <div className="dashboard-header">
    <h1 className="dashboard-title">Dashboard Title</h1>
    <p className="dashboard-subtitle">Subtitle or description</p>
  </div>

  {/* Grid for cards */}
  <div className="dashboard-grid dashboard-grid-cols-4">
    {/* Stat cards go here */}
  </div>
</div>
```

## Stat Card Pattern

```tsx
<div className="stat-card">
  <div className="flex justify-between items-start">
    <div className="dashboard-flex-stack">
      <p className="stat-label">Total Students</p>
      <p className="stat-value">1,234</p>
    </div>
    <div className="stat-icon">
      <Icon className="w-full h-full text-blue-500" />
    </div>
  </div>
</div>
```

## Table Pattern

```tsx
<div className="dashboard-card">
  <div className="dashboard-card-header">
    <h2 className="dashboard-card-title">Recent Activity</h2>
    <button className="dashboard-btn">View All</button>
  </div>
  
  <div className="dashboard-table-container">
    <table className="dashboard-table">
      <thead>
        <tr>
          <th className="dashboard-table-header">Name</th>
          <th className="dashboard-table-header">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="dashboard-table-cell">John Doe</td>
          <td className="dashboard-table-cell">
            <span className="dashboard-badge bg-green-100 text-green-800">
              Active
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

## Chart Container Pattern

```tsx
<div className="dashboard-card">
  <div className="dashboard-card-header">
    <h2 className="dashboard-card-title">Performance Chart</h2>
  </div>
  <div className="dashboard-chart-container">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        {/* Chart components */}
      </LineChart>
    </ResponsiveContainer>
  </div>
</div>
```

## Button Patterns

```tsx
{/* Standard button */}
<button className="dashboard-btn bg-blue-600 text-white hover:bg-blue-700">
  Action
</button>

{/* Small button */}
<button className="dashboard-btn-sm bg-gray-200 text-gray-700 hover:bg-gray-300">
  Small Action
</button>

{/* Large button */}
<button className="dashboard-btn-lg bg-green-600 text-white hover:bg-green-700">
  Primary Action
</button>
```

## Grid Patterns

### 1 Column (Mobile-first)
```tsx
<div className="dashboard-grid dashboard-grid-cols-1">
  {/* Full width on all screens */}
</div>
```

### 2 Columns (Responsive)
```tsx
<div className="dashboard-grid dashboard-grid-cols-2">
  {/* 1 column on mobile, 2 on desktop */}
</div>
```

### 3 Columns (Responsive)
```tsx
<div className="dashboard-grid dashboard-grid-cols-3">
  {/* 1 column mobile, 2 on tablet, 3 on desktop */}
</div>
```

### 4 Columns (Responsive)
```tsx
<div className="dashboard-grid dashboard-grid-cols-4">
  {/* 1 mobile, 2 tablet, 3 desktop, 4 large screens */}
</div>
```

## Spacing Patterns

```tsx
{/* Small spacing */}
<div className="dashboard-spacing-sm">
  <div>Item 1</div>
  <div>Item 2</div>
</div>

{/* Medium spacing (default) */}
<div className="dashboard-spacing-md">
  <div>Item 1</div>
  <div>Item 2</div>
</div>

{/* Large spacing */}
<div className="dashboard-spacing-lg">
  <div>Section 1</div>
  <div>Section 2</div>
</div>
```

## Icon Sizing

```tsx
{/* Small icon */}
<Icon className="dashboard-icon-sm" />

{/* Medium icon */}
<Icon className="dashboard-icon-md" />

{/* Large icon */}
<Icon className="dashboard-icon-lg" />
```

## Mobile-Specific Utilities

### Hide on Mobile
```tsx
<div className="hide-mobile">
  This content is hidden on mobile devices
</div>
```

### Stack on Mobile
```tsx
<div className="dashboard-flex-row">
  {/* Stacks vertically on mobile, horizontal on larger screens */}
  <div>Item 1</div>
  <div>Item 2</div>
</div>
```

### Full Width on Mobile
```tsx
<button className="full-width-mobile dashboard-btn">
  Button spans full width on mobile
</button>
```

## Best Practices

### 1. **Always Use Utility Classes**
Instead of custom CSS, use the provided utility classes for consistency.

### 2. **Mobile-First Approach**
Start with mobile layout, then add responsive classes for larger screens.

```tsx
// ✅ Good
<div className="text-sm md:text-base lg:text-lg">

// ❌ Bad
<div className="text-lg md:text-sm">
```

### 3. **Consistent Spacing**
Use dashboard spacing utilities instead of manual margin/padding.

```tsx
// ✅ Good
<div className="dashboard-spacing-md">

// ❌ Bad
<div className="space-y-4 md:space-y-6">
```

### 4. **Currency Formatting**
Always use the `formatCurrency` utility for consistency.

```tsx
// ✅ Good
{formatCurrency(amount)}

// ❌ Bad
Le {amount.toFixed(2)}
```

### 5. **Responsive Images**
```tsx
<img 
  className="w-full h-auto rounded-lg" 
  src={src} 
  alt={alt}
/>
```

### 6. **Overflow Handling**
Always handle text overflow on mobile.

```tsx
<p className="text-truncate">Long text that should truncate...</p>
<p className="line-clamp-2">Multi-line text that clamps at 2 lines...</p>
```

## Dashboard Checklist

Before marking a dashboard as complete, verify:

- [ ] Uses `dashboard-container` wrapper
- [ ] Header uses `dashboard-header` and `dashboard-title`
- [ ] Cards use `dashboard-card` pattern
- [ ] Grids use `dashboard-grid` with appropriate columns
- [ ] Buttons use `dashboard-btn` classes
- [ ] Tables use `dashboard-table` pattern
- [ ] Icons use `dashboard-icon-*` sizing
- [ ] Spacing uses `dashboard-spacing-*` utilities
- [ ] Currency displays use `formatCurrency()`
- [ ] Tested on mobile (< 640px)
- [ ] Tested on tablet (641-1024px)
- [ ] Tested on desktop (> 1024px)
- [ ] All interactive elements are touch-friendly (min 44x44px)
- [ ] Text is readable at all breakpoints
- [ ] No horizontal scroll on mobile

## Testing Responsive Design

### Browser DevTools
1. Open Chrome/Firefox DevTools (F12)
2. Click the device toolbar icon (Ctrl+Shift+M)
3. Test these viewports:
   - iPhone SE (375px)
   - iPhone 12 Pro (390px)
   - iPad (768px)
   - iPad Pro (1024px)
   - Desktop (1280px+)

### Key Things to Check
- Text readability
- Button sizes (minimum 44x44px for touch)
- Table horizontal scroll works
- Cards stack properly
- Images scale correctly
- No overlapping elements
- Navigation works on mobile

## Common Responsive Issues & Solutions

### Issue: Table overflow on mobile
```tsx
// Solution: Use table container with horizontal scroll
<div className="dashboard-table-container">
  <table className="dashboard-table">
    {/* table content */}
  </table>
</div>
```

### Issue: Buttons too small on mobile
```tsx
// Solution: Use dashboard-btn with proper padding
<button className="dashboard-btn">
  {/* Automatically has min height for touch */}
</button>
```

### Issue: Text too large/small
```tsx
// Solution: Use responsive text utilities
<h1 className="dashboard-title">
  {/* Scales from 2xl to 4xl */}
</h1>
```

### Issue: Grid doesn't stack on mobile
```tsx
// Solution: Use responsive grid classes
<div className="dashboard-grid dashboard-grid-cols-3">
  {/* Automatically stacks to 1 column on mobile */}
</div>
```

## Support
For questions or issues with responsive design, refer to:
- Tailwind CSS Documentation: https://tailwindcss.com/docs
- This guide: `/docs/RESPONSIVE_DASHBOARD_GUIDE.md`
