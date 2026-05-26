# School Management System - Security & Compliance Document

## Executive Summary

This document defines the security architecture, compliance requirements, and data protection measures for the School Management System. It ensures the system meets enterprise security standards, regulatory requirements, and industry best practices for handling sensitive educational data.

---

## 1. Security Architecture

### 1.1 Defense in Depth Strategy

The system implements multiple layers of security:

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Network Security                                   │
│ - DDoS Protection, WAF, TLS/SSL Encryption                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: API Gateway Security                               │
│ - Rate Limiting, Request Validation, API Key Management    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Application Security                               │
│ - Authentication, Authorization, Input Validation          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Data Security                                      │
│ - Encryption at Rest, Encryption in Transit, Access Control│
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 5: Infrastructure Security                            │
│ - Firewalls, VPCs, Intrusion Detection, Logging            │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Encryption Standards

**Encryption at Rest:**
- Algorithm: AES-256-GCM
- Key Management: AWS KMS or HashiCorp Vault
- Scope: All sensitive data (PII, grades, financial records)
- Key Rotation: Automatic rotation every 90 days
- Backup Encryption: Same AES-256-GCM standard

**Encryption in Transit:**
- Protocol: TLS 1.3 (minimum TLS 1.2)
- Certificate: Valid SSL/TLS certificate from trusted CA
- HSTS: Enabled with max-age=31536000
- Certificate Pinning: For mobile applications
- Perfect Forward Secrecy: Enabled

**Field-Level Encryption:**
- Student PII: SSN, date of birth, contact information
- Financial Data: Payment card tokens, bank account details
- Medical Information: Health records, allergies
- Guardian Information: Parent/guardian contact details

### 1.3 Key Management

**Key Lifecycle:**
1. **Generation**: Cryptographically secure random generation
2. **Storage**: Hardware Security Module (HSM) or managed key service
3. **Rotation**: Automatic 90-day rotation with versioning
4. **Revocation**: Immediate revocation capability for compromised keys
5. **Archival**: Secure archival for decryption of historical data

**Key Access Control:**
- Principle of least privilege
- Role-based key access
- Audit logging of all key operations
- Separation of duties (key generation vs. usage)

### 1.4 Authentication & Authorization

**Authentication Methods:**

1. **Primary: JWT-Based Authentication**
   - Token Expiration: 1 hour
   - Refresh Token Expiration: 7 days
   - Token Signing: RS256 (RSA with SHA-256)
   - Token Storage: Secure HTTP-only cookies (web), Keychain (mobile)

2. **Multi-Factor Authentication (MFA)**
   - TOTP (Time-based One-Time Password) via authenticator apps
   - SMS-based OTP (optional, less secure)
   - Backup codes for account recovery
   - MFA enforcement for admin and principal roles

3. **OAuth 2.0 Integration (Optional)**
   - Google Workspace integration for schools
   - Microsoft Azure AD integration
   - SAML 2.0 support for enterprise SSO

**Authorization Model:**

```
User → Role → Permissions → Resources

Example:
Teacher → Teacher Role → [grade:read, grade:write, attendance:read] → Grade/Attendance Data
```

**Role Definitions:**

| Role | Permissions | Data Access |
|------|-------------|-------------|
| **Super Admin** | All system permissions | All tenants, all data |
| **Tenant Admin** | Tenant-level management | Own tenant only |
| **Principal** | Academic & user management | Own school data |
| **Teacher** | Grade/attendance entry | Assigned classes only |
| **Student** | View own data | Own records only |
| **Parent** | View child data | Child's records only |
| **Accountant** | Financial management | Financial data only |
| **Librarian** | Library management | Library data only |

**Permission Matrix:**

