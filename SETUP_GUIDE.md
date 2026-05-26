# School Management System - Complete Setup Guide

## Overview

This guide walks you through setting up the School Management System from scratch. The system is built with Node.js/Express backend, React frontend, PostgreSQL database, with Docker containerization.

## Prerequisites

- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **Docker**: Latest version (for containerized development)
- **Docker Compose**: Latest version (for multi-service orchestration)
- **Git**: For version control
- **PostgreSQL**: 16+ (if running locally without Docker)

## Phase 1: Project Setup and Infrastructure

### Step 1: Clone and Initialize Repository

```bash
# Clone the repository
git clone <repository-url>
cd school-management-system

# Initialize Git (if not already done)
git init

# Verify Git is initialized
git status
```

### Step 2: Install Dependencies

```bash
# Install root workspace dependencies
npm install

# Install backend dependencies
npm install -w backend

# Install frontend dependencies
npm install -w frontend
```

### Step 3: Configure Environment Variables

```bash
# Copy Docker environment file
cp .env.docker .env

# Edit .env with your credentials
# Required external services:
# - BREVO_API_KEY (email service)
# - UPLOADTHING_API_KEY (file uploads)
# - UPLOADTHING_APP_ID
# - UPLOADTHING_SECRET
```

### Step 4: Build Docker Images

```bash
# Build all Docker images
npm run docker:build

# Verify images were built
docker images | grep sms
```

### Step 5: Start Services

```bash
# Start all services in background
npm run docker:up

# Verify services are running
docker-compose ps

# View logs
npm run docker:logs
```

### Step 6: Run Database Migrations

```bash
# Run migrations inside container
docker exec sms-backend npm run db:migrate

# Verify migrations completed
docker exec sms-postgres psql -U sms_user -d school_management -c "\dt"
```

### Step 7: Seed Database

```bash
# Seed initial data
docker exec sms-backend npm run db:seed

# Verify data was seeded
docker exec sms-postgres psql -U sms_user -d school_management -c "SELECT COUNT(*) FROM users;"
```

### Step 8: Verify Setup

```bash
# Check all services are healthy
docker-compose ps

# Test backend API
curl http://localhost:3000/health

# Test frontend
open http://localhost

# Test RabbitMQ Management UI
open http://localhost:15672  # guest/guest

# Test pgAdmin (optional)
open http://localhost:5050   # admin@example.com/admin
```

## Local Development (Without Docker)

### Step 1: Install PostgreSQL

```bash
# macOS
brew install postgresql@16

# Ubuntu/Debian
sudo apt-get install postgresql-16

# Windows
# Download from https://www.postgresql.org/download/windows/
```

### Step 2: Create Database

```bash
# Create database and user
createdb school_management
createuser sms_user -P  # Enter password: sms_password

# Grant privileges
psql -d school_management -c "GRANT ALL PRIVILEGES ON DATABASE school_management TO sms_user;"
```

### Step 3: Configure Environment

```bash
# Copy example environment
cp .env.example .env

# Update .env with local database URL
DATABASE_URL=postgresql://sms_user:sms_password@localhost:5432/school_management
```

### Step 4: Run Migrations

```bash
# Run database migrations
npm run db:migrate

# Verify schema
npm run db:migrate -- --list
```

### Step 5: Seed Database

```bash
# Seed initial data
npm run db:seed
```

### Step 6: Start Development Servers

```bash
# Terminal 1: Start backend
npm run dev -w backend

# Terminal 2: Start frontend
npm run dev -w frontend

# Access applications
# Frontend: http://localhost:5173
# Backend: http://localhost:3000
```

## Demo Credentials

After seeding, use these credentials to log in:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@school.com | Demo@123456 |
| Principal | principal@school.com | Demo@123456 |
| Teacher | teacher1@school.com | Demo@123456 |
| Student | student1@school.com | Demo@123456 |
| Parent | parent@school.com | Demo@123456 |
| Accountant | accountant@school.com | Demo@123456 |

## Troubleshooting

### Docker Issues

```bash
# Check Docker daemon
docker ps

# View detailed logs
docker-compose logs -f

# Rebuild images
npm run docker:build

# Reset everything
npm run docker:reset
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
docker exec sms-postgres psql -U sms_user -d school_management -c "SELECT 1;"

# Check connection string
echo $DATABASE_URL

# Verify database exists
docker exec sms-postgres psql -U sms_user -l
```

### Port Conflicts

If ports are already in use:

1. Find process using port:
   ```bash
   # macOS/Linux
   lsof -i :3000
   
   # Windows
   netstat -ano | findstr :3000
   ```

2. Kill process or change port in docker-compose.yml

### Redis Connection Issues

