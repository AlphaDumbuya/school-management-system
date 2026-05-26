# School Management System - Infrastructure & Deployment Guide

## Executive Summary

This document defines the infrastructure architecture, deployment procedures, monitoring setup, and disaster recovery strategies for the School Management System. It ensures the system is scalable, reliable, and maintainable in production environments.

---

## 1. Infrastructure Architecture

### 1.1 Cloud Platform Selection

**Recommended: AWS (Amazon Web Services)**

**Rationale:**
- Global availability with 30+ regions
- Comprehensive managed services
- Strong security and compliance certifications
- Cost-effective pricing models
- Excellent documentation and community support

**Alternative Options:**
- Google Cloud Platform (GCP): Similar capabilities, strong data analytics
- Microsoft Azure: Good for organizations using Microsoft stack
- DigitalOcean: Simpler, cost-effective for smaller deployments

### 1.2 High-Level Infrastructure Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Internet                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  CloudFront CDN   │
                    │  (Static Assets)  │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  AWS WAF          │
                    │  (DDoS Protection)│
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Application      │
                    │  Load Balancer    │
                    │  (ALB)            │
                    └─────────┬─────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
│ ECS Cluster    │  │ ECS Cluster     │  │ ECS Cluster     │
│ (AZ-1)         │  │ (AZ-2)          │  │ (AZ-3)          │
│ ┌────────────┐ │  │ ┌────────────┐  │  │ ┌────────────┐  │
│ │ Container  │ │  │ │ Container  │  │  │ │ Container  │  │
│ │ Instance 1 │ │  │ │ Instance 2 │  │  │ │ Instance 3 │  │
│ └────────────┘ │  │ └────────────┘  │  │ └────────────┘  │
└────────────────┘  └─────────────────┘  └─────────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐  ┌────────▼────────┐  ┌────────▼────────┐
│ RDS Aurora     │  │ ElastiCache     │  │ S3 Bucket       │
│ (Primary)      │  │ (Redis)         │  │ (Backups)       │
└────────────────┘  └─────────────────┘  └─────────────────┘
        │
