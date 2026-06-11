# Local Development Setup Guide - Phase 12

**Last Updated**: July 2, 2026  
**Objective**: Get backend, frontend, and all Phase 12 features running locally

---

## 🚀 Quick Start (5 minutes)

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- Git

### Step 1: Clone and Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# In another terminal, install frontend dependencies
cd frontend
npm install
```

### Step 2: Setup Environment

```bash
# Copy environment file
cp .env.example .env

# Edit .env with these minimal settings for local development:
NODE_ENV=development
PORT=3000
JWT_SECRET=dev-secret-change-in-production
REFRESH_TOKEN_SECRET=dev-refresh-secret
DATABASE_URL=postgresql://localhost/school_management
FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://localhost:3000/api
```

### Step 3: Start Services

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3 (Optional): Mobile
cd mobile
npm install
npm start
```

### Step 4: Access Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **Vite Preview**: http://localhost:5173

---

## 📋 Complete Setup Guide

### A. Database Setup (PostgreSQL)

#### Option 1: Using Docker (Recommended)

```bash
# Start PostgreSQL in Docker
docker run --name school-management-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=school_management \
  -p 5432:5432 \
  -d postgres:15

# Verify connection
psql postgresql://postgres:postgres@localhost:5432/school_management
```

#### Option 2: Local PostgreSQL Installation

```bash
# macOS (Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb school_management

# Connect to verify
psql -d school_management
```

#### Option 3: Neon Cloud (Recommended for Production Testing)

1. Go to https://neon.tech
2. Create account and project
3. Copy connection string
4. Add to `.env`:
   ```
   DATABASE_URL=postgresql://user:password@ep-xxxxx.us-east-1.neon.tech/school_management
   ```

### B. Backend Setup

```bash
cd backend

# 1. Install dependencies
npm install

# 2. Build TypeScript
npm run build

# 3. Run database migrations
npm run db:migrate

# 4. Seed database with test data
npm run db:seed

# 5. Start development server
npm run dev
```

**Expected Output**:
```
Server running on port 3000 in development mode
Health check: http://localhost:3000/health
```

**Verify Backend**:
```bash
# In another terminal, test API health
curl http://localhost:3000/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2026-07-02T10:30:00Z",
  "environment": "development",
  "uptime": 15.234
}
```

### C. Frontend Setup

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Start development server
npm run dev
```

**Expected Output**:
```
  VITE v5.0.8  ready in 234 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

**Access Application**:
- Open http://localhost:5173 in your browser
- You should see the login page

### D. Test Login

Use these credentials to test:

**Admin Account**:
```
Email: admin@example.com
Password: Admin123!@
```

**Teacher Account**:
```
Email: teacher@example.com
Password: Teacher123!@
```

**Student Account**:
```
Email: student@example.com
Password: Student123!@
```

---

## ✅ Verify Phase 12 Features

### 1. Real-time Dashboard (WebSocket)

```bash
# Backend automatically serves WebSocket
# Check if WebSocket is working:

# Open browser console (DevTools F12)
# Go to http://localhost:5173/admin-dashboard
# Check Network tab for WebSocket connection to ws://localhost:3000
```

### 2. Advanced Filtering

```bash
# Navigate to Admin Dashboard
# Look for "Advanced Filters" section
# Click on it to expand
# Add filters for Status, Date, Name
# Apply filters - should see <200ms response
```

### 3. Export Functionality

```bash
# In Admin Dashboard
# Look for "Export" button
# Select format (PDF, Excel, CSV, JSON)
# Select columns
# Click "Download Export"
# File should download in <2 seconds
```

### 4. Dark Mode

```bash
# Look for theme toggle button (moon/sun icon)
# Click to cycle through Light → Dark → System
# Page should smoothly transition themes
# Check localStorage → should save preference
```

### 5. Dashboard Builder

```bash
# In Admin Dashboard
# Look for "Customize Dashboard" or "Builder" button
# Drag widgets around
# Resize widgets
# Save layout
# Refresh page - layout should persist
```

### 6. Mobile App (React Native)

```bash
cd mobile
npm install
npm start

# Scan QR code with Expo Go app
# Or press 'w' for web preview
# Should see mobile interface with tabs
```

---

## 🔧 Useful Commands

### Backend

```bash
# Development
npm run dev              # Watch mode with live reload
npm run build           # Build TypeScript
npm start               # Run compiled code
npm run lint            # Check code quality
npm run lint:fix        # Auto-fix linting issues
npm run format          # Format code with Prettier

# Database
npm run db:migrate      # Run pending migrations
npm run db:rollback     # Rollback last migration
npm run db:seed         # Seed database

# Testing
npm run test            # Run unit tests
npm run test:coverage   # Generate coverage report
```

### Frontend

```bash
# Development
npm run dev             # Start dev server with Vite
npm run preview         # Preview production build
npm run build           # Build for production
npm run lint            # Check code quality
npm run lint:fix        # Auto-fix linting issues
npm run format          # Format code with Prettier

# Testing
npm run test            # Run unit tests
npm run test:coverage   # Generate coverage report
```

### Mobile

```bash
npm start               # Start Expo dev server
npm run android         # Run on Android emulator
npm run ios            # Run on iOS simulator
npm run web            # Run in browser
npm run lint           # Check code quality
npm run type-check     # TypeScript type checking
```

---

## 🐛 Troubleshooting

### Backend Won't Start

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solution**: PostgreSQL isn't running
```bash
# Start PostgreSQL
docker start school-management-db
# or
brew services start postgresql@15
```

