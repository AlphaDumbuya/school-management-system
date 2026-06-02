# Environment File Protection Guide

This guide explains how environment files (`.env`) are protected in this project and best practices for handling secrets.

---

## Protected Files

The following files are protected and will **never** be committed to Git:

### Automatically Ignored by Git

```
.env
.env.local
.env.*.local
.env.production
.env.staging
.env.test
secrets/
```

These patterns are configured in `.gitignore`.

### Pre-Commit Hook Protection

A pre-commit hook (`.git/hooks/pre-commit`) provides an additional layer of protection by:

1. Scanning staged files for sensitive patterns
2. Preventing commits if sensitive files are detected
3. Checking for hardcoded API keys and credentials
4. Providing warnings for suspicious patterns

---

## Environment File Types

### `.env.example` ✅ SAFE TO COMMIT

Contains template environment variables with placeholder values:

```bash
# Example file - SAFE to commit
BREVO_API_KEY=your_api_key_here
DATABASE_URL=postgresql://user:password@host/database
JWT_SECRET=your_jwt_secret_here
```

**Purpose**: Provides developers with a template to create their local `.env` file

### `.env.docker` ✅ SAFE TO COMMIT

Contains Docker-specific configuration with development values:

```bash
# Docker development - SAFE to commit (development values only)
DB_USER=sms_user
DB_PASSWORD=sms_password
NODE_ENV=development
```

**Purpose**: Provides sensible defaults for Docker local development

### `.env` ❌ NEVER COMMIT

Your local environment file with actual credentials:

```bash
# Local development - NEVER COMMIT
BREVO_API_KEY=sk-abc123def456...
DATABASE_URL=postgresql://sms_user:actualpassword@localhost/school_management
JWT_SECRET=your_super_secret_key_change_in_production
```

**Purpose**: Stores your actual credentials for local development

### `.env.production` ❌ NEVER COMMIT

Production environment file with real credentials:

```bash
# Production - NEVER COMMIT
BREVO_API_KEY=sk-prod-abc123def456...
DATABASE_URL=postgresql://prod_user:prod_password@prod-db.neon.tech/school_management
JWT_SECRET=production_super_secret_key
```

**Purpose**: Used for production deployment (handled by deployment system)

---

## Setup Instructions

### 1. Create Local `.env` File

```bash
# Copy the Docker template
cp .env.docker .env

# Or copy the example
cp .env.example .env

# Edit with your actual credentials
nano .env  # or use your editor
```

### 2. Update with Real Credentials

```bash
# Open .env and update with actual values:
BREVO_API_KEY=sk_your_actual_key_here
UPLOADTHING_API_KEY=your_actual_key_here
JWT_SECRET=your_actual_secret_here
DATABASE_URL=your_actual_database_url
```

### 3. Verify File is Ignored

```bash
# Check that .env is ignored
git check-ignore .env

# Output should be:
# .env
```

### 4. Test Pre-Commit Hook

```bash
# Try to commit .env (should be prevented)
git add .env
git commit -m "test: checking env protection"

# Expected output:
# Pre-commit hook failed: Sensitive files detected
```

---

## Handling Different Environments

### Development (Local)

```bash
# Use .env created from .env.docker or .env.example
# Edit with your local credentials
cp .env.docker .env
nano .env
```

### Docker Development

```bash
# Use environment variables or .env.docker
# Can be used with docker-compose
cp .env.docker .env
docker-compose up
```

### Staging

```bash
# Environment variables should be provided by deployment system
# Never commit .env.staging
# Set via environment or secrets manager
```

### Production

```bash
# Environment variables from secrets manager or deployment system
# Use: AWS Secrets Manager, GitHub Secrets, GitLab CI/CD Variables, etc.
# Never commit .env.production
```

---

## Secure Workflow

### DO ✅

- ✅ Create `.env` from `.env.example` or `.env.docker`
- ✅ Add actual credentials to your local `.env` only
- ✅ Keep `.env` in your local machine only
- ✅ Use `.env.example` to share template with team
- ✅ Use environment variables in production
- ✅ Use secrets managers (AWS Secrets, GitHub Secrets, etc.)
- ✅ Rotate credentials regularly
- ✅ Review `.gitignore` before committing

### DON'T ❌

- ❌ Commit `.env` file
- ❌ Commit any file with actual credentials
- ❌ Hardcode secrets in code
- ❌ Share `.env` file via email or Slack
- ❌ Commit private keys (*.pem, *.key)
- ❌ Commit API keys in configuration files
- ❌ Use same credentials across environments
- ❌ Bypass pre-commit hook with `--no-verify`

---

## If You Accidentally Committed Secrets

**IMPORTANT**: If you accidentally committed sensitive information:

### 1. Immediately Rotate Credentials

```bash
# Regenerate your API keys
# - Brevo: https://www.brevo.com/account/dashboard/
# - UploadThing: https://uploadthing.com/dashboard
# - JWT Secret: Generate new value
# - Database: Change password
```

### 2. Remove from Git History

```bash
# Option A: Using git filter-branch (careful!)
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty --tag-name-filter cat -- --all

# Option B: Using BFG Repo-Cleaner (safer)
# https://rtyley.github.io/bfg-repo-cleaner/
bfg --delete-files .env --no-blob-protection
```