┌───────▼────────┐
│ RDS Aurora     │
│ (Read Replica) │
└────────────────┘
```

### 1.3 Environment Strategy

**Three-Tier Environment:**

1. **Development Environment**
   - Purpose: Feature development and testing
   - Infrastructure: Minimal (single instance)
   - Data: Synthetic/test data only
   - Backup: Daily
   - Cost: Low

2. **Staging Environment**
   - Purpose: Pre-production testing
   - Infrastructure: Production-like (multi-AZ)
   - Data: Anonymized production data
   - Backup: Daily
   - Cost: Medium

3. **Production Environment**
   - Purpose: Live system
   - Infrastructure: Full HA/DR setup
   - Data: Real data with encryption
   - Backup: Hourly
   - Cost: High

---

## 2. AWS Infrastructure Components

### 2.1 Compute Layer

**Amazon ECS (Elastic Container Service)**

**Configuration:**
- Cluster: Multi-AZ deployment (3 availability zones)
- Launch Type: Fargate (serverless containers)
- Task Definition:
  - CPU: 1 vCPU per container
  - Memory: 2 GB per container
  - Container Image: Node.js 18+ LTS
  - Port: 3000 (application)
  - Health Check: HTTP GET /health every 30 seconds

**Auto-Scaling:**
- Min Tasks: 3 (one per AZ)
- Max Tasks: 20
- Target CPU Utilization: 70%
- Target Memory Utilization: 80%
- Scale-up: Add 2 tasks when threshold exceeded
- Scale-down: Remove 1 task when below threshold

**Container Registry:**
- Amazon ECR (Elastic Container Registry)
- Image Scanning: Enabled
- Lifecycle Policy: Keep last 10 images
- Image Tagging: Semantic versioning (v1.2.3)

### 2.2 Database Layer

**Amazon RDS Aurora PostgreSQL**

**Configuration:**
- Engine: PostgreSQL 14+
- Instance Type: db.r6g.xlarge (production)
- Multi-AZ: Enabled (automatic failover)
- Storage: 500 GB (auto-scaling enabled)
- Backup Retention: 30 days
- Backup Window: 02:00-03:00 UTC
- Maintenance Window: Sunday 03:00-04:00 UTC

**Performance Optimization:**
- Read Replicas: 2 (for reporting queries)
- Parameter Group: Custom optimization
- Enhanced Monitoring: Enabled
- Performance Insights: Enabled
- Slow Query Log: Enabled (threshold: 1 second)

**Connection Pooling:**
- Amazon RDS Proxy
- Max Connections: 1000
- Connection Idle Timeout: 15 minutes
- Session Pinning: Enabled

**Backup Strategy:**
- Automated Backups: Daily at 02:00 UTC
- Manual Snapshots: Weekly
- Cross-Region Backup: Daily to secondary region
- Backup Encryption: AES-256
- Retention: 30 days automated, 1 year manual

### 2.3 Caching Layer

**Amazon ElastiCache Redis**

**Configuration:**
- Engine: Redis 7.0+
- Node Type: cache.r6g.xlarge
- Cluster Mode: Enabled (for sharding)
- Number of Shards: 3
- Replicas per Shard: 2
- Multi-AZ: Enabled
- Automatic Failover: Enabled

**Use Cases:**
- Session Storage: User sessions, JWT tokens
- Cache: Frequently accessed data (grades, schedules)
- Rate Limiting: Request rate tracking
- Real-time Data: Live notifications, updates

**Eviction Policy:**
- Policy: allkeys-lru (least recently used)
- Max Memory: 80% of node capacity
- TTL: 24 hours for sessions, 1 hour for cache

**Backup:**
- Automated Snapshots: Daily
- Retention: 7 days
- Encryption: At rest and in transit

### 2.4 Storage Layer

**Amazon S3 (Simple Storage Service)**

**Buckets:**

1. **Application Assets Bucket**
   - Purpose: Static files, uploads
   - Versioning: Enabled
   - Encryption: AES-256
   - Public Access: Blocked
   - CDN: CloudFront distribution

2. **Backup Bucket**
   - Purpose: Database backups, exports
   - Versioning: Enabled
   - Encryption: AES-256
   - Lifecycle: Move to Glacier after 90 days
   - Retention: 1 year

3. **Logs Bucket**
   - Purpose: Application and access logs
   - Versioning: Disabled
   - Encryption: AES-256
   - Lifecycle: Delete after 90 days
   - Retention: 90 days

**Lifecycle Policies:**
```
Standard → Infrequent Access (30 days) → Glacier (90 days) → Delete (365 days)
```

### 2.5 Content Delivery

**Amazon CloudFront**

**Configuration:**
- Distribution Type: Web
- Origin: S3 bucket + ALB
- Caching Behavior:
  - Static Assets: 1 year TTL
  - API Responses: No cache
  - HTML: 5 minutes TTL
- Compression: Enabled (gzip, brotli)
- HTTPS: Enforced
- Certificate: AWS Certificate Manager (ACM)
- WAF: Enabled

**Performance:**
- Edge Locations: 400+ globally
- Regional Caches: 13 regions
- Origin Shield: Enabled (additional caching layer)

### 2.6 Load Balancing

**Application Load Balancer (ALB)**

**Configuration:**
- Scheme: Internet-facing
- Subnets: Multi-AZ (3 AZs)
- Security Groups: Restrictive rules
- Listeners:
  - HTTP (80): Redirect to HTTPS
  - HTTPS (443): Forward to ECS targets
- Target Group:
  - Protocol: HTTP
  - Port: 3000
  - Health Check: /health (30s interval, 2 healthy threshold)
  - Stickiness: Enabled (1 day duration)

**SSL/TLS:**
- Certificate: AWS Certificate Manager
- Protocol: TLS 1.3
- Cipher Suites: Modern only
- HSTS: Enabled (max-age=31536000)

### 2.7 Networking

**VPC (Virtual Private Cloud)**

**Architecture:**
```
VPC: 10.0.0.0/16
├── Public Subnets (3 AZs)
│   ├── AZ-1: 10.0.1.0/24
│   ├── AZ-2: 10.0.2.0/24
│   └── AZ-3: 10.0.3.0/24
├── Private Subnets (3 AZs)
│   ├── AZ-1: 10.0.11.0/24
│   ├── AZ-2: 10.0.12.0/24
│   └── AZ-3: 10.0.13.0/24
└── Database Subnets (3 AZs)
    ├── AZ-1: 10.0.21.0/24
    ├── AZ-2: 10.0.22.0/24
    └── AZ-3: 10.0.23.0/24
