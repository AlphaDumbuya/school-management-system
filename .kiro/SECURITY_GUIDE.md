# Security Guide - School Management System

## 🔐 Credential Management

### DO NOT:
- ❌ Share API keys in chat, email, or code
- ❌ Commit `.env` files to version control
- ❌ Use the same credentials for dev and production
- ❌ Share database passwords
- ❌ Hardcode secrets in code

### DO:
- ✅ Use `.env` files for local development
- ✅ Use `.env.example` with placeholder values
- ✅ Rotate credentials regularly (every 90 days)
- ✅ Use different credentials for each environment
- ✅ Store secrets in secure vaults (GitHub Secrets, etc.)
- ✅ Use environment variables for all sensitive data

---

## 📋 Setup Instructions

### Step 1: Create Local .env File

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your actual credentials
nano .env  # or use your preferred editor
```

### Step 2: Add to .gitignore

The `.gitignore` file should already include:
```
.env
.env.local
.env.*.local
```

Verify with:
```bash
cat .gitignore | grep "\.env"
```

### Step 3: Verify .env is Not Tracked

```bash
# Check if .env is tracked
git status

# If .env is tracked, remove it
git rm --cached .env
git commit -m "Remove .env from tracking"
```

---

## 🔑 Credential Rotation

### When to Rotate:
- Every 90 days (security best practice)
- After any suspected compromise
- When team member leaves
- Before production deployment

### How to Rotate:

#### UploadThing:
1. Go to UploadThing dashboard
2. Settings → API Keys
3. Click "Regenerate" on current key
4. Copy new key
5. Update `.env` file
6. Restart application

#### Neon PostgreSQL:
1. Go to Neon dashboard
2. Project Settings → Database
3. Click "Reset password"
4. Copy new connection string
5. Update `DATABASE_URL` in `.env`
6. Restart application

#### Brevo:
1. Go to Brevo dashboard
2. Settings → SMTP & API
3. Click "Create a new API key"
4. Copy new key
5. Update `BREVO_API_KEY` in `.env`
6. Restart application

---

## 🛡️ Environment-Specific Configuration

### Development (.env)
```
NODE_ENV=development
LOG_LEVEL=debug
DATABASE_URL=postgresql://dev_user:dev_password@localhost/school_dev
JWT_SECRET=dev_secret_change_me
```

### Staging (.env.staging)
```
NODE_ENV=staging
LOG_LEVEL=info
DATABASE_URL=postgresql://staging_user:staging_password@staging-host/school_staging
JWT_SECRET=staging_secret_change_me
```

### Production (.env.production)
```
NODE_ENV=production
LOG_LEVEL=warn
DATABASE_URL=postgresql://prod_user:prod_password@prod-host/school_prod
JWT_SECRET=production_secret_generate_strong_random_string
```

---

## 🔒 GitHub Secrets Setup

For CI/CD pipelines, use GitHub Secrets:

1. Go to Repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret:
   - `UPLOADTHING_API_KEY`
   - `UPLOADTHING_APP_ID`
   - `UPLOADTHING_SECRET`
   - `DATABASE_URL`
   - `BREVO_API_KEY`
   - `JWT_SECRET`

4. Use in GitHub Actions:
```yaml
env:
  UPLOADTHING_API_KEY: ${{ secrets.UPLOADTHING_API_KEY }}
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  BREVO_API_KEY: ${{ secrets.BREVO_API_KEY }}
```

---

## 🚨 If Credentials Are Compromised

### Immediate Actions:
1. **Stop the application** to prevent unauthorized access
2. **Revoke all exposed credentials** immediately
3. **Generate new credentials** for all services
4. **Update all environments** with new credentials
5. **Review audit logs** for unauthorized access
6. **Notify team members** of the incident
7. **Restart the application** with new credentials

### Revocation Steps:

**UploadThing:**
```
1. Dashboard → Settings → API Keys
2. Click "Delete" on compromised key
3. Create new key
4. Update .env
```

**Neon:**
```
1. Dashboard → Project Settings
2. Click "Reset password"
3. Update DATABASE_URL in .env
```

**Brevo:**
```
1. Dashboard → Settings → SMTP & API
2. Click "Delete" on compromised key
3. Create new key
4. Update BREVO_API_KEY in .env
```

---

## 📝 Audit Logging

All sensitive operations are logged:

```typescript
// Example: Log credential access
logger.info('Database connection established', {
  host: process.env.DATABASE_URL?.split('@')[1],
  timestamp: new Date().toISOString(),
});

// Example: Log API key usage
logger.info('UploadThing API called', {
  endpoint: '/upload',
  timestamp: new Date().toISOString(),
});
```

Review logs regularly for suspicious activity:
```bash
tail -f logs/all.log | grep -i "credential\|api\|auth"
```

---

## 🔐 Best Practices

### 1. Use Strong Passwords
- Minimum 16 characters
- Mix of uppercase, lowercase, numbers, symbols
- Avoid dictionary words
- Use password generator

### 2. Enable Two-Factor Authentication (2FA)
- UploadThing: Settings → Security
- Neon: Account Settings → Security
- Brevo: Account Settings → Security
- GitHub: Settings → Security → Two-factor authentication

### 3. Regular Security Audits
- Review access logs monthly
- Check for unused API keys
- Verify all team members have appropriate access
- Audit database permissions

### 4. Principle of Least Privilege
- Give users only necessary permissions
- Use separate credentials for different services
- Limit API key scopes
- Restrict database user permissions

### 5. Secure Communication
- Always use HTTPS/TLS
- Never send credentials via email
- Use secure password managers
- Use VPN for remote access

---

## 🧪 Testing with Credentials

### Safe Testing Approach:
```typescript
// ✅ GOOD: Use environment variables
const apiKey = process.env.UPLOADTHING_API_KEY;

// ❌ BAD: Hardcode credentials
const apiKey = 'sk_live_c7aed42edd07d6e473094b54f79e5038045cb47c73e642cbd7396c2277aa3f32';

// ✅ GOOD: Use test credentials
const testApiKey = process.env.TEST_UPLOADTHING_API_KEY;
```

### Test Environment Setup:
```bash
# Create separate test .env
cp .env.example .env.test

# Use test credentials
TEST_UPLOADTHING_API_KEY=sk_test_xxx
TEST_DATABASE_URL=postgresql://test_user:test_password@localhost/school_test
TEST_BREVO_API_KEY=xkeysib_test_xxx
```

---

## 📚 Resources

- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)
- [UploadThing Security](https://docs.uploadthing.com/security)
- [Neon Security](https://neon.tech/docs/security)
- [Brevo Security](https://www.brevo.com/security/)

---

## ✅ Security Checklist

- [ ] `.env` file created with actual credentials
- [ ] `.env` added to `.gitignore`
- [ ] `.env.example` created with placeholders
- [ ] No credentials in code files
- [ ] No credentials in git history
- [ ] GitHub Secrets configured for CI/CD
- [ ] 2FA enabled on all external services
- [ ] Team members trained on credential handling
- [ ] Audit logs reviewed
- [ ] Incident response plan documented

---

## 🆘 Support

For security issues:
- Report to: security@school-management-system.com
- Do not disclose publicly
- Allow 48 hours for response
- Follow responsible disclosure practices