### 3. Force Push (Use with Caution)

```bash
# Only if you're the sole developer
git push origin --force --all
git push origin --force --tags
```

### 4. Notify Team

If multiple developers are working:
1. Alert all team members
2. Have them update their local clones
3. Follow your team's incident response procedure

---

## Pre-Commit Hook Details

### How It Works

The hook checks for:

1. **File Patterns**: Files matching sensitive patterns
   - `.env*` files
   - `.pem` and `.key` files
   - `secrets/` directory
   - Files with "credentials", "apikey", "secret" in name

2. **Content Patterns**: Specific credentials in staged changes
   - `BREVO_API_KEY=` values
   - `DATABASE_URL=` with credentials
   - `JWT_SECRET=` values
   - `password=` patterns

3. **Warnings**: Suspicious patterns that warrant review
   - TODO/FIXME comments

### Testing the Hook

```bash
# Test that hook is installed
ls -la .git/hooks/pre-commit

# Test hook functionality
echo "BREVO_API_KEY=sk_test_123" > test_secret.txt
git add test_secret.txt
git commit -m "test"  # Should fail

# Cleanup
git reset HEAD test_secret.txt
rm test_secret.txt
```

### Bypassing Hook (Not Recommended)

```bash
# Only use if absolutely necessary
git commit --no-verify

# Better: Fix the issue instead
```

---

## GitHub Secrets Integration

For GitHub CI/CD, use GitHub Secrets instead of committing `.env`:

### 1. Add Secrets to Repository

```bash
# Go to: Settings → Secrets and variables → Actions

# Add each secret:
- BREVO_API_KEY
- UPLOADTHING_API_KEY
- DATABASE_URL
- JWT_SECRET
- etc.
```

### 2. Use in GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
        env:
          BREVO_API_KEY: ${{ secrets.BREVO_API_KEY }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

## Environment Variable Reference

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host/database

# Cache
REDIS_URL=redis://:password@host:6379

# Message Queue
RABBITMQ_URL=amqp://user:password@host:5672

# Authentication
JWT_SECRET=your_super_secret_key
JWT_EXPIRY=30m

# External Services
BREVO_API_KEY=sk_your_api_key
BREVO_SENDER_EMAIL=noreply@yourdomain.com

UPLOADTHING_API_KEY=your_key
UPLOADTHING_APP_ID=your_app_id
UPLOADTHING_SECRET=your_secret

# Application
NODE_ENV=development
LOG_LEVEL=debug
PORT=3000
```

---

## Secure Credential Management

### Development

```bash
# Use .env.docker or .env.example as template
# Create local .env with actual credentials
# Keep .env in .gitignore (already configured)
```

### Staging

```bash
# Use environment variables set by deployment system
# OR use secrets manager with deployment
# Example: export vars before deploying
export BREVO_API_KEY=staging_key
export DATABASE_URL=staging_url
npm run build && npm start
```

### Production

```bash
# Option 1: Environment Variables (recommended)
export BREVO_API_KEY=$(aws secretsmanager get-secret-value --secret-id brevo-key)
export DATABASE_URL=$(aws secretsmanager get-secret-value --secret-id db-url)

# Option 2: Secrets File (deployment system handles)
# Never commit to Git

# Option 3: Secrets Manager Integration
# Use SDK to fetch at runtime
```

---

## Troubleshooting

### `.env` file committed accidentally

```bash
# Check if it's in Git
git log --all -- .env

# Remove from repository
git rm --cached .env
git commit -m "chore: remove committed .env file"
git push origin main
```

### Pre-commit hook not working

```bash
# Verify hook is installed and executable
ls -la .git/hooks/pre-commit

# Make executable
chmod +x .git/hooks/pre-commit

# Test hook
bash .git/hooks/pre-commit
```

### Lost `.env` file locally

```bash
# Restore from .env.docker or .env.example
cp .env.docker .env

# Manually add your credentials back
nano .env
```

### Pre-commit hook too strict

```bash
# View what triggered the hook
git diff --cached

# For legitimate cases, use --no-verify (not recommended):
git commit --no-verify -m "message"

# Better: Fix the issue or update hook
```

---

## Best Practices Summary

1. **Never commit secrets** - Use `.gitignore` and pre-commit hooks
2. **Use templates** - Share `.env.example` with team
3. **Rotate regularly** - Change credentials every 90 days
4. **Environment-specific** - Different credentials per environment
5. **Use secrets managers** - AWS Secrets, GitHub Secrets, etc.
6. **Minimal permissions** - Each credential has minimum required access
7. **Audit access** - Monitor who accesses credentials
8. **Document procedures** - Keep team informed of security practices

---

## Resources

- [OWASP: Secret Management](https://owasp.org/www-community/attacks/Sensitive_Data_Exposure)
- [GitHub: Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)
- [Git Security](https://git-scm.com/book/en/v2/Git-Tools-Signing-Your-Work)

---

**Status**: ✅ Environment protection configured  
**Last Updated**: June 1, 2026  
**Next Review**: Before production deployment
