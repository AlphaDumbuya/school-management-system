# Docker Setup Guide - School Management System

This guide explains how to set up and run the School Management System using Docker and Docker Compose.

## Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose)
- Git
- Node.js 18+ (for local development without Docker)

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd school-management-system

# Copy environment file
cp .env.docker .env
```

### 2. Configure Environment Variables

Edit `.env` and fill in your external service credentials:

```bash
# External Services
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=noreply@yourdomain.com

UPLOADTHING_API_KEY=your_uploadthing_api_key
UPLOADTHING_APP_ID=your_uploadthing_app_id
UPLOADTHING_SECRET=your_uploadthing_secret
```

### 3. Build and Start Services

```bash
# Build Docker images
npm run docker:build

# Start all services
npm run docker:up

# View logs
npm run docker:logs
```

### 4. Access Applications

- **Frontend**: http://localhost
- **Backend API**: http://localhost:3000/api
- **RabbitMQ Management**: http://localhost:15672 (guest/guest)
- **pgAdmin**: http://localhost:5050 (admin@example.com/admin) - optional

## Services

### PostgreSQL Database
- **Port**: 5432
- **User**: sms_user
- **Password**: sms_password
- **Database**: school_management
- **Volume**: `postgres_data`

### Redis Cache
- **Port**: 6379
- **Password**: redis_password
- **Volume**: `redis_data`

### RabbitMQ Message Queue
- **AMQP Port**: 5672
- **Management UI**: http://localhost:15672
- **User**: guest
- **Password**: guest
- **Volume**: `rabbitmq_data`

### Backend API
- **Port**: 3000
- **Framework**: Express.js
- **Language**: TypeScript
- **Health Check**: http://localhost:3000/health

### Frontend Application
- **Port**: 80
- **Framework**: React + Vite
- **Language**: TypeScript
- **Proxy**: Routes `/api/*` to backend

### pgAdmin (Optional)
- **Port**: 5050
- **Email**: admin@example.com
- **Password**: admin
- **Profile**: dev (use `--profile dev` to enable)

## Common Commands

```bash
# Start all services
npm run docker:up

# Stop all services
npm run docker:down

# View logs
npm run docker:logs

# Reset everything (remove volumes)
npm run docker:reset

# Build images
npm run docker:build

# Run database migrations
npm run db:migrate

# Seed database
npm run db:seed

# Run tests
npm run test

# Run linting
npm run lint

# Format code
npm run format
```

## Development Workflow

### Local Development (without Docker)

```bash
# Install dependencies
npm install

# Start backend development server
npm run dev -w backend

# Start frontend development server (in another terminal)
npm run dev -w frontend

# Run database migrations
npm run db:migrate

# Seed database
npm run db:seed
```

### Docker Development

```bash
# Start services
npm run docker:up

# View logs
npm run docker:logs

# Make code changes (hot reload enabled)
# Changes in backend/src and frontend/src are reflected automatically

# Run migrations inside container
docker exec sms-backend npm run db:migrate

# Run seeds inside container
docker exec sms-backend npm run db:seed
```

## Database Management

### Access PostgreSQL

```bash
# Using psql
psql -h localhost -U sms_user -d school_management

# Using pgAdmin
# Visit http://localhost:5050
# Add server: postgres:5432
```

### Run Migrations

```bash
# Inside container
docker exec sms-backend npm run db:migrate

# Or locally
npm run db:migrate
```

### Seed Database

```bash
# Inside container
docker exec sms-backend npm run db:seed

# Or locally
npm run db:seed
```

## Troubleshooting

### Services won't start

```bash
# Check Docker daemon is running
docker ps

# View detailed logs
docker-compose logs -f

# Rebuild images
npm run docker:build

# Reset everything
npm run docker:reset
```

### Database connection errors

```bash
# Check PostgreSQL is healthy
docker-compose ps

# Check connection string in .env
# Should be: postgresql://sms_user:sms_password@postgres:5432/school_management

# Verify database exists
docker exec sms-postgres psql -U sms_user -d school_management -c "\dt"
```

### Port conflicts

If ports are already in use, modify `docker-compose.yml`:

```yaml
services:
  postgres:
    ports:
      - "5433:5432"  # Change 5432 to 5433
```

### Redis connection issues

```bash
# Test Redis connection
docker exec sms-redis redis-cli -a redis_password ping

# Should return: PONG
```

### RabbitMQ issues

```bash
# Check RabbitMQ status
docker exec sms-rabbitmq rabbitmq-diagnostics -q ping

# View management UI
# http://localhost:15672
# Username: guest
# Password: guest
```

## Performance Optimization

### Database Connection Pooling
- Pool size: 20 connections
- Idle timeout: 5 minutes
- Connection timeout: 30 seconds

### Redis Caching
- Enabled for frequently accessed data
- TTL: Configurable per cache key
- Persistence: Enabled (AOF)

### Frontend Optimization
- Gzip compression enabled
- Static asset caching (1 year)
- Code splitting and lazy loading
- Image optimization

## Security Considerations

### Environment Variables
- Never commit `.env` to version control
- Use strong passwords for production
- Rotate secrets regularly
- Use separate credentials for dev/staging/prod

### Network Security
- Services communicate over internal Docker network
- Frontend proxies API requests through Nginx
- HTTPS should be enabled in production
- Security headers configured in Nginx

### Database Security
- PostgreSQL user has limited privileges
- Passwords should be strong in production
- Regular backups recommended
- Connection pooling prevents connection exhaustion

## Production Deployment

For production deployment:

1. Use environment-specific `.env` files
2. Enable HTTPS/SSL certificates
3. Use managed database services (AWS RDS, Neon, etc.)
4. Configure proper backup and recovery procedures
5. Set up monitoring and alerting
6. Use container orchestration (Kubernetes, Docker Swarm)
7. Implement CI/CD pipeline
8. Regular security audits and updates

See `infrastructure-deployment.md` for detailed production setup.

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [Express.js Documentation](https://expressjs.com/)
- [React Documentation](https://react.dev/)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Docker logs: `npm run docker:logs`
3. Check service health: `docker-compose ps`
4. Consult specification documents in `.kiro/specs/`
