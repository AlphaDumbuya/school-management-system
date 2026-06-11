# Quick Start Guide - School Management System

This guide walks you through setting up and running the School Management System locally.

## 📋 Prerequisites

- **Node.js 18+** (you have v22.21.0 ✓)
- **npm 9+** (you have v10.9.4 ✓)
- **PostgreSQL 12+** (local OR free cloud service)
- **Optional:** Redis, RabbitMQ (for caching and message queues)

## 🚀 Quick Setup (5 minutes)

### Step 1: Choose Your Database

#### Option A: Free Cloud PostgreSQL (Recommended - No installation needed)

**Using Neon.tech (Easiest):**
1. Go to https://neon.tech/
2. Click "Sign Up" and create a free account
3. Create a new project
4. Copy the connection string from the "Connection details" section
5. It looks like: `postgresql://user:password@host/dbname?sslmode=require`

**Using Render.com:**
1. Go to https://render.com/
2. Sign up and go to Dashboard
3. Create New → PostgreSQL
4. Copy the connection string provided

**Using Railway.app:**
1. Go to https://railway.app/
2. Sign up with GitHub
3. Create New Project → Add PostgreSQL
4. Copy the DATABASE_URL from the Variables tab

#### Option B: Local PostgreSQL (Requires Installation)

**On Windows:**
- Download from https://www.postgresql.org/download/windows/
- During installation, remember the password you set for `postgres` user
- Connection string: `postgresql://postgres:YOUR_PASSWORD@localhost:5432/school_management`

**On macOS (using Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
createdb school_management
```

**On Linux (Ubuntu/Debian):**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo -u postgres createdb school_management
```

### Step 2: Configure Environment

1. **Update your `.env` file** in the project root:

```bash
# If using Neon/Render/Railway - paste your connection string:
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# If using local PostgreSQL with default credentials:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/school_management
```

2. **Generate secure JWT secrets** for production (optional for dev):
```bash
# Generate random secrets (paste these into .env):
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Step 3: Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
npm install -w backend

# Install frontend dependencies
npm install -w frontend
```

### Step 4: Setup Database

```bash
# Run database migrations
npm run db:migrate

# Seed database with sample data (optional)
npm run db:seed
```

### Step 5: Start the Application

```bash
# Start both backend and frontend
npm run dev
```

You should see:
- **Frontend** running on: http://localhost:5173
- **Backend** running on: http://localhost:3000
- **API** available at: http://localhost:3000/api

### Step 6: Login to the Application

Use the demo credentials from `.env.example` or the seeded data:

```
Email: admin@school.com
Password: Demo@123456
```

## 🔧 Detailed Setup Instructions

### Setting Up PostgreSQL on Windows

1. **Download PostgreSQL 16:**
   - Visit https://www.postgresql.org/download/windows/
   - Click "Download the installer"

2. **Install PostgreSQL:**
   - Run the installer
   - Choose installation directory (default is fine)
   - Set password for `postgres` user (remember this!)
   - Port: 5432 (default)
   - Locale: Your system locale
   - Complete installation

3. **Verify installation:**
   ```bash
   psql --version
   psql -U postgres -c "SELECT version();"
   ```

4. **Create database:**
   ```bash
   psql -U postgres -c "CREATE DATABASE school_management;"
   ```

5. **Update `.env`:**
   ```
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/school_management
   ```

### Setting Up Neon (Cloud - Recommended)

1. **Create account and project:**
   - Go to https://neon.tech/
   - Click "Sign Up"
   - Create a project named "school-management"

2. **Get connection string:**
   - In dashboard, go to "SQL Editor"
   - Click on the database name
   - Copy the connection string from "Connection details"

3. **Update `.env`:**
   ```
   DATABASE_URL=postgresql://user:password@hostname/dbname?sslmode=require
   ```

4. **That's it!** Your database is ready in the cloud

### Optional: Setup Redis for Caching

**Using Docker (Easiest):**
```bash
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

**Or using Redis Cloud (Free):**
1. Go to https://redis.com/try-free/
2. Create a free account
3. Get the connection string
4. Update `.env`:
   ```
   REDIS_URL=redis://username:password@hostname:port
   ```

### Optional: Setup RabbitMQ for Message Queue

**Using Docker:**
```bash
docker run -d -p 5672:5672 -p 15672:15672 --name rabbitmq rabbitmq:4-management
# Management interface: http://localhost:15672 (guest/guest)
```

**Or using CloudAMQP (Free):**
1. Go to https://www.cloudamqp.com/
2. Create a free plan
3. Get the connection string
4. Update `.env`:
   ```
   RABBITMQ_URL=amqp://user:password@hostname/vhost
   ```

## 📱 Access Points

After starting with `npm run dev`:

- **Frontend UI**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **API Docs**: http://localhost:3000/api/docs (if Swagger enabled)
- **RabbitMQ Manager**: http://localhost:15672 (if using Docker)

## 🆘 Troubleshooting

### "Cannot connect to database"
- Check DATABASE_URL in `.env`
- Verify PostgreSQL is running (local) or accessible (cloud)
- Test connection:
  ```bash
  psql "postgresql://user:password@host/dbname"
  ```

### "Port 3000 is already in use"
```bash
# Kill the process using port 3000:
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows
```

### "Cannot find module 'xyz'"
```bash
# Reinstall dependencies:
npm install
npm install -w backend
npm install -w frontend
```

### "JWT_SECRET not set"
- Your `.env` file doesn't have JWT secrets
- Copy from `.env.example` and update with your values

### Frontend can't reach backend API
- Verify backend is running on port 3000
- Check CORS settings in `.env`
- Check browser console for error messages
- Verify REACT_APP_API_URL in `.env`

## 🚀 Production Deployment

For production, use:
- **Database**: Neon, Railway, or Render (managed PostgreSQL)
- **Redis**: Redis Cloud or AWS ElastiCache
- **RabbitMQ**: CloudAMQP or AWS MQ
- **Backend**: Railway, Render, Fly.io, or AWS
- **Frontend**: Vercel, Netlify, or AWS S3 + CloudFront

See [infrastructure-deployment.md](.kiro/specs/school-management-system/infrastructure-deployment.md) for detailed production setup.

## 📚 Next Steps

1. ✅ Database configured
2. ✅ Application started
3. 🔄 **Next:** Explore the admin dashboard
4. 🔄 Create test users and data
5. 🔄 Configure email service (Brevo) for notifications
6. 🔄 Setup file uploads (UploadThing)

## 🤝 Need Help?

- Check [LOCAL_SETUP_GUIDE.md](./LOCAL_SETUP_GUIDE.md) for detailed instructions
- Review [ENVIRONMENT_CONFIGURATION_GUIDE.md](./ENVIRONMENT_CONFIGURATION_GUIDE.md) for all config options
- See specifications in [.kiro/specs/](./.kiro/specs/)

---

**Congratulations! Your School Management System is ready to run! 🎉**
