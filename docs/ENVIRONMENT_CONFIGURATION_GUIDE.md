# Environment Configuration Guide

## Overview

This guide explains how to configure the School Management System for different environments using environment variables. The system uses external services for email, file uploads, and database connectivity.

## Security Best Practices

**CRITICAL SECURITY RULES:**

1. **Never commit `.env` to version control** - It's already in `.gitignore`
2. **Never log or expose API keys** - They can be used to access external services
3. **Use different keys per environment** - Development, staging, and production should have separate credentials
4. **Rotate keys regularly** - Update API keys every quarter or after team member changes
5. **Use strong secrets** - JWT secrets must be at least 32 characters
6. **Restrict file permissions** - `.env` file should not be readable by other users (chmod 600)

## Required External Services

### 1. Brevo Email Service

**Purpose:** Send transactional and marketing emails for notifications, password resets, and alerts.

**Setup Instructions:**

1. Go to [https://www.brevo.com/](https://www.brevo.com/)
2. Sign up for a free account
3. Navigate to Settings → Keys & Tokens (or https://app.brevo.com/settings/keys/api)
4. Copy your API key (starts with `xkeysib-`)
5. Add to `.env`:
   ```
   BREVO_API_KEY=xkeysib-YOUR_API_KEY
   BREVO_SENDER_EMAIL=noreply@school.com
   BREVO_SENDER_NAME=School Management System
   ```

**Verification:**

```bash
# Test Brevo API key validity
curl -X POST https://api.brevo.com/v3/smtp/sendTemplateEmail \
  -H "Content-Type: application/json" \
  -H "api-key: xkeysib-YOUR_API_KEY" \
  -d '{"email":"test@example.com","templateId":1}'
```

**Email Templates to Configure (Optional):**

- Password Reset
- Grade Notification
- Attendance Alert
- Fee Payment Reminder
- Enrollment Confirmation
- System Alert

### 2. UploadThing File Upload Service

**Purpose:** Securely store documents, certificates, and bulk import files.

**Setup Instructions:**

1. Go to [https://uploadthing.com/](https://uploadthing.com/)
2. Sign up for an account
3. Create a new app
4. Get API credentials from the dashboard
5. Add to `.env`:
   ```
   UPLOADTHING_API_KEY=sk_live_YOUR_API_KEY
   UPLOADTHING_APP_ID=YOUR_APP_ID
   UPLOADTHING_SECRET=YOUR_SECRET
   ```

**Verification:**

```bash
# Test UploadThing configuration
curl -X GET https://api.uploadthing.com/v4/auth \
  -H "X-UPLOADTHING-API-KEY: sk_live_YOUR_API_KEY"
```

### 3. Neon PostgreSQL Database

**Purpose:** Store all application data (students, grades, attendance, etc.)

**Setup Instructions:**

1. Go to [https://neon.tech/](https://neon.tech/)
2. Sign up for a free account
3. Create a new project
4. Copy the connection string from the project dashboard
5. Add to `.env`:
   ```
   DATABASE_URL=postgresql://user:password@neon.tech/dbname?sslmode=require
   ```

**Connection String Format:**
```
postgresql://username:password@hostname/database_name?sslmode=require&connect_timeout=10
```

**Verification:**

```bash
# Test database connection
psql "postgresql://user:password@host/database?sslmode=require"
```

## Environment Variables Configuration

### Development Environment

```bash
# .env for local development
NODE_ENV=development
BREVO_API_KEY=xkeysib-dev-key-here
DATABASE_URL=postgresql://dev:dev@localhost/school_dev
UPLOADTHING_API_KEY=sk_test_dev_key_here
JWT_SECRET=dev-jwt-secret-min-32-chars-required
```

### Staging Environment

```bash
# .env for staging
NODE_ENV=staging
BREVO_API_KEY=xkeysib-staging-key-here
DATABASE_URL=postgresql://staging:password@neon.tech/school_staging?sslmode=require
UPLOADTHING_API_KEY=sk_live_staging_key_here
JWT_SECRET=staging-jwt-secret-min-32-chars-required
SECURE_COOKIE=true
SAME_SITE_COOKIE=strict
```

### Production Environment

```bash
# .env for production
NODE_ENV=production
BREVO_API_KEY=xkeysib-prod-key-here
DATABASE_URL=postgresql://prod:secure_password@neon.tech/school_prod?sslmode=require
UPLOADTHING_API_KEY=sk_live_prod_key_here
JWT_SECRET=prod-jwt-secret-min-32-chars-required
SECURE_COOKIE=true
SAME_SITE_COOKIE=strict
LOG_LEVEL=warn
ENABLE_ANALYTICS=true
```

## Generating Secure Secrets

### Generate JWT Secrets

```bash
# Using openssl
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Using Python
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Validation Checklist

Before deploying to any environment, verify:

- [ ] All required variables are set
- [ ] API keys are valid and active
- [ ] Database connection string is correct
- [ ] JWT secrets are at least 32 characters
- [ ] CORS origins are correct for the environment
- [ ] `.env` file is in `.gitignore`
- [ ] `.env` file is not committed to version control
- [ ] File permissions: `.env` should be readable only by the app owner (chmod 600)
- [ ] Secrets are rotated for production at least quarterly
- [ ] Different credentials are used per environment

## Environment Setup Scripts

### Setup Development Environment

```bash
#!/bin/bash

# Copy example file
cp .env.example .env

# Generate new JWT secrets
JWT_SECRET=$(openssl rand -base64 32)
REFRESH_TOKEN_SECRET=$(openssl rand -base64 32)

# Update .env with generated secrets
sed -i "s/your_jwt_secret_change_in_production_min_32_chars_required/$JWT_SECRET/" .env
sed -i "s/your_refresh_token_secret_change_in_production_min_32_chars_required/$REFRESH_TOKEN_SECRET/" .env

# Set permissions
chmod 600 .env

echo "Development environment configured. Update the following in .env:"
echo "  - BREVO_API_KEY"
echo "  - UPLOADTHING_API_KEY"
echo "  - UPLOADTHING_APP_ID"
echo "  - UPLOADTHING_SECRET"
echo "  - DATABASE_URL (if not using local PostgreSQL)"
```

### Verify Configuration

```bash
#!/bin/bash

# Check required variables
required_vars=(
  "BREVO_API_KEY"
  "UPLOADTHING_API_KEY"
  "DATABASE_URL"
  "JWT_SECRET"
  "REFRESH_TOKEN_SECRET"
)

for var in "${required_vars[@]}"; do
  if grep -q "^$var=" .env; then
    value=$(grep "^$var=" .env | cut -d= -f2)
    if [ -z "$value" ] || [[ "$value" == *"placeholder"* ]] || [[ "$value" == *"your_"* ]]; then
      echo "❌ $var is not configured"
    else
      echo "✅ $var is configured"
    fi
  else
    echo "❌ $var is missing"
  fi
done
```

## Troubleshooting

### Email Not Sending

1. Verify `BREVO_API_KEY` is correct
2. Check that `BREVO_SENDER_EMAIL` is a verified sender in Brevo
3. Review Brevo logs for bounce/block reasons
4. Ensure `ENABLE_EMAIL_SERVICE=true` in `.env`

### Database Connection Failed

1. Verify `DATABASE_URL` format is correct
2. Check that database credentials are valid
3. Ensure network connectivity to Neon (not blocked by firewall)
4. Test connection: `psql "$DATABASE_URL"`

### File Upload Issues

1. Verify `UPLOADTHING_API_KEY` is active
2. Check `UPLOADTHING_APP_ID` matches your app
3. Ensure file type is allowed in UploadThing settings
4. Check file size limits

## Secret Rotation

### Annual Rotation Procedure

1. Generate new API keys for each service
2. Create a branch: `git checkout -b chore/rotate-secrets`
3. Update credentials in each environment
4. Deploy to each environment (starting with staging)
5. Verify functionality in each environment
6. Deactivate old keys after confirmation
7. Merge and document the rotation

## Monitoring and Alerts

### Set Up Alerts For:

- Failed API authentication (indicates stale credentials)
- Database connection failures
- Email delivery failures (bounces, blocks)
- File upload failures
- Memory or resource exhaustion

## Related Documentation

- [Brevo API Documentation](https://developers.brevo.com/)
- [UploadThing Documentation](https://docs.uploadthing.com/)
- [Neon PostgreSQL Documentation](https://neon.tech/docs/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc7519)
- [OWASP Secrets Management](https://owasp.org/www-community/Source_Code_Leaks)
