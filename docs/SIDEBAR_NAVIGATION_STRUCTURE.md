# Sidebar Navigation Structure

## Overview
The admin sidebar has been enhanced with professional, comprehensive navigation including collapsible sections, role-based filtering, and persistent state management.

## Features

### 1. **Toggle Functionality**
- **Desktop**: Sidebar toggle persists user preference in localStorage
- **Mobile**: Sidebar auto-collapses on resize, closes when navigating
- **Smooth Animations**: 200ms transition for expand/collapse
- **Menu Button**: Located in header to toggle sidebar visibility

### 2. **Role-Based Access**
Each menu item and section is filtered based on user role:
- admin
- principal
- teacher
- student
- parent
- guardian
- accountant
- admissionsOfficer

Users only see menu items appropriate for their role.

### 3. **Collapsible Sections**
Sections expand/collapse with visual indicators (chevron rotation):
- Maintains expanded/collapsed state during session
- Section headers show icon and label
- Smooth animation for expand/collapse

---

## Navigation Structure

### **Dashboard**
- **Path**: `/dashboard`
- **Icon**: Home
- **Roles**: All roles
- **Type**: Single link (no children)

---

### **Academic Section** 
- **Icon**: Graduation Cap
- **Roles**: admin, principal, teacher
- **Children**:
  - **Students** → `/students` (admin, principal, teacher, admissionsOfficer)
  - **Classes** → `/classes` (admin, principal, teacher)
  - **Teachers** → `/teachers` (admin, principal)
  - **Subjects** → `/subjects` (admin, principal)

---

### **Academics Section**
- **Icon**: Chart Bar
- **Roles**: admin, principal, teacher, student
- **Children**:
  - **Grades** → `/grades` (admin, principal, teacher, student)
  - **Attendance** → `/attendance` (admin, principal, teacher, student)
  - **Reports** → `/reports` (admin, principal, teacher)
  - **Timetable** → `/timetable` (admin, principal, teacher, student)

---

### **Finance Section**
- **Icon**: Money Bill
- **Roles**: admin, principal, accountant
- **Children**:
  - **Fees** → `/fees` (admin, principal, accountant)
  - **Payments** → `/payments` (admin, principal, accountant)
  - **Invoices** → `/invoices` (admin, principal, accountant)
  - **Financial Reports** → `/financial-reports` (admin, principal, accountant)

---

### **Communication Section**
- **Icon**: Bell
- **Roles**: admin, principal, teacher, parent
- **Children**:
  - **Notifications** → `/notifications` (admin, principal, teacher, parent)
  - **Announcements** → `/announcements` (admin, principal)
  - **Messaging** → `/messages` (admin, principal, teacher, parent)

---

### **Administration Section**
- **Icon**: Building
- **Roles**: admin, principal
- **Children**:
  - **Users** → `/users` (admin, principal)
  - **Roles & Permissions** → `/roles` (admin only)
  - **School Settings** → `/school-settings` (admin, principal)
  - **Departments** → `/departments` (admin, principal)

---

### **System Section**
- **Icon**: Cog
- **Roles**: admin only
- **Children**:
  - **Audit Logs** → `/audit-logs` (admin)
  - **Backups** → `/backups` (admin)
  - **System Health** → `/system-health` (admin)
  - **Settings** → `/settings` (admin)

---

### **Quick Access (Bottom Section)**
- **Settings** → `/settings`
- **Logout** → Clears auth and redirects to `/login`

---

## Component Features

### Sidebar Component (`Sidebar.tsx`)
- **Props**:
  - `isOpen: boolean` - Control sidebar visibility
  - `onClose?: () => void` - Callback when sidebar should close

- **Sub-components**:
  - `MenuItem` - Renders individual navigation links
  - `MenuSection` - Renders collapsible menu sections with children

### MainLayout Component (`MainLayout.tsx`)
- **Features**:
  - Manages sidebar open/closed state
  - Persists preference to localStorage (desktop only)
  - Handles responsive behavior (auto-close on mobile)
  - Passes toggle callback to Header component

### Header Component (`Header.tsx`)
- **Features**:
  - Menu toggle button (hamburger icon)
  - User profile dropdown
  - Notifications panel
  - Quick access to profile and settings

---

## User Experience

### Desktop (≥1024px)
- Sidebar always visible by default
- User can toggle collapse/expand
- Preference persists on page reload
- Main content adjusts width dynamically

### Mobile (<1024px)
- Sidebar hidden by default
- Opens as overlay with semi-transparent backdrop
- Closes when navigating or clicking overlay
- Full-width content when sidebar closed

### Visual Indicators
- **Active Link**: Blue background with white text
- **Section Headers**: Chevron indicates expand/collapse state
- **Hover State**: Gray background on hover
- **Role-Based Visibility**: Appropriate items shown per user role
- **Nested Items**: Indented with left border for hierarchy

---

## Code Structure

```
Sidebar.tsx
├── NavItem interface - Menu item definition
├── MenuSection component - Collapsible sections
├── MenuItem component - Individual links
├── navItems array - All navigation items
└── Sidebar component - Main sidebar container

MainLayout.tsx
├── State management (sidebarOpen)
├── Responsive handling
├── localStorage persistence
└── Layout rendering (Header + Sidebar + Content)
```

---

## Total Links Summary

- **1** Dashboard link
- **6** Sections with **18** total child links
- **2** Bottom quick-access links (Settings, Logout)

**Total**: 21 navigation destinations

---

## Future Enhancements

- [ ] Add collapse/expand animation for smoother UX
- [ ] Add icon-only mode for collapsed sidebar on desktop
- [ ] Breadcrumb navigation support
- [ ] Active state inheritance for sections
- [ ] Badge support for notification counts
- [ ] Custom keyboard shortcuts for navigation
- [ ] Search/filter functionality for menu items
