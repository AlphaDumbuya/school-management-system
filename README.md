# School Management System

A comprehensive, production-ready school management platform built with modern web technologies. Multi-tenant, scalable, and designed for educational institutions of all sizes.

## 🎯 Overview

The School Management System is a complete solution for managing all aspects of a school's operations including:

- **Student Management**: Enrollment, records, and tracking
- **Academic Management**: Grades, attendance, and schedules
- **Fee Management**: Billing, payments, and financial tracking
- **Teacher Management**: Assignments, qualifications, and schedules
- **Reporting & Analytics**: Comprehensive reports and insights
- **Notifications**: Email, SMS, and in-app notifications
- **User Management**: Role-based access control and permissions
- **Audit & Compliance**: Complete audit trails and compliance tracking

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Git

### Setup (5 minutes)

```bash
# Clone repository
git clone <repository-url>
cd school-management-system

# Install dependencies
npm install

# Configure environment
cp .env.docker .env

# Build and start
npm run docker:build
npm run docker:up

# Run migrations and seed
docker exec sms-backend npm run db:migrate
docker exec sms-backend npm run db:seed
```

### Access Applications

- **Frontend**: http://localhost
- **Backend API**: http://localhost:3000/api
- **RabbitMQ**: http://localhost:15672 (guest/guest)
- **pgAdmin**: http://localhost:5050 (admin@example.com/admin)

### Demo Credentials

```
Email: admin@school.com
Password: Demo@123456
```

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed setup instructions.

## 📋 Features

### Core Features
- ✅ Multi-tenant architecture
- ✅ Role-based access control (RBAC)
- ✅ Student enrollment and management
- ✅ Grade management and reporting
- ✅ Attendance tracking
- ✅ Class scheduling
- ✅ Fee management and billing
- ✅ Teacher management and assignments
- ✅ Comprehensive reporting
- ✅ Notification system (Email, SMS, In-app)

### Technical Features
- ✅ RESTful API with OpenAPI documentation
- ✅ Real-time notifications with WebSockets
- ✅ Caching with Redis
- ✅ Message queue with RabbitMQ
- ✅ Comprehensive audit logging
- ✅ Data encryption at rest
- ✅ HTTPS/TLS support
- ✅ Rate limiting and DDoS protection
- ✅ Automated backups
- ✅ Disaster recovery procedures

### Security Features
- ✅ JWT-based authentication
- ✅ Password hashing with bcrypt
- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ CSRF protection
- ✅ Rate limiting
- ✅ IP-based access controls
- ✅ Audit logging for all operations
- ✅ Data encryption
- ✅ GDPR/FERPA/CCPA compliance

## 🏗️ Architecture

### Technology Stack

**Backend**
- Node.js 20 with Express.js
- TypeScript for type safety
- PostgreSQL 16 for data storage
- Redis for caching
- RabbitMQ for message queuing
- Winston for logging

**Frontend**
- React 18 with TypeScript
- Vite for fast development
- TanStack Query for data fetching
- Zustand for state management
- Tailwind CSS for styling
- React Router for navigation

**Infrastructure**
- Docker for containerization
- Docker Compose for orchestration
- Nginx for reverse proxy
- PostgreSQL for database
- Redis for caching
- RabbitMQ for messaging

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│              http://localhost (Nginx)                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Backend API (Express)                   │
│              http://localhost:3000                       │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Authentication │ Authorization │ Business Logic │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
    ┌────────┐  ┌────────┐  ┌──────────┐
    │  PostgreSQL  │  Redis   │ RabbitMQ │
    │  Database    │  Cache   │  Queue   │
    └────────┘  └────────┘  └──────────┘
```

## 📁 Project Structure

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
│   ├── Dockerfile
│   ├── knexfile.ts
│   ├── tsconfig.json
│   └── package.json
│
├── frontend/                         # React application
│   ├── src/
│   │   ├── main.tsx
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── store/
│   │   └── types/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── .kiro/
│   └── specs/
│       └── school-management-system/  # Specification documents
│
├── docker-compose.yml
├── .env.example
├── .env.docker
├── .gitignore
├── package.json
├── SETUP_GUIDE.md
├── DOCKER_SETUP.md
├── IMPLEMENTATION_STATUS.md
└── README.md
```

## 📚 Documentation

- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - Complete setup and installation guide
- **[DOCKER_SETUP.md](DOCKER_SETUP.md)** - Docker and containerization guide
- **[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)** - Current implementation status
- **[.kiro/specs/school-management-system/requirements.md](.kiro/specs/school-management-system/requirements.md)** - Business requirements
- **[.kiro/specs/school-management-system/design.md](.kiro/specs/school-management-system/design.md)** - Technical design
- **[.kiro/specs/school-management-system/api-specification.md](.kiro/specs/school-management-system/api-specification.md)** - API documentation
- **[.kiro/specs/school-management-system/database-schema.md](.kiro/specs/school-management-system/database-schema.md)** - Database schema
- **[.kiro/specs/school-management-system/tasks.md](.kiro/specs/school-management-system/tasks.md)** - Implementation tasks

## 🔧 Development

### Local Development (without Docker)

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Start backend
npm run dev -w backend

# Start frontend (in another terminal)
npm run dev -w frontend
```

### Docker Development

```bash
# Build images
npm run docker:build

# Start services
npm run docker:up

# View logs
npm run docker:logs

# Stop services
npm run docker:down
```

### Common Commands

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
```

## 🧪 Testing

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run specific test
npm run test -- backend/src/services/authService.test.ts

# Watch mode
npm run test -- --watch
```

## 📊 Database

### Migrations

```bash
# Run migrations
npm run db:migrate

# Create new migration
npm run db:migrate -- --make create_new_table

# Rollback
npm run db:migrate -- --rollback
```

### Seeding

```bash
# Seed database
npm run db:seed
```

### Access Database

```bash
# Using psql
psql -h localhost -U sms_user -d school_management

# Using pgAdmin
# Visit http://localhost:5050
```

## 🔐 Security

### Environment Variables

Never commit `.env` to version control. Use `.env.example` as a template.

```bash
cp .env.example .env
# Edit .env with your credentials
```

### API Keys

Store all API keys in environment variables:
- `BREVO_API_KEY` - Email service
- `UPLOADTHING_API_KEY` - File uploads
- `JWT_SECRET` - JWT signing

### Database Security

- Use strong passwords in production
- Enable SSL/TLS for database connections
- Regular backups and recovery testing
- Implement row-level security for multi-tenancy

## 📈 Performance

### Optimization

- Database connection pooling (20 connections)
- Redis caching for frequently accessed data
- Gzip compression for responses
- Static asset caching (1 year)
- Code splitting and lazy loading
- Image optimization

### Monitoring

- Application health checks
- Database performance monitoring
- Error tracking and logging
- Performance metrics collection
- Alert rules for critical issues

## 🚢 Deployment

### Production Checklist

- [ ] Use environment-specific `.env` files
- [ ] Enable HTTPS/SSL certificates
- [ ] Configure managed database (AWS RDS, Neon, etc.)
- [ ] Set up automated backups
- [ ] Configure monitoring and alerting
- [ ] Use container orchestration (Kubernetes, Docker Swarm)
- [ ] Implement CI/CD pipeline
- [ ] Regular security audits

See [infrastructure-deployment.md](.kiro/specs/school-management-system/infrastructure-deployment.md) for detailed deployment guide.

## 📞 Support

### Troubleshooting

```bash
# Check services
docker-compose ps

# View logs
npm run docker:logs

# Reset everything
npm run docker:reset

# Test database
docker exec sms-postgres psql -U sms_user -d school_management -c "\dt"
```

### Resources

- [Docker Documentation](https://docs.docker.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Express.js Documentation](https://expressjs.com/)
- [React Documentation](https://react.dev/)
- [Specification Documents](.kiro/specs/school-management-system/)

## 📝 License

MIT License - See LICENSE file for details

## 👥 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## 🎓 Learning Resources

- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [React Best Practices](https://react.dev/learn)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

## 📊 Project Status

**Current Phase**: Phase 1 Complete ✅  
**Overall Progress**: 14% (1 of 24 phases)  
**Estimated Completion**: 6-9 months

See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for detailed progress.

## 🔄 Next Steps

1. ✅ Phase 1: Project Setup and Infrastructure (Complete)
2. ⏳ Phase 2: Authentication and Authorization (Next)
3. ⏳ Phase 3: Core Data Models
4. ⏳ Phase 4: Student Enrollment
5. ⏳ Phase 5: Grades Management
6. ... and 19 more phases

See [tasks.md](.kiro/specs/school-management-system/tasks.md) for complete task list.

---

**Built with ❤️ for educational institutions**