```

**Security Groups:**

1. **ALB Security Group**
   - Inbound: HTTP (80), HTTPS (443) from 0.0.0.0/0
   - Outbound: All traffic to ECS security group

2. **ECS Security Group**
   - Inbound: Port 3000 from ALB security group
   - Outbound: All traffic (for external APIs)

3. **RDS Security Group**
   - Inbound: Port 5432 from ECS security group
   - Outbound: None

4. **ElastiCache Security Group**
   - Inbound: Port 6379 from ECS security group
   - Outbound: None

**NAT Gateway:**
- Location: Public subnets (one per AZ)
- Purpose: Outbound internet access for private subnets
- Elastic IP: One per NAT Gateway

---

## 3. Infrastructure as Code (IaC)

### 3.1 Terraform Configuration

**Project Structure:**
```
infrastructure/
├── main.tf                 # Main configuration
├── variables.tf            # Input variables
├── outputs.tf              # Output values
├── vpc.tf                  # VPC and networking
├── ecs.tf                  # ECS cluster and services
├── rds.tf                  # RDS database
├── elasticache.tf          # ElastiCache Redis
├── s3.tf                   # S3 buckets
├── cloudfront.tf           # CloudFront distribution
├── alb.tf                  # Application Load Balancer
├── iam.tf                  # IAM roles and policies
├── monitoring.tf           # CloudWatch and monitoring
├── terraform.tfvars        # Environment-specific values
└── environments/
    ├── dev.tfvars
    ├── staging.tfvars
    └── prod.tfvars
```

**Key Terraform Modules:**
- VPC Module: Network infrastructure
- ECS Module: Container orchestration
- RDS Module: Database setup
- ElastiCache Module: Caching layer
- ALB Module: Load balancing
- Monitoring Module: CloudWatch setup

### 3.2 Docker Configuration

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Run application
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**Docker Compose (Development):**
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://user:pass@postgres:5432/sms
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:14-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=sms
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

## 4. Deployment Procedures

### 4.1 Deployment Pipeline

**CI/CD Pipeline (GitHub Actions):**

```
Code Push
    ↓
[1] Lint & Format Check
    ↓
[2] Unit Tests
    ↓
[3] Build Docker Image
    ↓
[4] Push to ECR
    ↓
[5] Deploy to Staging
    ↓
[6] Integration Tests
    ↓
[7] Security Scanning
    ↓
[8] Manual Approval
    ↓
[9] Deploy to Production
    ↓
[10] Smoke Tests
    ↓
[11] Monitoring & Alerts
```

**GitHub Actions Workflow:**
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: aws-actions/configure-aws-credentials@v2
      - uses: aws-actions/amazon-ecr-login@v1
      - run: docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
      - run: docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v2
      - run: aws ecs update-service --cluster staging --service app --force-new-deployment

  deploy-prod:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: aws-actions/configure-aws-credentials@v2
      - run: aws ecs update-service --cluster production --service app --force-new-deployment
```

### 4.2 Blue-Green Deployment

**Strategy:**
- Maintain two identical production environments (Blue and Green)
- Deploy new version to inactive environment
- Run smoke tests
- Switch traffic to new environment
- Keep old environment as rollback target