```
Resource: Student Records
├── student:read (view student info)
├── student:write (edit student info)
├── student:delete (deactivate student)
├── student:export (export student data)
└── student:import (bulk import students)

Resource: Grades
├── grade:read (view grades)
├── grade:write (enter/edit grades)
├── grade:delete (delete grades)
├── grade:export (export grades)
└── grade:approve (approve grade submissions)

Resource: Attendance
├── attendance:read (view attendance)
├── attendance:write (mark attendance)
├── attendance:export (export attendance)
└── attendance:report (generate reports)

Resource: Financial
├── fee:read (view fees)
├── fee:write (create/edit fees)
├── payment:read (view payments)
├── payment:write (record payments)
├── payment:refund (process refunds)
└── financial:report (financial reports)

Resource: User Management
├── user:read (view users)
├── user:write (create/edit users)
├── user:delete (deactivate users)
├── role:read (view roles)
├── role:write (create/edit roles)
└── role:delete (delete roles)

Resource: System
├── system:config (system configuration)
├── system:audit (view audit logs)
├── system:backup (manage backups)
└── system:security (security settings)
```

### 1.5 Session Management

**Session Security:**
- Session Timeout: 30 minutes of inactivity
- Absolute Session Timeout: 8 hours
- Concurrent Session Limit: 3 active sessions per user
- Session Invalidation: On logout, password change, role change
- Session Storage: Server-side with Redis
- Session ID: Cryptographically random, 32+ bytes

**Session Fixation Prevention:**
- New session ID on login
- Session ID rotation on privilege escalation
- Secure session cookies (HttpOnly, Secure, SameSite=Strict)

---

## 2. Threat Model

### 2.1 Threat Categories

**A. Authentication & Access Control Threats**

| Threat | Severity | Mitigation |
|--------|----------|-----------|
| Brute Force Attack | High | Rate limiting, account lockout after 5 failed attempts, CAPTCHA |
| Credential Stuffing | High | Password breach monitoring, MFA enforcement, session monitoring |
| Privilege Escalation | Critical | RBAC enforcement, audit logging, permission validation |
| Session Hijacking | High | Secure cookies, HTTPS only, session rotation, IP validation |
| Unauthorized API Access | High | API key validation, rate limiting, request signing |

**B. Data Protection Threats**

| Threat | Severity | Mitigation |
|--------|----------|-----------|
| Data Breach | Critical | Encryption at rest/transit, access controls, audit logging |
| SQL Injection | Critical | Parameterized queries, input validation, ORM usage |
| Cross-Site Scripting (XSS) | High | Input sanitization, output encoding, CSP headers |
| Cross-Site Request Forgery (CSRF) | High | CSRF tokens, SameSite cookies, origin validation |
| Insecure Deserialization | High | Input validation, safe deserialization libraries |

**C. Infrastructure Threats**

| Threat | Severity | Mitigation |
|--------|----------|-----------|
| DDoS Attack | High | DDoS protection service, rate limiting, auto-scaling |
| Man-in-the-Middle (MITM) | High | TLS 1.3, certificate pinning, HSTS |
| Unauthorized Server Access | Critical | VPC isolation, firewall rules, SSH key management |
| Malware/Ransomware | High | Endpoint protection, file integrity monitoring, backups |
| Insider Threat | Medium | Audit logging, access controls, data classification |

**D. Application Threats**

| Threat | Severity | Mitigation |
|--------|----------|-----------|
| Insecure Direct Object Reference (IDOR) | High | Authorization checks, object ownership validation |
| Broken Access Control | Critical | RBAC enforcement, permission validation on every request |
| Security Misconfiguration | High | Security hardening, configuration management, scanning |
| Sensitive Data Exposure | Critical | Encryption, access controls, data classification |
| Insufficient Logging | High | Comprehensive audit logging, log retention, monitoring |

### 2.2 Attack Scenarios & Responses

**Scenario 1: Unauthorized Grade Modification**
- Attack: Teacher modifies another teacher's grades
- Detection: Audit log shows unauthorized modification
- Response: Revert changes, notify principal, investigate user account
- Prevention: RBAC enforcement, audit logging, approval workflows

**Scenario 2: Cross-Tenant Data Access**
- Attack: User from Tenant A accesses Tenant B data
- Detection: Audit log shows cross-tenant access attempt
- Response: Block access, revoke session, investigate
- Prevention: Row-level security, tenant_id validation, database policies

**Scenario 3: Payment Tampering**
- Attack: Student modifies payment amount before submission
- Detection: Payment validation, amount mismatch detection
- Response: Reject transaction, log attempt, notify accountant
- Prevention: Server-side validation, encryption, digital signatures