```bash
# Test Redis
docker exec sms-redis redis-cli -a redis_password ping

# Should return: PONG
```

### RabbitMQ Issues

```bash
# Check RabbitMQ status
docker exec sms-rabbitmq rabbitmq-diagnostics -q ping

# View management UI
# http://localhost:15672
```

## Next Steps

After successful setup:

1. **Review Specification**: Read `.kiro/specs/school-management-system/requirements.md`
2. **Understand Architecture**: Review `.kiro/specs/school-management-system/design.md`
3. **Check Database Schema**: Review `.kiro/specs/school-management-system/database-schema.md`
4. **Review API Spec**: Review `.kiro/specs/school-management-system/api-specification.md`
5. **Start Development**: Follow `.kiro/specs/school-management-system/tasks.md` Phase 2

## Development Workflow

### Making Code Changes

```bash
# Backend changes (with hot reload)
# Edit files in backend/src/
# Changes automatically reload in development

# Frontend changes (with hot reload)
# Edit files in frontend/src/
# Changes automatically reload in development
```

### Running Tests

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test -- backend/src/services/authService.test.ts
```

### Linting and Formatting

```bash
# Lint all code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Database Operations

```bash
# Create new migration
npm run db:migrate -- --make create_new_table

# Rollback last migration
npm run db:migrate -- --rollback

# Seed database
npm run db:seed

# Reset database
npm run docker:reset
```

## Project Structure

```
school-management-system/
├── backend/                          # Node.js/Express API
│   ├── src/
│   │   ├── index.ts                 # Entry point
│   │   ├── middleware/              # Express middleware
│   │   ├── services/                # Business logic
│   │   ├── types/                   # TypeScript types
│   │   ├── utils/                   # Utilities
│   │   └── database/
│   │       ├── migrations/          # Database migrations
│   │       └── seeds/               # Database seeds
│   ├── Dockerfile                   # Backend container
│   ├── knexfile.ts                  # Database config
│   ├── tsconfig.json                # TypeScript config
│   └── package.json
│
├── frontend/                         # React application
│   ├── src/
│   │   ├── main.tsx                 # Entry point
│   │   ├── components/              # React components
│   │   ├── pages/                   # Page components
│   │   ├── hooks/                   # Custom hooks
│   │   ├── services/                # API services
│   │   ├── store/                   # State management
│   │   └── types/                   # TypeScript types
│   ├── Dockerfile                   # Frontend container
│   ├── nginx.conf                   # Nginx config
│   ├── vite.config.ts               # Vite config
│   ├── tsconfig.json                # TypeScript config
│   └── package.json
│
├── .kiro/
│   └── specs/
│       └── school-management-system/  # Specification documents
│
├── docker-compose.yml               # Docker services
├── .env.example                     # Example environment
├── .env.docker                      # Docker environment
├── .gitignore                       # Git ignore rules
├── package.json                     # Root workspace
├── SETUP_GUIDE.md                   # This file
├── DOCKER_SETUP.md                  # Docker guide
└── README.md                        # Project overview
```

## Important Files

- **requirements.md**: Business requirements and acceptance criteria
- **design.md**: Technical architecture and design decisions
- **database-schema.md**: Database structure and relationships
- **api-specification.md**: REST API endpoints and contracts
- **infrastructure-deployment.md**: Deployment and infrastructure setup
- **security-compliance.md**: Security requirements and compliance
- **testing-strategy.md**: Testing approach and coverage targets
- **tasks.md**: Implementation tasks organized by phase

## Support and Documentation

- **Docker Documentation**: https://docs.docker.com/
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **Express.js Documentation**: https://expressjs.com/
- **React Documentation**: https://react.dev/
- **Specification Files**: `.kiro/specs/school-management-system/`

## Common Commands Reference

```bash
# Development
npm run dev                          # Start all dev servers
npm run build                        # Build all projects
npm run test                         # Run all tests
npm run lint                         # Lint all code
npm run format                       # Format all code

# Docker
npm run docker:build                 # Build Docker images
npm run docker:up                    # Start services
npm run docker:down                  # Stop services
npm run docker:logs                  # View logs
npm run docker:reset                 # Reset everything

# Database
npm run db:migrate                   # Run migrations
npm run db:seed                      # Seed database

# Workspace
npm install -w backend               # Install backend deps
npm install -w frontend              # Install frontend deps
npm run lint -w backend              # Lint backend
npm run test -w frontend             # Test frontend
```

## Next Phase: Authentication and Authorization

Once Phase 1 is complete, proceed to Phase 2:

1. Implement JWT-based authentication
2. Implement password management
3. Implement role-based access control (RBAC)
4. Implement permission-based authorization
5. Implement user account management

See `tasks.md` Phase 2 for detailed tasks.