**Implementation:**
```
Current State:
  Blue (Active) ← ALB Traffic
  Green (Inactive)

Deployment:
  1. Deploy to Green
  2. Run smoke tests on Green
  3. Switch ALB target group to Green
  4. Monitor Green for issues
  5. Keep Blue as rollback target

Rollback:
  1. Switch ALB target group back to Blue
  2. Investigate issues in Green
```

### 4.3 Canary Deployment

**Strategy:**
- Route small percentage of traffic to new version
- Monitor metrics and errors
- Gradually increase traffic if healthy
- Rollback if issues detected

**Implementation:**
```
Traffic Distribution:
  Version 1.0 (Current): 95%
  Version 1.1 (Canary): 5%

Monitoring:
  - Error rate < 0.1%
  - Latency p99 < 500ms
  - CPU utilization < 80%

Progression:
  5% → 25% → 50% → 100%
  (Each step: 5 minutes if healthy)
```

### 4.4 Rollback Procedures

**Automatic Rollback Triggers:**
- Error rate > 1%
- Latency p99 > 1000ms
- CPU utilization > 90%
- Memory utilization > 90%
- Health check failures > 10%

**Manual Rollback:**
```bash
# Rollback to previous version
aws ecs update-service \
  --cluster production \
  --service app \
  --force-new-deployment \
  --task-definition app:PREVIOUS_VERSION
```

---

## 5. Monitoring & Observability

### 5.1 CloudWatch Monitoring

**Metrics to Monitor:**

**Application Metrics:**
- Request count (per endpoint)
- Response time (p50, p95, p99)
- Error rate (4xx, 5xx)
- Active connections
- Database query time
- Cache hit rate

**Infrastructure Metrics:**
- CPU utilization
- Memory utilization
- Disk utilization
- Network I/O
- Container restarts
- Task count

**Database Metrics:**
- Query performance
- Connection count
- Replication lag
- Backup status
- Storage utilization

**Cache Metrics:**
- Hit rate
- Eviction rate
- Memory utilization
- Connection count

**Dashboards:**
```
Main Dashboard:
├── Application Health
│   ├── Request Rate
│   ├── Error Rate
│   ├── Response Time
│   └── Active Users
├── Infrastructure Health
│   ├── CPU Utilization
│   ├── Memory Utilization
│   ├── Disk Utilization
│   └── Network I/O
├── Database Health
│   ├── Query Performance
│   ├── Connection Count
│   ├── Replication Lag
│   └── Storage Utilization
└── Cache Health
    ├── Hit Rate
    ├── Eviction Rate
    ├── Memory Utilization
    └── Connection Count
```

### 5.2 Alerting

**Alert Thresholds:**

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Error Rate | > 0.5% | > 1% | Page on-call engineer |
| Response Time (p99) | > 500ms | > 1000ms | Page on-call engineer |
| CPU Utilization | > 70% | > 90% | Auto-scale or page |
| Memory Utilization | > 75% | > 90% | Auto-scale or page |
| Database Replication Lag | > 5s | > 30s | Page DBA |
| Disk Utilization | > 80% | > 95% | Page on-call engineer |
| Health Check Failures | > 5% | > 10% | Page on-call engineer |

**Alert Channels:**
- Slack: Real-time notifications
- PagerDuty: On-call escalation
- Email: Summary reports
- SMS: Critical alerts only

### 5.3 Logging

**Log Aggregation:**
- CloudWatch Logs: Application and system logs
- Log Retention: 30 days (configurable)
- Log Streaming: Real-time to CloudWatch

**Log Levels:**
- ERROR: System errors, exceptions
- WARN: Warnings, potential issues
- INFO: General information, key events
- DEBUG: Detailed debugging information

