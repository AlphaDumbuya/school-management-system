# School Management System - Implementation Guide

## Phase 1: Project Setup and Infrastructure (Weeks 1-2)

This guide walks through setting up the School Management System project from scratch.

---

## Step 1: External Services Setup (Day 1)

### 1.1 Brevo Email Service Setup

**Time Estimate**: 30 minutes

1. **Create Brevo Account**
   - Go to https://www.brevo.com/
   - Click "Sign Up"
   - Enter email and create account
   - Verify email address
   - Complete account setup

2. **Generate API Key**
   - Log in to Brevo dashboard
   - Go to Settings → SMTP & API
   - Click "Create a new API key"
   - Name it: "School Management System"
   - Copy the API key (you'll need this)
   - Store securely in password manager

3. **Configure Sender Identity**
   - Go to Senders & Contacts → Senders
   - Click "Add a sender"
   - Enter sender name: "School Management System"
   - Enter sender email: noreply@yourdomain.com (or use default)
   - Verify email address
   - Wait for verification (usually instant)

4. **Create Email Templates**
   - Go to Templates → Email Templates
   - Create templates for:
     - **Password Reset**: Subject "Reset Your Password", include reset link
     - **Enrollment Confirmation**: Subject "Welcome to [School Name]", include enrollment details
     - **Payment Receipt**: Subject "Payment Received", include receipt details
     - **Grade Notification**: Subject "Your Grades Are Ready", include grade summary
     - **Attendance Alert**: Subject "Attendance Alert", include attendance details
     - **Schedule Change**: Subject "Schedule Updated", include new schedule
     - **Fee Reminder**: Subject "Fee Payment Due", include due date and amount
     - **Admission Letter**: Subject "Admission Offer", include admission details

5. **Test Email Sending**
   - Use Brevo's test email feature
   - Send test email to your email address
   - Verify email is received

**Environment Variables to Add**:
```
BREVO_API_KEY=your_api_key_here
BREVO_SENDER_EMAIL=noreply@yourdomain.com
BREVO_SENDER_NAME=School Management System
```

---

### 1.2 UploadThing File Upload Setup

**Time Estimate**: 30 minutes

1. **Create UploadThing Account**
   - Go to https://uploadthing.com/
   - Click "Sign Up"
   - Choose GitHub or Google authentication
   - Complete account setup

2. **Create New App**
   - Click "Create New App"
   - Name it: "School Management System"
   - Select your region
   - Click "Create"

3. **Generate API Keys**
   - Go to Settings → API Keys
   - Copy API Key
   - Copy App ID
   - Copy Secret
   - Store all securely in password manager

4. **Configure File Upload Routes**
   - Go to File Routes
   - Create file route for documents:
     - Name: "documents"
     - Allowed file types: PDF, DOC, DOCX
     - Max file size: 10MB
   - Create file route for images:
     - Name: "images"
     - Allowed file types: JPG, PNG, GIF, WEBP
     - Max file size: 5MB
   - Create file route for certificates:
     - Name: "certificates"
     - Allowed file types: PDF
     - Max file size: 5MB

5. **Test File Upload**
   - Use UploadThing's test interface
   - Upload a test file
   - Verify file is stored and retrievable

**Environment Variables to Add**:
```
UPLOADTHING_API_KEY=your_api_key_here
UPLOADTHING_APP_ID=your_app_id_here
UPLOADTHING_SECRET=your_secret_here
```

---

### 1.3 Neon PostgreSQL Database Setup

**Time Estimate**: 30 minutes

1. **Create Neon Account**
   - Go to https://neon.tech/
   - Click "Sign Up"
   - Choose GitHub or Google authentication
   - Complete account setup

2. **Create New Project**
   - Click "Create New Project"
   - Name it: "School Management System"
   - Select region closest to your location
   - Click "Create"

3. **Create Database and User**
   - Go to SQL Editor
   - Create database:
     ```sql
     CREATE DATABASE school_management;
     ```
   - Create user:
     ```sql
     CREATE USER school_admin WITH PASSWORD 'strong_password_here';
     GRANT ALL PRIVILEGES ON DATABASE school_management TO school_admin;
     ```

4. **Configure Connection Pool**
   - Go to Connection Pooling
   - Enable PgBouncer
   - Set pool size: 20
   - Set idle timeout: 5 minutes

5. **Get Connection String**
   - Go to Connection Details
   - Copy connection string
   - Format: `postgresql://user:password@host/database`
   - Store securely

6. **Enable Automated Backups**
   - Go to Backups
   - Verify backups are enabled (default: daily)
   - Set retention: 7 days

7. **Test Database Connection**
   - Use psql or any PostgreSQL client
   - Test connection with provided connection string
   - Verify you can connect

**Environment Variables to Add**:
```
DATABASE_URL=postgresql://school_admin:password@host/school_management
DATABASE_POOL_SIZE=20
DATABASE_IDLE_TIMEOUT=300000
DATABASE_CONNECTION_TIMEOUT=30000
```

---

## Step 2: Project Repository Setup (Day 1-2)

### 2.1 Create GitHub Repository

**Time Estimate**: 30 minutes

1. **Create Repository**
   - Go to https://github.com/new
   - Repository name: `school-management-system`
   - Description: "Multi-tenant school management platform"
   - Visibility: Private
   - Initialize with README.md
   - Add .gitignore: Node.js
   - Add license: MIT
   - Click "Create repository"

2. **Clone Repository**
   ```bash
   git clone https://github.com/yourusername/school-management-system.git
   cd school-management-system
   ```

3. **Set Up Branch Protection**
   - Go to Settings → Branches
   - Add rule for `main` branch
   - Require pull request reviews: 2
   - Require status checks to pass
   - Require branches to be up to date
   - Dismiss stale pull request approvals

---

### 2.2 Set Up Monorepo Structure

**Time Estimate**: 1 hour

1. **Create Directory Structure**
   ```bash
   mkdir -p backend frontend services shared docs
   ```

2. **Create Root package.json**
   ```bash
   npm init -y
   ```

3. **Configure npm Workspaces**
   Edit `package.json`:
   ```json
   {
     "name": "school-management-system",
     "version": "1.0.0",
     "description": "Multi-tenant school management platform",
     "private": true,
     "workspaces": [
       "backend",
       "frontend",
       "services",
       "shared"
     ],
     "scripts": {
       "dev": "npm run dev --workspaces",
       "build": "npm run build --workspaces",
       "test": "npm run test --workspaces",
       "lint": "npm run lint --workspaces"
     }
   }
   ```

4. **Create .gitignore**
   ```
   # Dependencies
   node_modules/
   package-lock.json
   yarn.lock

   # Environment
   .env
   .env.local
   .env.*.local

   # IDE
   .vscode/
   .idea/
   *.swp
   *.swo

   # OS
   .DS_Store
   Thumbs.db

   # Build
   dist/
   build/
   .next/

   # Logs
   logs/
   *.log
   npm-debug.log*
   ```

5. **Create .nvmrc**
   ```
   18.17.0
   ```

6. **Create .env.example**
   ```
   # External Services
   BREVO_API_KEY=your_api_key_here
   BREVO_SENDER_EMAIL=noreply@yourdomain.com
   BREVO_SENDER_NAME=School Management System

   UPLOADTHING_API_KEY=your_api_key_here
   UPLOADTHING_APP_ID=your_app_id_here
   UPLOADTHING_SECRET=your_secret_here

   DATABASE_URL=postgresql://user:password@host/database
   DATABASE_POOL_SIZE=20
   DATABASE_IDLE_TIMEOUT=300000
   DATABASE_CONNECTION_TIMEOUT=30000

   # Backend
   NODE_ENV=development
   PORT=3000
   JWT_SECRET=your_jwt_secret_here
   JWT_EXPIRY=30m

   # Frontend
   REACT_APP_API_URL=http://localhost:3000/api
   ```

---

### 2.3 Set Up Development Tools

**Time Estimate**: 1.5 hours

1. **Install Node.js**
   ```bash
   # Using nvm (recommended)
   nvm install 18.17.0
   nvm use 18.17.0
   ```

2. **Install ESLint and Prettier**
   ```bash
   npm install --save-dev eslint prettier eslint-config-prettier eslint-plugin-prettier
   ```

3. **Create .eslintrc.json**
   ```json
   {
     "env": {
       "node": true,
       "es2021": true
     },
     "extends": ["eslint:recommended", "prettier"],
     "parserOptions": {
       "ecmaVersion": "latest",
       "sourceType": "module"
     },
     "rules": {
       "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
       "no-console": ["warn", { "allow": ["warn", "error"] }]
     }
   }
   ```

4. **Create .prettierrc**
   ```json
   {
     "semi": true,
     "trailingComma": "es5",
     "singleQuote": true,
     "printWidth": 100,
     "tabWidth": 2
   }
   ```

5. **Install TypeScript**
   ```bash
   npm install --save-dev typescript @types/node
   ```

6. **Create tsconfig.json**
   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "module": "commonjs",
       "lib": ["ES2020"],
       "outDir": "./dist",
       "rootDir": "./src",
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true,
       "forceConsistentCasingInFileNames": true,
       "resolveJsonModule": true,
       "declaration": true,
       "declarationMap": true,
       "sourceMap": true,
       "baseUrl": ".",
       "paths": {
         "@backend/*": ["backend/src/*"],
         "@frontend/*": ["frontend/src/*"],
         "@shared/*": ["shared/src/*"]
       }
     },
     "include": ["src/**/*"],
     "exclude": ["node_modules", "dist"]
   }
   ```

7. **Install Husky for Git Hooks**
   ```bash
   npm install --save-dev husky
   npx husky install
   npx husky add .husky/pre-commit "npm run lint"
   npx husky add .husky/pre-push "npm run test"
   ```

---

### 2.4 Set Up Docker

**Time Estimate**: 1 hour

1. **Create Dockerfile for Backend**
   Create `backend/Dockerfile`:
   ```dockerfile
   FROM node:18-alpine AS builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build

   FROM node:18-alpine
   WORKDIR /app
   COPY --from=builder /app/dist ./dist
   COPY --from=builder /app/node_modules ./node_modules
   COPY package*.json ./
   EXPOSE 3000
   HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
     CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"
   CMD ["node", "dist/index.js"]
   ```

2. **Create Dockerfile for Frontend**
   Create `frontend/Dockerfile`:
   ```dockerfile
   FROM node:18-alpine AS builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build

   FROM nginx:alpine
   COPY --from=builder /app/dist /usr/share/nginx/html
   COPY nginx.conf /etc/nginx/conf.d/default.conf
   EXPOSE 80
   CMD ["nginx", "-g", "daemon off;"]
   ```

3. **Create docker-compose.yml**
   ```yaml
   version: '3.8'

   services:
     postgres:
       image: postgres:15-alpine
       environment:
         POSTGRES_DB: school_management
         POSTGRES_USER: school_admin
         POSTGRES_PASSWORD: dev_password
       ports:
         - "5432:5432"
       volumes:
         - postgres_data:/var/lib/postgresql/data

     redis:
       image: redis:7-alpine
       ports:
         - "6379:6379"

     rabbitmq:
       image: rabbitmq:3.12-management-alpine
       environment:
         RABBITMQ_DEFAULT_USER: guest
         RABBITMQ_DEFAULT_PASS: guest
       ports:
         - "5672:5672"
         - "15672:15672"

     backend:
       build: ./backend
       environment:
         NODE_ENV: development
         DATABASE_URL: postgresql://school_admin:dev_password@postgres:5432/school_management
         REDIS_URL: redis://redis:6379
         RABBITMQ_URL: amqp://guest:guest@rabbitmq:5672
       ports:
         - "3000:3000"
       depends_on:
         - postgres
         - redis
         - rabbitmq
       volumes:
         - ./backend/src:/app/src

     frontend:
       build: ./frontend
       ports:
         - "3001:80"
       depends_on:
         - backend

   volumes:
     postgres_data:
   ```

4. **Start Services**
   ```bash
   docker-compose up -d
   ```

---

## Step 3: Initial Commit

**Time Estimate**: 30 minutes

1. **Stage Files**
   ```bash
   git add .
   ```

2. **Create Initial Commit**
   ```bash
   git commit -m "Initial project setup with monorepo structure, external services configuration, and Docker setup"
   ```

3. **Push to GitHub**
   ```bash
   git push -u origin main
   ```

---

## Checklist for Phase 1 Completion

- [ ] Brevo account created and API key stored
- [ ] UploadThing account created and API keys stored
- [ ] Neon PostgreSQL account created and connection string stored
- [ ] GitHub repository created and cloned
- [ ] Monorepo structure set up
- [ ] npm workspaces configured
- [ ] .gitignore created
- [ ] .env.example created with all variables
- [ ] ESLint and Prettier configured
- [ ] TypeScript configured
- [ ] Husky git hooks installed
- [ ] Docker and docker-compose configured
- [ ] All services running successfully
- [ ] Initial commit pushed to GitHub
- [ ] Branch protection rules configured

---

## Next Steps

Once Phase 1 is complete:
1. Move to Phase 2: Database Design and Implementation
2. Create database schema using Neon
3. Set up database migrations
4. Implement Row-Level Security (RLS)

---

## Troubleshooting

### Docker Services Won't Start
- Check Docker is running: `docker --version`
- Check ports are available: `lsof -i :5432` (for PostgreSQL)
- View logs: `docker-compose logs [service_name]`

### Database Connection Issues
- Verify connection string in .env
- Check Neon dashboard for connection details
- Test connection: `psql [connection_string]`

### npm Workspace Issues
- Clear node_modules: `rm -rf node_modules && npm install`
- Check package.json workspaces configuration
- Verify all workspace package.json files exist

### Git Hook Issues
- Reinstall Husky: `npx husky install`
- Check hook files in .husky directory
- Make hooks executable: `chmod +x .husky/*`

---

## Support

For issues with external services:
- **Brevo**: https://www.brevo.com/support/
- **UploadThing**: https://docs.uploadthing.com/
- **Neon**: https://neon.tech/docs/

For general development questions:
- Check project documentation in `/docs`
- Review specification files in `.kiro/specs/`
- Ask team members for guidance