---

## 3. OWASP Top 10 Compliance

### 3.1 A01:2021 – Broken Access Control

**Status:** ✅ Mitigated

**Controls:**
- Role-based access control (RBAC) with granular permissions
- Authorization checks on every API endpoint
- Object ownership validation (users can only access their own data)
- Audit logging of all access attempts
- Regular access control reviews

**Testing:**
- Attempt to access resources without proper role
- Attempt to modify other users' data
- Attempt to escalate privileges
- Attempt cross-tenant access

### 3.2 A02:2021 – Cryptographic Failures

**Status:** ✅ Mitigated

**Controls:**
- AES-256-GCM encryption for sensitive data at rest
- TLS 1.3 for data in transit
- Secure key management with HSM/KMS
- 90-day key rotation
- No hardcoded secrets or credentials

**Testing:**
- Verify encryption of sensitive fields
- Verify TLS configuration
- Verify key rotation process
- Attempt to access unencrypted data

### 3.3 A03:2021 – Injection

**Status:** ✅ Mitigated

**Controls:**
- Parameterized queries for all database operations
- Input validation and sanitization
- ORM usage (Sequelize/TypeORM) to prevent SQL injection
- Output encoding for HTML/JavaScript
- Command injection prevention for system calls

**Testing:**
- SQL injection attempts in all input fields
- NoSQL injection attempts
- Command injection attempts
- LDAP injection attempts

### 3.4 A04:2021 – Insecure Design

**Status:** ✅ Mitigated

**Controls:**
- Threat modeling and security architecture review
- Secure design patterns (defense in depth)
- Security requirements in design phase
- Regular security architecture reviews
- Secure coding guidelines

**Testing:**
- Design review for security flaws
- Threat modeling validation
- Security requirement verification

### 3.5 A05:2021 – Security Misconfiguration

**Status:** ✅ Mitigated

**Controls:**
- Security hardening guidelines
- Infrastructure-as-code for consistent configuration
- Automated security scanning
- Minimal default permissions
- Regular configuration audits
- Security headers (CSP, HSTS, X-Frame-Options, etc.)

**Testing:**
- Scan for default credentials
- Scan for unnecessary services
- Verify security headers
- Check for debug mode in production

### 3.6 A06:2021 – Vulnerable and Outdated Components

**Status:** ✅ Mitigated

**Controls:**
- Dependency scanning (npm audit, Snyk)
- Regular dependency updates
- Vulnerability monitoring
- Software composition analysis (SCA)
- Patch management process
- Version pinning for critical dependencies

**Testing:**
- Run dependency vulnerability scans
- Check for outdated packages
- Verify patch application

### 3.7 A07:2021 – Identification and Authentication Failures

**Status:** ✅ Mitigated

**Controls:**
- Strong password requirements (12+ chars, complexity)
- Password hashing with bcrypt (cost factor 12+)
- Multi-factor authentication (TOTP)
- Account lockout after 5 failed attempts
- Session management with secure cookies
- JWT token expiration (1 hour)
- Secure password reset process

**Testing:**
- Attempt weak password registration
- Attempt brute force login
- Verify MFA enforcement
- Test session timeout
- Test password reset flow

### 3.8 A08:2021 – Software and Data Integrity Failures

**Status:** ✅ Mitigated

**Controls:**
- Code signing for releases
- Secure CI/CD pipeline
- Dependency verification
- Secure update mechanism
- Integrity checking for critical data
- Digital signatures for important transactions

**Testing:**
- Verify code signing
- Test update mechanism
- Verify data integrity checks

### 3.9 A09:2021 – Logging and Monitoring Failures

**Status:** ✅ Mitigated

**Controls:**
- Comprehensive audit logging
- Centralized log management
- Real-time alerting for security events
- Log retention (2 years minimum)
- Log integrity protection
- Monitoring for suspicious activities
- Incident response procedures

**Testing:**
- Verify audit logs are created
- Verify log retention
- Test alerting mechanism
- Verify log integrity

### 3.10 A10:2021 – Server-Side Request Forgery (SSRF)

**Status:** ✅ Mitigated