**Error**: `Port 3000 already in use`

**Solution**: Use different port
```bash
PORT=3001 npm run dev
```

### Frontend Won't Start

**Error**: `Module not found: @components/...`

**Solution**: Clear node_modules and reinstall
```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

**Error**: `VITE_API_URL is not defined`

**Solution**: Create `.env` file in frontend directory
```
VITE_API_URL=http://localhost:3000/api
```

### WebSocket Connection Failed

**Error**: `WebSocket connection to ws://localhost:3000 failed`

**Solution**: Check CORS and ensure backend is running
```bash
# Check backend is running
curl http://localhost:3000/health

# Restart backend with correct FRONTEND_URL
FRONTEND_URL=http://localhost:5173 npm run dev
```

### Export Not Working

**Error**: `TypeError: Cannot read property 'exportToPDF'`

**Solution**: Install missing dependencies
```bash
cd backend
npm install pdfkit xlsx csv-stringify
npm run dev
```

### Theme CSS Not Loading

**Error**: `CSS variables not applied`

**Solution**: Import theme CSS in main app
```typescript
// In frontend/src/main.tsx
import './styles/theme.css'
```

---

## 📊 Performance Monitoring

### Check Backend Performance

```bash
# Monitor API response times
curl -w "\n%{time_total}s\n" http://localhost:3000/health

# Test export endpoint
curl -X POST http://localhost:3000/api/v1/export/dashboard/pdf \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dashboardType": "admin"}' \
  -w "\nTime: %{time_total}s\n"
```

### Monitor WebSocket

```javascript
// In browser console
// Check WebSocket latency
const start = Date.now();
socket.on('dashboard-update', () => {
  console.log('WebSocket latency:', Date.now() - start, 'ms');
});
```

### Check React Performance

```bash
# Open DevTools → React DevTools → Profiler
# Record interactions
# Check component render times
```

---

## 🔐 Security Notes for Development

### ⚠️ IMPORTANT

Never commit `.env` file with real credentials:
```bash
# Add to .gitignore
echo ".env" >> .gitignore
echo ".env.local" >> .gitignore
```

For local development only, use weak credentials:
```
JWT_SECRET=dev-secret-only-for-local-testing
DATABASE_PASSWORD=dev-password-only-for-local
```

---

## 📱 Mobile Testing

### Expo Go App (Fastest)

1. Install Expo Go app on your phone
2. Run: `cd mobile && npm start`
3. Scan QR code with Expo Go
4. App loads on your phone

### iOS Simulator (macOS only)

```bash
cd mobile
npm run ios
```

### Android Emulator

```bash
# Install Android Studio first, then:
cd mobile
npm run android
```

### Web Preview

```bash
cd mobile
npm start
# Press 'w' in terminal
# Opens at http://localhost:8081
```

---

## 🧪 Testing Phase 12 Features

### Test Checklist

- [ ] **Real-time Updates**: Dashboard updates without page refresh
- [ ] **Advanced Filters**: Filter by multiple criteria, save presets
- [ ] **Export PDF**: Export dashboard to PDF with charts
- [ ] **Export Excel**: Export to multi-sheet Excel file
- [ ] **Export CSV**: Export to CSV format
- [ ] **Dashboard Builder**: Drag-drop widgets, save layout
- [ ] **Dark Mode**: Toggle between light/dark themes
- [ ] **Theme Persistence**: Refresh page - theme persists
- [ ] **Mobile Auth**: Login works on mobile app
- [ ] **Mobile Navigation**: All 5 tabs accessible
- [ ] **WebSocket**: Real-time updates <100ms latency
- [ ] **API Filter**: Advanced filter endpoint works
- [ ] **Template Save**: Can save export templates
- [ ] **Filter Presets**: Can save and load filter presets
- [ ] **Mobile Screens**: All 8 screens render correctly

---

## 📚 Related Documentation

- **Implementation Details**: `docs/PHASE_12_IMPLEMENTATION_STATUS.md`
- **Integration Guide**: `docs/PHASE_12_NEXT_STEPS.md`
- **Files Manifest**: `docs/PHASE_12_FILES_MANIFEST.md`
- **API Reference**: `docs/PHASE_10_API_DOCUMENTATION.md`

---

## 💡 Tips & Tricks

### Bypass Login During Testing

```typescript
// In frontend/src/lib/apiClient.ts
// Add this for testing
const token = 'test-token-for-development';
localStorage.setItem('token', token);
```

### Check Database State

```bash
# Connect to PostgreSQL
psql postgresql://postgres:postgres@localhost:5432/school_management

# Check tables
\dt

# Check data in users table
SELECT email, role FROM users LIMIT 5;
```

### View API Requests

```bash
# Terminal with backend running
# All requests logged to console

# Or use Postman:
# 1. Open Postman
# 2. Import endpoints from docs/PHASE_10_API_DOCUMENTATION.md
# 3. Create environment variables for URL and token
# 4. Test endpoints
```

### Enable Debug Logging

```bash
# Backend
DEBUG=* npm run dev

# Frontend (in DevTools)
localStorage.setItem('DEBUG', '*');
```

---

## ✨ You're Ready!

```bash
# One-command setup (if databases ready)
cd backend && npm install && npm run dev &
cd frontend && npm install && npm run dev &
# Then visit http://localhost:5173
```

**Happy Testing!** 🎉

Let me know if you encounter any issues!
