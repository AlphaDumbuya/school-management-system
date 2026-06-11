# Complete Setup & Run Guide

## 🎯 What You Need

1. **Node.js 18+** ✓ (You have v22.21.0)
2. **PostgreSQL 12+** (Local or Cloud)
3. **About 10 minutes of time**

## 📍 Current Status

✅ All code dependencies installed  
✅ Environment file created (`.env`)  
✅ Configuration ready

## 🔧 Step-by-Step Setup

### Step 1: Get PostgreSQL (Choose One Option)

#### Option A: Cloud PostgreSQL (Easiest - Recommended)

**Using Neon.tech:**
1. Go to https://neon.tech/
2. Sign up for free
3. Create a new project
4. Click "SQL Editor" on the left
5. Note your connection details

**Or using Render.com:**
1. Go to https://render.com/
2. Sign up with GitHub
3. Dashboard → New → PostgreSQL
4. Copy the internal connection string

#### Option B: Local PostgreSQL (Advanced)

**Windows:**
- Download: https://www.postgresql.org/download/windows/
- Run installer
- Remember your `postgres` password
- Connection: `postgresql://postgres:YOUR_PASSWORD@localhost:5432/school_management`

**macOS:**
```bash
brew install postgresql@16
brew services start postgresql@16
psql postgres -c "CREATE DATABASE school_management;"
```

**Linux (Ubuntu):**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo -u postgres createdb school_management
```

### Step 2: Update `.env` File

Open `.env` in the project root and update your database credentials:

**For Cloud PostgreSQL (Neon/Render):**
```
DATABASE_URL=postgresql://your_username:your_password@hostname.neon.tech/dbname?sslmode=require
DB_HOST=hostname.neon.tech
DB_PORT=5432
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=dbname
```

**For Local PostgreSQL:**
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/school_management
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=school_management
```

### Step 3: Setup Database Tables

```bash
# Run migrations to create all tables
npm run db:migrate

# (Optional) Seed with sample data
npm run db:seed
```

**Expected output:**
```
Running migrations
✓ Migration 001_initial_schema completed
✓ Migration 002_phase4_enrollment_workflows completed
... (more migrations)
```

### Step 4: Start the Application

```bash
npm run dev
```

**You should see:**
```
VITE v4.x.x  ready in 123 ms

➜  Local:   http://localhost:5173/
➜  press h to show help

> backend running on http://localhost:3000
```

### Step 5: Open in Browser

Visit: **http://localhost:5173**

### Step 6: Login

Use demo credentials:
- **Email:** `admin@school.com`
- **Password:** `Demo@123456`

## 🎉 Success!

You should now see the **Admin Dashboard** with:
- 📊 Dashboard metrics
- 👥 Student/Teacher management
- 📋 Classes and enrollment
- 📈 Grades and attendance
- 💰 Fee management
- 📧 Notifications

## 🔗 Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:5173 | School Management UI |
| **Backend API** | http://localhost:3000/api | REST API |
| **API Swagger** | http://localhost:3000/api/docs | API Documentation |

## 🆘 Troubleshooting

### Can't connect to database

**Error:** `connect ECONNREFUSED 127.0.0.1:5432`

**Solution:**
```bash
# Check if PostgreSQL is running (Windows)
Get-Service postgresql-x64-16

# Or check process (Linux/Mac)
ps aux | grep postgres

# Start PostgreSQL if not running
# Windows: Use Services app or PostgreSQL installer
# Mac: brew services start postgresql@16
# Linux: sudo service postgresql start
```

### Port 3000 already in use

```bash
# Kill the process using port 3000
lsof -i :3000  # Mac/Linux
# Then: kill -9 <PID>

netstat -ano | findstr :3000  # Windows
# Then: taskkill /PID <PID> /F
```

### "JWT_SECRET not set" error

- Make sure `.env` file exists in project root
- Verify it has all required variables (copy from `.env.example` if needed)

### Frontend can't reach backend

**Error:** API connection failed or CORS error

**Solution:**
1. Verify backend is running: `npm run dev` shows "backend running on http://localhost:3000"
2. Check `.env` has correct `REACT_APP_API_URL=http://localhost:3000/api`
3. Clear browser cache: `Ctrl+Shift+Delete` or `Cmd+Shift+Delete`
4. Restart frontend: `Ctrl+C` then `npm run dev` again

### Migrations fail

**Error:** `Error: connect ECONNREFUSED`

**Solution:**
1. Check DATABASE_URL in `.env` is correct
2. Verify PostgreSQL is running and accessible
3. Test connection manually:
   ```bash
   psql "postgresql://user:password@host:port/dbname"
   ```

### Can't find module errors

```bash
# Reinstall all dependencies
npm install
npm install -w backend
npm install -w frontend

# Then start again
npm run dev
```

## 📚 Next Steps

1. **Explore the Admin Dashboard**
   - View students and classes
   - Check grade management
   - Review attendance records

2. **Configure Email Service (Optional)**
   - Sign up at https://brevo.com/
   - Get API key
   - Add to `.env`: `BREVO_API_KEY=...`
   - Enable in `.env`: `ENABLE_EMAIL_SERVICE=true`

3. **Configure File Uploads (Optional)**
   - Sign up at https://uploadthing.com/
   - Get API credentials
   - Add to `.env`
   - Enable file upload features

4. **Create Test Data**
   - Add new students/teachers
   - Create classes and enrollment
   - Add grades and attendance
   - Generate reports

## 🚀 Production Deployment

When ready to deploy:

1. **Database:** Use managed PostgreSQL (Neon, Railway, Render)
2. **Backend:** Deploy to Railway, Render, or Fly.io
3. **Frontend:** Deploy to Vercel or Netlify
4. **Email:** Configure Brevo for production
5. **Files:** Use AWS S3 or UploadThing

See [infrastructure-deployment.md](.kiro/specs/school-management-system/infrastructure-deployment.md) for details.

## 📞 Support Resources

- **Documentation:** See `docs/` folder
- **Specifications:** See `.kiro/specs/school-management-system/`
- **API Docs:** Run `npm run dev` and visit `http://localhost:3000/api/docs`

---

**You're all set! 🎉 Enjoy using the School Management System!**