**Log Format:**
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "service": "auth-service",
  "request_id": "req_123456",
  "user_id": "user_uuid",
  "action": "login",
  "status": "success",
  "duration_ms": 150,
  "message": "User logged in successfully"
}
```

### 5.4 Distributed Tracing

**Implementation:**
- AWS X-Ray for request tracing
- Trace all requests across services
- Identify performance bottlenecks
- Visualize service dependencies

**Trace Data:**
- Request ID propagation
- Service call chain
- Latency breakdown
- Error tracking

---

## 6. Disaster Recovery

### 6.1 RTO & RPO Targets

**Recovery Time Objective (RTO):**
- Database Failure: 5 minutes (automatic failover)
- Application Failure: 2 minutes (auto-restart)
- Region Failure: 30 minutes (manual failover)
- Complete Outage: 4 hours (restore from backup)

**Recovery Point Objective (RPO):**
- Database: 1 hour (hourly backups)
- Application: 0 minutes (stateless, no data loss)
- Configuration: 1 hour (version controlled)

### 6.2 Backup Strategy

**Backup Schedule:**
- Database: Hourly automated backups
- Manual Snapshots: Daily at 00:00 UTC
- Cross-Region Backup: Daily to secondary region
- Retention: 30 days automated, 1 year manual

**Backup Verification:**
- Weekly restore test to staging
- Monthly full restore test
- Quarterly cross-region restore test
- Annual disaster recovery drill

**Backup Encryption:**
- Algorithm: AES-256
- Key Management: AWS KMS
- Key Rotation: 90 days

### 6.3 Disaster Recovery Procedures

**Scenario 1: Database Failure**
1. Automatic failover to read replica (5 minutes)
2. Verify data integrity
3. Update connection strings if needed
4. Monitor for issues

**Scenario 2: Application Failure**
1. ECS auto-restart failed containers (2 minutes)
2. Auto-scaling launches new instances
3. ALB routes traffic to healthy instances
4. Monitor error rates

**Scenario 3: Region Failure**
1. Activate secondary region (manual)
2. Restore database from cross-region backup
3. Deploy application to secondary region
4. Update DNS to point to secondary region
5. Verify all services operational

**Scenario 4: Complete Data Loss**
1. Restore database from backup
2. Restore application code from version control
3. Restore configuration from version control
4. Verify data integrity
5. Run smoke tests

### 6.4 Failover Testing

**Monthly Failover Drill:**
- Simulate database failure
- Verify automatic failover works
- Measure actual RTO
- Document any issues
- Update procedures if needed

**Quarterly Cross-Region Failover:**
- Activate secondary region
- Restore from backup
- Verify all services work
- Measure actual RTO
- Document lessons learned

---

## 7. Cost Optimization

### 7.1 Cost Estimation

**Monthly Cost Breakdown (Production):**

| Component | Quantity | Unit Cost | Monthly Cost |
|-----------|----------|-----------|--------------|
| ECS Fargate | 3-20 tasks | $0.04/hour | $2,160 |
| RDS Aurora | db.r6g.xlarge | $2.50/hour | $1,825 |
| ElastiCache | 3 nodes | $1.50/hour | $1,095 |
| ALB | 1 LB | $16/month | $16 |
| CloudFront | 1 TB data | $0.085/GB | $85 |
| S3 | 100 GB storage | $0.023/GB | $2.30 |
| NAT Gateway | 3 gateways | $32/month | $96 |
| Data Transfer | 10 TB | $0.02/GB | $200 |
| **Total** | | | **~$5,479/month** |

### 7.2 Cost Optimization Strategies

**Compute:**
- Use Fargate Spot for non-critical workloads (70% savings)
- Right-size instances based on actual usage
- Implement auto-scaling to avoid over-provisioning

**Database:**
- Use read replicas for reporting queries
- Implement query optimization
- Use connection pooling to reduce connections

**Storage:**
- Implement S3 lifecycle policies
- Use S3 Intelligent-Tiering
- Compress data before storage

**Data Transfer:**
- Use CloudFront for static assets
- Implement caching strategies
- Compress API responses

**Reserved Capacity:**
- Purchase 1-year reserved instances (30% savings)
- Purchase 3-year reserved instances (50% savings)
- Use Savings Plans for flexible commitment

---

## 8. Deployment Checklist

### Pre-Deployment

- [ ] Code review completed
- [ ] All tests passing
- [ ] Security scanning passed
- [ ] Database migrations tested
- [ ] Configuration validated
- [ ] Backup verified
- [ ] Rollback plan documented
- [ ] Stakeholders notified
- [ ] Monitoring configured
- [ ] Alerts configured

### Deployment

- [ ] Deploy to staging first
- [ ] Run smoke tests on staging
- [ ] Get approval for production
- [ ] Deploy to production
- [ ] Monitor error rates
- [ ] Monitor response times
- [ ] Monitor resource utilization
- [ ] Verify all services operational
- [ ] Check database replication
- [ ] Verify backups running

### Post-Deployment

- [ ] Monitor for 1 hour
- [ ] Check application logs
- [ ] Verify user reports
- [ ] Document deployment
- [ ] Update runbooks if needed
- [ ] Communicate status to stakeholders
- [ ] Schedule post-mortem if issues

---

## 9. Runbooks

### Runbook: High CPU Utilization

**Symptoms:**
- CPU utilization > 90%
- Slow response times
- Increased error rates

**Investigation:**
1. Check CloudWatch metrics
2. Identify which service is consuming CPU
3. Check application logs for errors
4. Check database query performance

**Resolution:**
1. Trigger auto-scaling (if not already scaling)
2. Identify and optimize slow queries
3. Restart affected services if needed
4. Monitor for resolution

### Runbook: Database Connection Pool Exhaustion

**Symptoms:**
- Connection timeout errors
- "Too many connections" errors
- Increased response times

**Investigation:**
1. Check RDS Proxy connection count
2. Check application connection pool settings
3. Identify long-running queries
4. Check for connection leaks

**Resolution:**
1. Increase connection pool size (temporary)
2. Kill long-running queries
3. Restart application services
4. Implement connection pooling optimization

### Runbook: Disk Space Running Out

**Symptoms:**
- Disk utilization > 95%
- Write errors in logs
- Database performance degradation

**Investigation:**
1. Check disk utilization by component
2. Identify large files or logs
3. Check backup storage usage
4. Check log retention settings

**Resolution:**
1. Clean up old logs
2. Archive old backups
3. Increase disk size
4. Implement log rotation

---

## 10. Infrastructure Maintenance

### 10.1 Regular Maintenance Tasks

**Daily:**
- Monitor dashboards
- Check alerts
- Review error logs
- Verify backups completed

**Weekly:**
- Review performance metrics
- Check security logs
- Verify disaster recovery readiness
- Update documentation

**Monthly:**
- Patch operating systems
- Update dependencies
- Review and optimize costs
- Conduct failover drill

**Quarterly:**
- Security assessment
- Performance optimization review
- Capacity planning
- Disaster recovery drill

**Annually:**
- Full security audit
- Infrastructure review
- Compliance audit
- Disaster recovery test

### 10.2 Patch Management

**Security Patches:**
- Apply within 7 days of release
- Test in staging first
- Deploy during maintenance window
- Monitor for issues

**Regular Updates:**
- Apply monthly
- Test in staging first
- Deploy during maintenance window
- Monitor for issues

**Emergency Patches:**
- Apply immediately for critical vulnerabilities
- Test in staging if possible
- Deploy to production
- Monitor closely

---

## Appendix: Infrastructure Commands

**Deploy to Staging:**
```bash
aws ecs update-service \
  --cluster staging \
  --service app \
  --force-new-deployment
```

**Deploy to Production:**
```bash
aws ecs update-service \
  --cluster production \
  --service app \
  --force-new-deployment
```

**View Logs:**
```bash
aws logs tail /ecs/app --follow
```

**Scale Service:**
```bash
aws ecs update-service \
  --cluster production \
  --service app \
  --desired-count 10
```

**Create Database Snapshot:**
```bash
aws rds create-db-snapshot \
  --db-instance-identifier sms-prod \
  --db-snapshot-identifier sms-prod-backup-$(date +%Y%m%d)
```