**Controls:**
- Input validation for URLs
- Whitelist allowed domains
- Disable dangerous protocols (file://, gopher://)
- Network segmentation
- Firewall rules for outbound requests
- Rate limiting for external requests

**Testing:**
- Attempt SSRF attacks
- Verify URL validation
- Test network segmentation

---

## 4. Data Classification & Handling

### 4.1 Data Classification Levels

**Level 1: Public**
- School name, address, phone number
- General school policies
- Public announcements
- Non-sensitive academic information

**Level 2: Internal**
- Staff directory (internal use only)
- Internal policies and procedures
- General operational data
- Non-sensitive business information

**Level 3: Confidential**
- Student names, contact information
- Grades and academic performance
- Attendance records
- Class schedules
- Teacher assignments

**Level 4: Restricted (Highly Sensitive)**
- Student SSN/ID numbers
- Student medical/health information
- Student disciplinary records
- Financial/payment information
- Parent/guardian contact information
- Student photos and biometric data

### 4.2 Data Handling Requirements

| Classification | Encryption | Access Control | Audit Logging | Retention |
|---|---|---|---|---|
| Public | Not required | Minimal | Optional | As needed |
| Internal | Recommended | Role-based | Required | 1 year |
| Confidential | Required | Strict RBAC | Required | 3 years |
| Restricted | Required | Very strict RBAC | Required | 5 years |

### 4.3 Sensitive Data Fields

**Student Records:**
- SSN/National ID: Encrypted, masked in UI (show last 4 digits only)
- Date of Birth: Encrypted, age calculated server-side
- Contact Information: Encrypted, access restricted to authorized staff
- Medical Information: Encrypted, access restricted to health staff
- Photos: Encrypted, access restricted to authorized staff

**Financial Records:**
- Payment Card Data: Never stored (use tokenization)
- Bank Account Details: Encrypted, access restricted to finance staff
- Transaction History: Encrypted, audit logged

**User Credentials:**
- Passwords: Hashed with bcrypt (cost factor 12+), never stored in plain text
- API Keys: Hashed, rotated regularly
- Session Tokens: Secure, short-lived, invalidated on logout

---

## 5. Audit & Compliance Logging

### 5.1 Audit Log Requirements

**What to Log:**
- User authentication (login, logout, failed attempts)
- Authorization decisions (access granted/denied)
- Data modifications (create, update, delete)
- Data access (read operations on sensitive data)
- Configuration changes
- System events (errors, warnings)
- Security events (suspicious activities)

**Audit Log Format:**
```json
{
  "audit_id": "uuid",
  "timestamp": "2024-01-15T10:30:00Z",
  "tenant_id": "tenant_uuid",
  "user_id": "user_uuid",
  "action": "grade:write",
  "entity_type": "Grade",
  "entity_id": "grade_uuid",
  "old_values": {
    "grade_value": 85,
    "letter_grade": "B"
  },
  "new_values": {
    "grade_value": 90,
    "letter_grade": "A"
  },
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "status": "success",
  "error_message": null
}
```

**Audit Log Retention:**
- Minimum: 2 years
- Recommended: 5 years for financial records
- Compliance: FERPA (5 years), GDPR (varies by purpose)
- Archival: Move to cold storage after 1 year
- Deletion: Secure deletion after retention period

### 5.2 Compliance Reporting

**Available Reports:**
- User access reports (who accessed what, when)
- Data modification reports (what changed, by whom)
- Failed authentication attempts
- Permission changes
- System configuration changes
- Data export/download activity
- Compliance audit trail

**Report Generation:**
- On-demand report generation
- Scheduled reports (daily, weekly, monthly)
- Export formats: PDF, CSV, JSON
- Digital signatures for report integrity

---

## 6. Incident Response

### 6.1 Incident Response Plan

**Incident Categories:**
1. **Critical**: Data breach, system compromise, ransomware
2. **High**: Unauthorized access, data loss, service outage
3. **Medium**: Security misconfiguration, failed security control
4. **Low**: Policy violation, minor security issue

**Response Procedures:**

**Phase 1: Detection & Analysis**
- Identify incident type and severity
- Gather initial information
- Activate incident response team
- Notify stakeholders

**Phase 2: Containment**
- Isolate affected systems
- Prevent further damage
- Preserve evidence
- Implement temporary fixes

**Phase 3: Investigation**
- Determine root cause
- Identify affected data/users
- Assess impact
- Document findings

**Phase 4: Remediation**
- Implement permanent fixes
- Restore systems
- Verify security controls
- Update security measures

**Phase 5: Recovery**
- Restore normal operations
- Monitor for recurrence
- Communicate with stakeholders
- Document lessons learned

**Phase 6: Post-Incident**
- Conduct post-mortem
- Update security policies
- Implement preventive measures
- Train staff on lessons learned

### 6.2 Breach Notification

**Notification Requirements:**
- Notify affected users within 72 hours (GDPR requirement)
- Notify regulatory authorities if required
- Provide clear information about:
  - What data was compromised
  - When the breach occurred
  - What steps users should take
  - Contact information for questions

**Notification Template:**
```
Subject: Important Security Notice - Data Breach Notification

Dear [User],

We are writing to inform you of a security incident that may have affected your personal information.

Incident Details:
- Date Discovered: [Date]
- Data Affected: [List of data types]
- Number of Records: [Number]
- Potential Impact: [Description]

Actions We Have Taken:
- [Action 1]
- [Action 2]
- [Action 3]

What You Should Do:
- [Recommendation 1]
- [Recommendation 2]
- [Recommendation 3]

For More Information:
- Contact: [Email/Phone]
- Website: [URL]

Sincerely,
[Organization Name]
```

---

## 7. Security Testing & Validation

### 7.1 Security Testing Schedule

**Continuous (Every Commit):**
- Static Application Security Testing (SAST)
- Dependency vulnerability scanning
- Code quality analysis

**Weekly:**
- Dynamic Application Security Testing (DAST)
- API security testing
- Configuration scanning

**Monthly:**
- Penetration testing (internal)
- Security code review
- Vulnerability assessment

**Quarterly:**
- Third-party penetration testing
- Security architecture review
- Compliance audit

**Annually:**
- Full security assessment
- Disaster recovery testing
- Security training

### 7.2 Security Testing Tools

**SAST (Static Analysis):**
- SonarQube for code quality
- Snyk for dependency vulnerabilities
- ESLint with security plugins

**DAST (Dynamic Analysis):**
- OWASP ZAP for API testing
- Burp Suite for web application testing
- Postman for API security testing

**Infrastructure:**
- Nessus for vulnerability scanning
- Qualys for cloud security
- CloudMapper for AWS security

**Dependency Management:**
- npm audit for Node.js dependencies
- Snyk for continuous monitoring
- OWASP Dependency-Check

### 7.3 Security Metrics

**Key Security Metrics:**
- Mean Time to Detect (MTTD): < 1 hour
- Mean Time to Respond (MTTR): < 4 hours
- Mean Time to Resolve (MTTR): < 24 hours
- Vulnerability remediation rate: 100% within 30 days
- Security test coverage: 100% of critical paths
- Incident response time: < 1 hour for critical incidents

---

## 8. Security Policies & Standards

### 8.1 Password Policy

**Requirements:**
- Minimum length: 12 characters
- Complexity: Must include uppercase, lowercase, numbers, special characters
- History: Cannot reuse last 5 passwords
- Expiration: 90 days (with warning at 80 days)
- Lockout: 5 failed attempts → 30-minute lockout
- Reset: Secure reset link valid for 24 hours

### 8.2 API Security Policy

**Requirements:**
- All APIs must use HTTPS/TLS 1.3
- API authentication required (JWT or API key)
- Rate limiting: 1000 requests/hour per user
- Request validation: All inputs validated
- Response validation: All outputs encoded
- Error handling: No sensitive information in error messages
- Versioning: API versioning for backward compatibility

### 8.3 Code Security Policy

**Requirements:**
- All code must pass SAST scanning
- No hardcoded secrets or credentials
- No SQL injection vulnerabilities
- No XSS vulnerabilities
- No CSRF vulnerabilities
- Security code review required before merge
- Dependency vulnerabilities must be resolved

### 8.4 Infrastructure Security Policy

**Requirements:**
- All data encrypted at rest (AES-256)
- All data encrypted in transit (TLS 1.3)
- Firewall rules: Deny by default, allow by exception
- VPC isolation: Separate VPCs for dev/staging/production
- SSH: Key-based authentication only, no passwords
- Patch management: Security patches within 7 days
- Backup encryption: Same standard as production data

---

## 9. Compliance Frameworks

### 9.1 FERPA (Family Educational Rights and Privacy Act)

**Applicability:** US schools and educational institutions

**Key Requirements:**
- Student records are confidential
- Parents/students have right to access records
- Written consent required for disclosure
- Audit trail of record access
- Secure storage and transmission
- Data retention policies

**Implementation:**
- Access controls for student records
- Audit logging of all access
- Consent management system
- Data retention policies (5 years minimum)
- Secure data disposal procedures

### 9.2 GDPR (General Data Protection Regulation)

**Applicability:** EU residents' data

**Key Requirements:**
- Lawful basis for data processing
- Data subject rights (access, deletion, portability)
- Data protection by design
- Data breach notification (72 hours)
- Data Protection Impact Assessment (DPIA)
- Data Processing Agreement (DPA)

**Implementation:**
- Consent management system
- Data subject rights portal
- Data export functionality
- Data deletion functionality
- DPIA for high-risk processing
- DPA with all data processors

### 9.3 CCPA (California Consumer Privacy Act)

**Applicability:** California residents' data

**Key Requirements:**
- Right to know what data is collected
- Right to delete personal information
- Right to opt-out of data sales
- Right to non-discrimination
- Privacy policy requirements

**Implementation:**
- Privacy policy with CCPA disclosures
- Data subject rights portal
- Opt-out mechanism
- Data deletion functionality
- Non-discrimination in pricing/service

### 9.4 COPPA (Children's Online Privacy Protection Act)

**Applicability:** Children under 13 in the US

**Key Requirements:**
- Parental consent required
- Limited data collection
- No behavioral advertising
- Secure data storage
- Data deletion capability

**Implementation:**
- Age verification
- Parental consent system
- Limited data collection
- No third-party tracking
- Secure data storage

---

## 10. Security Checklist

### Pre-Deployment Security Checklist

- [ ] All OWASP Top 10 controls implemented
- [ ] SAST scanning passed with no critical/high issues
- [ ] DAST testing completed
- [ ] Dependency vulnerabilities resolved
- [ ] Security code review completed
- [ ] Encryption configured (at rest and in transit)
- [ ] Authentication and authorization tested
- [ ] Audit logging configured
- [ ] Rate limiting configured
- [ ] Security headers configured
- [ ] CORS policy configured
- [ ] API documentation includes security requirements
- [ ] Incident response plan documented
- [ ] Backup and recovery tested
- [ ] Disaster recovery plan documented
- [ ] Security training completed
- [ ] Compliance requirements verified
- [ ] Third-party security assessment completed
- [ ] Penetration testing completed
- [ ] Security sign-off obtained

### Ongoing Security Checklist

- [ ] Weekly vulnerability scans completed
- [ ] Monthly penetration testing completed
- [ ] Quarterly security assessment completed
- [ ] Annual third-party audit completed
- [ ] Security patches applied within 7 days
- [ ] Audit logs reviewed for anomalies
- [ ] Access controls reviewed quarterly
- [ ] Incident response drills conducted
- [ ] Security training updated annually
- [ ] Compliance requirements reviewed annually

---

## 11. Security Contacts & Escalation

**Security Team:**
- Chief Security Officer (CSO): [Email/Phone]
- Security Lead: [Email/Phone]
- Incident Response Lead: [Email/Phone]

**Escalation Path:**
1. Security team (immediate)
2. Engineering lead (within 1 hour)
3. CTO (within 2 hours)
4. CEO (within 4 hours for critical incidents)

**External Contacts:**
- Legal counsel: [Email/Phone]
- Compliance officer: [Email/Phone]
- Insurance provider: [Email/Phone]

---

## Appendix: Security Standards Reference

- NIST Cybersecurity Framework
- ISO 27001 Information Security Management
- CIS Controls
- OWASP Top 10
- SANS Top 25
- PCI DSS (if handling payment cards)
- SOC 2 Type II compliance

