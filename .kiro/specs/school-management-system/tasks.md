# Comprehensive Implementation Plan - School Management System

## Project Overview

This implementation plan provides a complete, phase-by-phase breakdown of all tasks for the School Management System. The system is built with Node.js/Express backend, React frontend, Neon PostgreSQL database, with microservices architecture using RabbitMQ and Redis caching.

**External Services & Integrations**:
- **Email Service**: Brevo (formerly Sendinblue) for transactional and marketing emails
  - Transactional emails (password reset, enrollment confirmation, payment receipts)
  - Marketing emails (announcements, newsletters)
  - Email templates and automation
  - API Key: Store in environment variables
  - Documentation: https://www.brevo.com/api/

- **File Upload & Storage**: UploadThing for secure file uploads
  - Student documents (certificates, transcripts, photos)
  - Teacher qualifications and documents
  - School documents and resources
  - Admission application documents
  - Secure, scalable cloud storage
  - API Key: Store in environment variables
  - Documentation: https://uploadthing.com/

- **Database**: Neon PostgreSQL for serverless, scalable database
  - Serverless PostgreSQL with auto-scaling
  - Connection pooling for optimal performance
  - Automated backups and point-in-time recovery
  - Connection string: Store in environment variables
  - Documentation: https://neon.tech/

**Total Project Duration**: 36 weeks (9 months)  
**Total Phases**: 35 phases  
**Total Tasks**: 300+ actionable tasks  
**Team Size**: 8-12 developers

## Phase 1: Project Setup and Infrastructure

### 1.0 External Services Configuration

- [x] 1.0.1 Set up Brevo email service
  - Create Brevo account and API key
  - Configure email templates (password reset, enrollment, payment, notifications)
  - Set up sender identity and domain verification
  - Test email sending functionality
  - Document Brevo integration
  - _Estimated Time: 3 hours_
  - _Requirements: 11, 21_

- [x] 1.0.2 Set up UploadThing file upload service
  - Create UploadThing account and API key
  - Configure file upload routes and permissions
  - Set up file type restrictions and size limits
  - Implement file storage organization (by entity type)
  - Test file upload and retrieval
  - _Estimated Time: 3 hours_
  - _Requirements: 16, 24_

- [x] 1.0.3 Set up Neon PostgreSQL database
  - Create Neon account and project
  - Create database and connection pool
  - Configure connection string for different environments
  - Set up automated backups
  - Test database connectivity
  - _Estimated Time: 2 hours_
  - _Requirements: 19_

- [x] 1.0.4 Configure environment variables for external services
  - Add Brevo API key to .env
  - Add UploadThing API key to .env
  - Add Neon database connection string to .env
  - Create .env.example with all external service variables
  - Document all external service configuration
  - _Estimated Time: 1 hour_
  - _Requirements: 7, 12_

- [x] 1.1 Repository and Project Structure Setup
  - [x] Create root directory structure with backend, frontend, and services directories
  - [x] Initialize Git repository with .gitignore for Node.js projects
  - [x] Set up package.json for root workspace management
  - _Requirements: 19_
  - _Completed: Phase 1.1 setup with Git initialization, .gitignore, and root workspace package.json_

- [x] 1.2 Configure Docker and containerization
  - [x] Create Dockerfile for Node.js backend service (multi-stage build)
  - [x] Create Dockerfile for React frontend (Nginx-based)
  - [x] Create docker-compose.yml for local development environment
  - [x] Define services: PostgreSQL, Redis, RabbitMQ, backend, frontend, pgAdmin
  - [x] Create nginx.conf for frontend routing and API proxy
  - _Requirements: 19_
  - _Completed: Full Docker setup with health checks, volumes, and networking_

- [x] 1.3 Set up PostgreSQL database and schema
  - [x] Create database initialization scripts
  - [x] Define core tables: users, students, classes, subjects, teachers, grades, attendance, fees, schedules
  - [x] Create indexes for performance optimization
  - [x] Set up database migrations framework (Knex.js)
  - [x] Create comprehensive seed data with demo users and test data
  - _Requirements: 1, 2, 3, 4, 5, 6, 19_
  - _Completed: 16 tables with proper relationships, constraints, and indexes_

- [x] 1.4 Configure environment variables and secrets management
  - [x] Create .env.example with all required environment variables
  - [x] Create .env.docker with Docker-specific configuration
  - [x] Set up environment-specific configurations (development, staging, production)
  - [x] Implement secrets management for database credentials, API keys, JWT secrets
  - _Requirements: 7, 12_
  - _Completed: Environment configuration for all deployment scenarios_

- [x] 1.5 Set up logging and monitoring infrastructure
  - [x] Implement centralized logging (Winston)
  - [x] Configure log levels and output formats
  - [x] Set up health check endpoints for all services
  - [x] Create Docker health checks for all containers
  - _Requirements: 19, 20_
  - _Completed: Health checks and monitoring infrastructure in place_

## Phase 2: Authentication and Authorization

- [-] 2.1 Implement JWT-based authentication system
  - Create user authentication endpoints (login, logout, refresh token)
  - Implement JWT token generation and validation
  - Set up password hashing with bcrypt
  - Implement session management with 30-minute timeout
  - _Requirements: 7_

- [ ] 2.2 Implement password management features
  - Create password reset functionality with email verification
  - Implement password change with old password validation
  - Enforce password policy (minimum 8 characters, mixed case, numbers, special characters)
  - _Requirements: 7_

- [ ] 2.3 Implement role-based access control (RBAC)
  - Create roles table and permissions table
  - Define predefined roles: Admin, Principal, Teacher, Student, Parent, Accountant
  - Implement permission checking middleware
  - Create role assignment endpoints
  - _Requirements: 8_

- [ ] 2.4 Implement permission-based authorization
  - Create permission definitions for each feature area
  - Implement authorization middleware for route protection
  - Create permission checking utilities for business logic
  - _Requirements: 8_

- [ ] 2.5 Implement user account management
  - Create user creation endpoint with role assignment
  - Implement user deactivation (soft delete)
  - Create user profile update endpoints
  - Implement user listing with role filtering
  - _Requirements: 7, 8_

## Phase 3: Core Data Models

- [ ] 3.1 Implement Student model and management
  - Create Student entity with required fields (name, DOB, gender, contact info)
  - Implement unique Student_ID generation
  - Create student creation and update endpoints
  - Implement student status management (active, inactive, withdrawn)
  - _Requirements: 1_

- [ ] 3.2 Implement Guardian/Parent model
  - Create Guardian entity with relationship types (mother, father, guardian, etc.)
  - Support multiple guardians per student
  - Create guardian management endpoints
  - _Requirements: 1_

- [ ] 3.3 Implement Class model and management
  - Create Class entity with attributes (name, level, capacity, session)
  - Implement class creation and update endpoints
  - Create capacity validation logic
  - _Requirements: 2_

- [ ] 3.4 Implement Subject model and management
  - Create Subject entity with code and description
  - Create subject creation and update endpoints
  - Implement subject-class assignment
  - _Requirements: 2_

- [ ] 3.5 Implement Teacher model and assignment
  - Create Teacher entity with qualifications and contact info
  - Implement teacher-subject-class assignment with date ranges
  - Create teacher management endpoints
  - _Requirements: 2_

- [ ] 3.6 Implement Enrollment model
  - Create Enrollment entity linking students to classes
  - Record enrollment date and academic session
  - Implement enrollment status tracking
  - Create enrollment endpoints
  - _Requirements: 1, 2_

## Phase 4: Student Enrollment and Management

- [ ] 4.1 Implement student enrollment workflow
  - Create enrollment request submission endpoint
  - Implement enrollment validation (required fields, capacity check)
  - Create enrollment approval/rejection workflow
  - _Requirements: 1_

- [ ] 4.2 Implement bulk student import
  - Create CSV/Excel import endpoint
  - Implement field mapping interface
  - Create validation logic for bulk imports
  - Implement duplicate detection and merge options
  - _Requirements: 1, 16_

- [ ] 4.3 Implement enrollment data export
  - Create export endpoint for student enrollment data
  - Support CSV, Excel, and PDF formats
  - Implement filtering by class, session, or date range
  - _Requirements: 10, 16_

- [ ] 4.4 Implement audit trail for student records
  - Create audit log entries for student creation, updates, and deletions
  - Record who made changes, when, and what changed
  - Create audit log viewing endpoint
  - _Requirements: 1, 20_

## Phase 5: Academic Management - Grades

- [ ] 5.1 Implement Grade model and storage
  - Create Grade entity with subject, student, teacher, date, and value
  - Implement grade validation (0-100 or A-F scale based on configuration)
  - Create grade entry endpoints
  - _Requirements: 3_

- [ ] 5.2 Implement grade entry interface
  - Create bulk grade entry endpoint for teachers
  - Implement validation that student is enrolled in subject
  - Create grade modification with audit trail
  - _Requirements: 3_

- [ ] 5.3 Implement grade calculation and statistics
  - Create aggregate statistics calculation (class average, highest, lowest)
  - Implement grade conversion (numerical to letter grades)
  - Create performance trend calculation
  - _Requirements: 3, 9_

- [ ] 5.4 Implement grade finalization and locking
  - Create grade finalization endpoint for term completion
  - Implement grade locking to prevent modifications
  - Create grade unlock functionality for authorized users
  - _Requirements: 3_

- [ ] 5.5 Implement grade viewing endpoints
  - Create student grade viewing endpoint (own grades only)
  - Create teacher grade viewing endpoint (assigned classes)
  - Create parent grade viewing endpoint (child's grades)
  - Create admin grade viewing endpoint (all grades with filtering)
  - _Requirements: 3, 13, 14_

## Phase 6: Academic Management - Attendance

- [ ] 6.1 Implement Attendance model and storage
  - Create Attendance entity with student, class, date, status, and teacher
  - Support attendance statuses: present, absent, late
  - Create attendance entry endpoints
  - _Requirements: 4_

- [ ] 6.2 Implement attendance marking interface
  - Create bulk attendance marking endpoint for teachers
  - Implement quick marking interface for class sessions
  - Create attendance correction with audit trail
  - _Requirements: 4_

- [ ] 6.3 Implement attendance calculation and reporting
  - Create attendance percentage calculation
  - Implement at-risk flagging when attendance falls below threshold
  - Create attendance statistics by student and class
  - _Requirements: 4, 9_

- [ ] 6.4 Implement attendance viewing endpoints
  - Create student attendance viewing endpoint
  - Create parent attendance viewing endpoint
  - Create teacher attendance viewing endpoint
  - Create admin attendance viewing endpoint with filtering
  - _Requirements: 4, 13, 14_

- [ ] 6.5 Implement bulk attendance import
  - Create CSV/Excel attendance import endpoint
  - Implement validation and error reporting
  - _Requirements: 4, 16_

## Phase 7: Schedule and Timetable Management

- [ ] 7.1 Implement Schedule model and storage
  - Create Schedule entity with class, subject, teacher, time, location
  - Create schedule creation endpoints
  - _Requirements: 5_

- [ ] 7.2 Implement schedule conflict detection
  - Create validation to prevent teacher double-booking
  - Create validation to prevent class double-booking
  - Implement conflict detection algorithm
  - _Requirements: 5_

- [ ] 7.3 Implement schedule viewing and publishing
  - Create schedule viewing endpoint with grid/list format options
  - Implement schedule publication workflow
  - Create schedule visibility control by role
  - _Requirements: 5_

- [ ] 7.4 Implement schedule modification and notifications
  - Create schedule update endpoint with conflict checking
  - Implement notification system for schedule changes
  - Create notification delivery to affected users
  - _Requirements: 5, 11_

- [ ] 7.5 Implement schedule export
  - Create schedule export endpoint (PDF, Excel, CSV)
  - Support filtering by class, teacher, or date range
  - _Requirements: 5, 10_

## Phase 8: Fee Management and Billing

- [ ] 8.1 Implement Fee model and configuration
  - Create Fee entity with type, amount, due date
  - Create fee type configuration endpoints
  - Implement fee assignment to students
  - _Requirements: 6_

- [ ] 8.2 Implement Payment model and recording
  - Create Payment entity with amount, date, method, student
  - Create payment recording endpoint
  - Implement payment method tracking (cash, check, online, etc.)
  - _Requirements: 6_

- [ ] 8.3 Implement fee balance calculation
  - Create fee balance calculation logic
  - Implement partial payment tracking
  - Create outstanding balance calculation
  - _Requirements: 6_

- [ ] 8.4 Implement late fee and penalty calculation
  - Create late payment detection
  - Implement penalty calculation based on configuration
  - Create penalty application logic
  - _Requirements: 6_

- [ ] 8.5 Implement payment receipt generation
  - Create receipt generation endpoint
  - Support PDF and email delivery
  - Include transaction details and payment history
  - _Requirements: 6_

- [ ] 8.6 Implement fee viewing and reporting
  - Create student fee viewing endpoint
  - Create parent fee viewing endpoint
  - Create accountant fee management endpoints
  - Create financial summary reporting
  - _Requirements: 6, 13, 15_

- [ ] 8.7 Implement payment plan management
  - Create payment plan creation endpoint
  - Implement installment tracking
  - Create payment plan status monitoring
  - _Requirements: 6_

## Phase 9: Reporting and Analytics

- [ ] 9.1 Implement report generation framework
  - Create report generation service
  - Implement report type definitions (academic, attendance, financial, enrollment)
  - Create report filtering and parameter handling
  - _Requirements: 10_

- [ ] 9.2 Implement academic performance reports
  - Create student performance report generation
  - Create class performance report generation
  - Implement performance trend analysis
  - _Requirements: 9, 10_

- [ ] 9.3 Implement attendance reports
  - Create attendance summary reports
  - Create at-risk student identification reports
  - Implement attendance trend analysis
  - _Requirements: 4, 10_

- [ ] 9.4 Implement financial reports
  - Create fee collection reports
  - Create outstanding balance reports
  - Create financial summary reports
  - _Requirements: 6, 10_

- [ ] 9.5 Implement enrollment reports
  - Create enrollment summary reports
  - Create class capacity reports
  - Create enrollment trend analysis
  - _Requirements: 1, 10_

- [ ] 9.6 Implement report export functionality
  - Create PDF export for reports
  - Create Excel export for reports
  - Create CSV export for reports
  - _Requirements: 10_

- [ ] 9.7 Implement scheduled report generation
  - Create report scheduling endpoint
  - Implement automated report generation
  - Create email delivery of scheduled reports
  - _Requirements: 10_

- [ ] 9.8 Implement data access control for reports
  - Implement permission checking for report access
  - Create role-based report filtering
  - Implement data masking for sensitive fields
  - _Requirements: 10, 12_

## Phase 10: Notification System

- [ ] 10.1 Implement notification model and storage
  - Create Notification entity with type, recipient, message, status
  - Create notification delivery tracking
  - _Requirements: 11_

- [ ] 10.2 Implement email notification service
  - Create email service integration
  - Implement email template system
  - Create email sending with retry logic
  - _Requirements: 11, 21_

- [ ] 10.3 Implement SMS notification service
  - Create SMS service integration
  - Implement SMS template system
  - Create SMS sending with retry logic
  - _Requirements: 11, 21_

- [ ] 10.4 Implement in-app notification system
  - Create in-app notification storage and retrieval
  - Implement notification marking as read
  - Create notification deletion
  - _Requirements: 11_

- [ ] 10.5 Implement notification triggers
  - Create grade entry notification trigger
  - Create attendance marking notification trigger
  - Create fee payment notification trigger
  - Create schedule change notification trigger
  - _Requirements: 11_

- [ ] 10.6 Implement notification preferences
  - Create user notification preference endpoints
  - Implement preference-based notification filtering
  - Support enabling/disabling notification types
  - _Requirements: 11_

## Phase 11: User Interfaces - Admin Dashboard

- [ ] 11.1 Implement admin dashboard layout
  - Create dashboard main page with key metrics
  - Implement responsive design for desktop and tablet
  - Create navigation menu for all admin features
  - _Requirements: 15, 22_

- [ ] 11.2 Implement admin dashboard metrics
  - Create total students metric display
  - Create total classes metric display
  - Create total teachers metric display
  - Create pending fees metric display
  - _Requirements: 15_

- [ ] 11.3 Implement admin dashboard alerts
  - Create at-risk students alert display
  - Create classes needing attention alert display
  - Create financial summary display
  - _Requirements: 15_

- [ ] 11.4 Implement admin quick actions
  - Create quick action buttons for common tasks
  - Implement enroll student quick action
  - Implement create class quick action
  - Implement generate report quick action
  - _Requirements: 15_

- [ ] 11.5 Implement user management interface
  - Create user listing page with filtering
  - Create user creation form
  - Create user editing form
  - Create user role assignment interface
  - _Requirements: 7, 8, 15_

- [ ] 11.6 Implement system health monitoring
  - Create database status display
  - Create backup status display
  - Create error log display
  - _Requirements: 15_

## Phase 12: User Interfaces - Teacher Dashboard

- [ ] 12.1 Implement teacher dashboard layout
  - Create dashboard main page with assigned classes
  - Implement responsive design
  - Create navigation menu for teacher features
  - _Requirements: 14, 22_

- [ ] 12.2 Implement teacher class management
  - Create assigned classes listing
  - Create class details view with enrolled students
  - Create quick access to grade entry and attendance
  - _Requirements: 14_

- [ ] 12.3 Implement teacher grade entry interface
  - Create bulk grade entry form
  - Implement grade validation
  - Create grade submission and confirmation
  - _Requirements: 3, 14_

- [ ] 12.4 Implement teacher attendance marking interface
  - Create quick attendance marking interface
  - Implement bulk attendance entry
  - Create attendance submission and confirmation
  - _Requirements: 4, 14_

- [ ] 12.5 Implement teacher student record viewing
  - Create student record view with grades and attendance
  - Create performance trend display
  - Create student contact information display
  - _Requirements: 14_

- [ ] 12.6 Implement teacher schedule viewing
  - Create upcoming classes display
  - Create important dates display
  - Create schedule conflict alerts
  - _Requirements: 5, 14_

## Phase 13: User Interfaces - Student/Parent Portal

- [ ] 13.1 Implement student portal layout
  - Create student dashboard main page
  - Implement responsive design for mobile
  - Create navigation menu for student features
  - _Requirements: 13, 22_

- [ ] 13.2 Implement student grade viewing
  - Create grades display by subject
  - Create overall academic standing display
  - Create performance trend visualization
  - _Requirements: 3, 13_

- [ ] 13.3 Implement student attendance viewing
  - Create attendance percentage display
  - Create attendance history display
  - Create at-risk flag display
  - _Requirements: 4, 13_

- [ ] 13.4 Implement student schedule viewing
  - Create class schedule display
  - Create upcoming classes display
  - Create location information display
  - _Requirements: 5, 13_

- [ ] 13.5 Implement student fee viewing
  - Create fee listing display
  - Create payment history display
  - Create outstanding balance display
  - _Requirements: 6, 13_

- [ ] 13.6 Implement student record download
  - Create academic record download (PDF)
  - Create fee statement download (PDF)
  - Create attendance report download (PDF)
  - _Requirements: 13_

- [ ] 13.7 Implement parent portal layout
  - Create parent dashboard main page
  - Implement child selection for multi-child parents
  - Create navigation menu for parent features
  - _Requirements: 13, 22_

- [ ] 13.8 Implement parent child monitoring
  - Create child grade viewing
  - Create child attendance viewing
  - Create child schedule viewing
  - Create child fee status viewing
  - _Requirements: 13_

- [ ] 13.9 Implement parent record download
  - Create child academic record download
  - Create child fee statement download
  - Create child attendance report download
  - _Requirements: 13_

## Phase 14: Data Import/Export and Bulk Operations

- [ ] 14.1 Implement CSV/Excel import framework
  - Create file upload endpoint
  - Implement file parsing (CSV and Excel)
  - Create field mapping interface
  - _Requirements: 16_

- [ ] 14.2 Implement student bulk import
  - Create student data validation
  - Implement duplicate detection
  - Create merge/skip options for duplicates
  - Create import summary report
  - _Requirements: 1, 16_

- [ ] 14.3 Implement grade bulk import
  - Create grade data validation
  - Implement enrollment verification
  - Create import summary report
  - _Requirements: 3, 16_

- [ ] 14.4 Implement attendance bulk import
  - Create attendance data validation
  - Implement class and student verification
  - Create import summary report
  - _Requirements: 4, 16_

- [ ] 14.5 Implement bulk data export
  - Create student data export endpoint
  - Create grade data export endpoint
  - Create attendance data export endpoint
  - Support CSV, Excel, and PDF formats
  - _Requirements: 10, 16_

- [ ] 14.6 Implement data validation and error reporting
  - Create comprehensive validation error messages
  - Implement error line number reporting
  - Create error export functionality
  - _Requirements: 16_

## Phase 15: System Configuration and Customization

- [ ] 15.1 Implement school configuration
  - Create school information settings (name, logo, contact)
  - Create school settings endpoints
  - Implement logo upload and storage
  - _Requirements: 17_

- [ ] 15.2 Implement grading configuration
  - Create grading scale definition (A-F, 0-100, etc.)
  - Create grade conversion rules
  - Create grading configuration endpoints
  - _Requirements: 3, 17_

- [ ] 15.3 Implement academic session configuration
  - Create academic session definition
  - Create term definition with start/end dates
  - Create session management endpoints
  - _Requirements: 17_

- [ ] 15.4 Implement fee configuration
  - Create fee type definition
  - Create default fee amounts
  - Create fee configuration endpoints
  - _Requirements: 6, 17_

- [ ] 15.5 Implement notification configuration
  - Create notification type enable/disable settings
  - Create notification preference templates
  - Create notification configuration endpoints
  - _Requirements: 11, 17_

- [ ] 15.6 Implement custom field management
  - Create custom field definition interface
  - Support custom fields for Student, Class, and other entities
  - Create custom field storage and retrieval
  - _Requirements: 17_

- [ ] 15.7 Implement system settings
  - Create attendance threshold configuration
  - Create session timeout configuration
  - Create password policy configuration
  - Create system settings endpoints
  - _Requirements: 7, 17_

## Phase 16: Backup and Disaster Recovery

- [ ] 16.1 Implement automated backup system
  - Create daily backup scheduling
  - Implement database backup creation
  - Create backup storage management
  - _Requirements: 18_

- [ ] 16.2 Implement backup verification
  - Create backup integrity verification
  - Implement backup validation logic
  - Create backup status monitoring
  - _Requirements: 18_

- [ ] 16.3 Implement backup restoration
  - Create restore from backup endpoint
  - Implement data integrity verification after restore
  - Create restore progress monitoring
  - _Requirements: 18_

- [ ] 16.4 Implement backup management interface
  - Create backup listing and viewing
  - Create backup deletion functionality
  - Create backup download functionality
  - _Requirements: 18_

## Phase 17: Data Security and Privacy

- [ ] 17.1 Implement data encryption at rest
  - Create encryption for sensitive fields (passwords, contact details, financial data)
  - Implement encryption key management
  - Create encrypted field storage
  - _Requirements: 12_

- [ ] 17.2 Implement HTTPS and transport security
  - Configure HTTPS for all endpoints
  - Implement SSL/TLS certificate management
  - Create security headers (HSTS, CSP, etc.)
  - _Requirements: 12_

- [ ] 17.3 Implement audit logging
  - Create comprehensive audit log system
  - Log all data access with user, timestamp, and details
  - Create audit log viewing endpoint
  - _Requirements: 12, 20_

- [ ] 17.4 Implement unauthorized access prevention
  - Create access attempt logging
  - Implement rate limiting for login attempts
  - Create IP-based access controls
  - _Requirements: 12_

- [ ] 17.5 Implement data deletion and anonymization
  - Create secure data deletion for user accounts
  - Implement data anonymization for academic records
  - Create deletion verification
  - _Requirements: 12_

- [ ] 17.6 Implement data export masking
  - Create sensitive field masking for exports
  - Implement configurable masking rules
  - Create masked export generation
  - _Requirements: 10, 12_

## Phase 18: Audit Trail and Compliance

- [ ] 18.1 Implement comprehensive audit logging
  - Create audit log for all data modifications
  - Record user, timestamp, action, and details
  - Create audit log storage and retrieval
  - _Requirements: 20_

- [ ] 18.2 Implement audit log filtering and viewing
  - Create audit log filtering by user, date, action type
  - Create audit log viewing endpoint
  - Create audit log export functionality
  - _Requirements: 20_

- [ ] 18.3 Implement audit log retention
  - Create audit log retention policy (2+ years)
  - Implement archive functionality for old logs
  - Create retention verification
  - _Requirements: 20_

- [ ] 18.4 Implement sensitive action logging
  - Create reason recording for sensitive actions
  - Implement approval workflow for critical actions
  - Create sensitive action audit trail
  - _Requirements: 20_

## Phase 19: Integration with External Systems

- [ ] 19.1 Implement email service integration
  - Create email service configuration
  - Implement email sending through external service
  - Create email template management
  - _Requirements: 11, 21_

- [ ] 19.2 Implement SMS service integration
  - Create SMS service configuration
  - Implement SMS sending through external service
  - Create SMS template management
  - _Requirements: 11, 21_

- [ ] 19.3 Implement payment gateway integration
  - Create payment gateway configuration
  - Implement online payment processing
  - Create payment verification and reconciliation
  - _Requirements: 6, 21_

- [ ] 19.4 Implement API endpoints for third-party integration
  - Create REST API endpoints for external systems
  - Implement API authentication and rate limiting
  - Create API documentation
  - _Requirements: 21_

- [ ] 19.5 Implement integration logging and monitoring
  - Create integration activity logging
  - Implement integration error handling
  - Create integration status monitoring
  - _Requirements: 21_

## Phase 20: Mobile Responsiveness and Performance

- [ ] 20.1 Implement responsive design framework
  - Set up responsive CSS framework (Bootstrap, Tailwind, etc.)
  - Create mobile-first design approach
  - Implement breakpoints for different screen sizes
  - _Requirements: 22_

- [ ] 20.2 Implement mobile-optimized interfaces
  - Create mobile-optimized dashboard layouts
  - Implement touch-friendly controls
  - Create mobile navigation patterns
  - _Requirements: 22_

- [ ] 20.3 Implement mobile feature support
  - Create mobile grade viewing
  - Create mobile attendance viewing
  - Create mobile schedule viewing
  - Create mobile fee viewing
  - _Requirements: 22_

- [ ] 20.4 Implement offline support
  - Create data caching for offline access
  - Implement offline data synchronization
  - Create offline mode indicators
  - _Requirements: 22_

- [ ] 20.5 Implement performance optimization
  - Create code splitting and lazy loading
  - Implement image optimization
  - Create caching strategies
  - _Requirements: 19, 22_

- [ ] 20.6 Implement performance monitoring
  - Create page load time monitoring
  - Implement performance metrics collection
  - Create performance alerts
  - _Requirements: 19_

## Phase 21: Help and Support

- [ ] 21.1 Implement help documentation system
  - Create help documentation pages
  - Implement context-sensitive help
  - Create help search functionality
  - _Requirements: 23_

- [ ] 21.2 Implement error handling and messaging
  - Create user-friendly error messages
  - Implement error message suggestions
  - Create error logging for support
  - _Requirements: 23_

- [ ] 21.3 Implement support contact system
  - Create support contact information display
  - Implement support ticket submission
  - Create support ticket tracking
  - _Requirements: 23_

- [ ] 21.4 Implement tooltips and inline help
  - Create tooltips for complex features
  - Implement inline help text
  - Create help video links
  - _Requirements: 23_

## Phase 22: Data Serialization and Parsing

- [ ] 22.1 Implement academic record parser
  - Create JSON parser for academic records
  - Implement schema validation
  - Create error reporting with line numbers
  - _Requirements: 24_

- [ ] 22.2 Implement academic record serializer
  - Create JSON serializer for academic records
  - Implement pretty printing with proper formatting
  - Create filtered export by date range, class, or student
  - _Requirements: 24_

- [ ] 22.3 Implement round-trip testing
  - Create property-based tests for parse-print-parse consistency
  - Verify round-trip equivalence for all valid records
  - _Requirements: 24_

- [ ] 22.4 Implement bulk academic record import/export
  - Create batch import endpoint
  - Create batch export endpoint
  - Implement validation for bulk operations
  - _Requirements: 16, 24_

## Phase 23: Testing and Quality Assurance

- [ ] 23.1 Set up testing infrastructure
  - Configure test runner (Jest, Mocha, etc.)
  - Set up test database
  - Create test utilities and fixtures
  - _Requirements: 19_

- [ ] 23.2 Implement unit tests for core business logic
  - Write tests for grade calculations
  - Write tests for attendance calculations
  - Write tests for fee calculations
  - Write tests for schedule conflict detection
  - _Requirements: 19_

- [ ] 23.3 Implement integration tests
  - Write tests for authentication flow
  - Write tests for enrollment workflow
  - Write tests for grade entry workflow
  - Write tests for payment workflow
  - _Requirements: 19_

- [ ] 23.4 Implement API endpoint tests
  - Write tests for all REST endpoints
  - Test authorization and permission checks
  - Test error handling and validation
  - _Requirements: 19_

- [ ] 23.5 Implement UI component tests
  - Write tests for React components
  - Test component rendering and interactions
  - Test responsive behavior
  - _Requirements: 19, 22_

- [ ] 23.6 Implement end-to-end tests
  - Write tests for complete user workflows
  - Test multi-user scenarios
  - Test data consistency across operations
  - _Requirements: 19_

- [ ] 23.7 Implement performance tests
  - Write tests for query performance
  - Test report generation performance
  - Test concurrent user scenarios
  - _Requirements: 19_

- [ ] 23.8 Implement security tests
  - Write tests for authentication bypass attempts
  - Test authorization enforcement
  - Test SQL injection prevention
  - Test XSS prevention
  - _Requirements: 12, 19_

## Phase 24: Deployment and DevOps

- [ ] 24.1 Set up CI/CD pipeline
  - Configure GitHub Actions or similar CI/CD tool
  - Create build pipeline
  - Create test pipeline
  - Create deployment pipeline
  - _Requirements: 19_

- [ ] 24.2 Set up production environment
  - Configure production database
  - Set up production Redis cache
  - Set up production RabbitMQ
  - Configure production environment variables
  - _Requirements: 19_

- [ ] 24.3 Implement deployment automation
  - Create deployment scripts
  - Implement zero-downtime deployment
  - Create rollback procedures
  - _Requirements: 19_

- [ ] 24.4 Set up monitoring and alerting
  - Configure application monitoring
  - Set up error tracking (Sentry, etc.)
  - Create performance monitoring
  - Create alert rules for critical issues
  - _Requirements: 19_

- [ ] 24.5 Implement logging and debugging
  - Configure centralized logging
  - Create log aggregation
  - Implement debug mode for development
  - _Requirements: 19_

- [ ] 24.6 Set up documentation
  - Create API documentation
  - Create deployment documentation
  - Create troubleshooting guide
  - Create user documentation
  - _Requirements: 23_

## Implementation Notes

- Tasks are organized by feature area and build incrementally
- Each task references specific requirements for traceability
- Backend tasks use Node.js/Express with TypeScript
- Frontend tasks use React with TypeScript
- Database uses PostgreSQL with migrations
- Caching uses Redis
- Message queue uses RabbitMQ
- All tasks include proper error handling and validation
- Security best practices are applied throughout
- Audit logging is implemented for compliance
- Mobile responsiveness is considered in all UI tasks

## Complexity Estimates

- **Small**: 1-2 days (basic CRUD, simple calculations)
- **Medium**: 3-5 days (complex logic, multiple components)
- **Large**: 1-2 weeks (major features, significant integration)

Most tasks in this plan are Medium complexity, with some Small tasks for simple features and Large tasks for complex integrations.


---

## EXTERNAL SERVICES INTEGRATION DETAILS

### Brevo Email Service Integration

**Setup Tasks**:
- [ ] Create Brevo account at https://www.brevo.com/
- [ ] Generate API key from Brevo dashboard
- [ ] Create email templates in Brevo:
  - Password reset email
  - Enrollment confirmation email
  - Payment receipt email
  - Grade notification email
  - Attendance alert email
  - Schedule change notification email
  - Fee reminder email
  - Admission letter email
- [ ] Configure sender identity and domain verification
- [ ] Set up email list for bulk communications
- [ ] Test email sending with test API key

**Implementation Tasks**:
- [ ] Create Brevo service wrapper in backend
- [ ] Implement email sending function
- [ ] Create email template mapping
- [ ] Implement retry logic for failed emails
- [ ] Add email logging and tracking
- [ ] Create email notification triggers
- [ ] Implement email preference management
- [ ] Add email delivery status tracking

**Environment Variables**:
```
BREVO_API_KEY=your_api_key_here
BREVO_SENDER_EMAIL=noreply@school.com
BREVO_SENDER_NAME=School Management System
```

---

### UploadThing File Upload Integration

**Setup Tasks**:
- [ ] Create UploadThing account at https://uploadthing.com/
- [ ] Generate API key and App ID
- [ ] Configure file upload routes
- [ ] Set up file type restrictions:
  - Images: jpg, png, gif, webp (max 5MB)
  - Documents: pdf, doc, docx (max 10MB)
  - Certificates: pdf (max 5MB)
- [ ] Configure storage organization by entity type
- [ ] Set up file access permissions
- [ ] Test file upload and retrieval

**Implementation Tasks**:
- [ ] Create UploadThing service wrapper in backend
- [ ] Implement file upload endpoint
- [ ] Create file type validation
- [ ] Implement file size validation
- [ ] Add file metadata storage (filename, size, type, upload date)
- [ ] Create file retrieval endpoint
- [ ] Implement file deletion endpoint
- [ ] Add file access control (role-based)
- [ ] Create file listing endpoint
- [ ] Implement file download functionality

**File Organization Structure**:
```
/students/{studentId}/documents/
/students/{studentId}/photos/
/teachers/{teacherId}/qualifications/
/teachers/{teacherId}/documents/
/admissions/{applicationId}/documents/
/school/resources/
/school/documents/
```

**Environment Variables**:
```
UPLOADTHING_API_KEY=your_api_key_here
UPLOADTHING_APP_ID=your_app_id_here
UPLOADTHING_SECRET=your_secret_here
```

---

### Neon PostgreSQL Database Integration

**Setup Tasks**:
- [ ] Create Neon account at https://neon.tech/
- [ ] Create new project in Neon
- [ ] Create database and user
- [ ] Configure connection pool settings
- [ ] Enable automated backups
- [ ] Set up point-in-time recovery
- [ ] Test database connectivity
- [ ] Configure connection string for different environments

**Connection Pool Configuration**:
- Pool size: 20 connections
- Idle timeout: 5 minutes
- Connection timeout: 30 seconds
- Max retries: 3

**Implementation Tasks**:
- [ ] Create database connection pool in backend
- [ ] Implement connection error handling
- [ ] Add connection retry logic
- [ ] Create database health check endpoint
- [ ] Implement connection monitoring
- [ ] Add database query logging
- [ ] Create backup verification script
- [ ] Implement database migration runner

**Environment Variables**:
```
DATABASE_URL=postgresql://user:password@host/database
DATABASE_POOL_SIZE=20
DATABASE_IDLE_TIMEOUT=300000
DATABASE_CONNECTION_TIMEOUT=30000
```

**Neon-Specific Features**:
- Serverless compute with auto-scaling
- Automatic backups every 24 hours
- Point-in-time recovery (7 days retention)
- Connection pooling with PgBouncer
- Read replicas for scaling read operations
- Branching for development/testing

---

## INTEGRATION CHECKLIST

### Before Starting Implementation

- [ ] All external service accounts created
- [ ] API keys generated and stored securely
- [ ] Environment variables configured
- [ ] Email templates created in Brevo
- [ ] File upload routes configured in UploadThing
- [ ] Database created and accessible in Neon
- [ ] Connection strings tested
- [ ] Team members have access to service dashboards
- [ ] Documentation links bookmarked
- [ ] Support contacts identified for each service

### During Implementation

- [ ] Use test/sandbox credentials during development
- [ ] Implement proper error handling for service failures
- [ ] Add logging for all external service calls
- [ ] Test fallback mechanisms
- [ ] Monitor API rate limits
- [ ] Track API usage and costs
- [ ] Document any service-specific quirks or limitations

### Before Production Deployment

- [ ] Switch to production API keys
- [ ] Configure production email sender identity
- [ ] Set up production file storage buckets
- [ ] Configure production database backups
- [ ] Test all external service integrations in staging
- [ ] Set up monitoring and alerting for external services
- [ ] Document production configuration
- [ ] Create runbooks for service failures
- [ ] Set up incident response procedures

---

## COST ESTIMATION

### Brevo Email Service
- Free tier: Up to 300 emails/day
- Paid tier: Starting from €20/month for 20,000 emails/month
- Estimated cost for school: €20-50/month depending on email volume

### UploadThing
- Free tier: 4GB storage, 2GB/month bandwidth
- Paid tier: Starting from $10/month for 100GB storage
- Estimated cost for school: $10-30/month depending on file volume

### Neon PostgreSQL
- Free tier: 3 projects, 0.5GB storage, 1 shared compute
- Paid tier: Starting from $15/month for dedicated compute
- Estimated cost for school: $15-50/month depending on usage

**Total Estimated Monthly Cost**: $45-130/month

---

## MONITORING AND MAINTENANCE

### Brevo Email Service
- Monitor email delivery rates
- Track bounce and complaint rates
- Review email engagement metrics
- Manage email list hygiene
- Update email templates as needed

### UploadThing File Upload
- Monitor storage usage
- Track upload/download bandwidth
- Review file access patterns
- Clean up old/unused files
- Verify file integrity

### Neon PostgreSQL
- Monitor database performance
- Track query execution times
- Review connection pool usage
- Monitor storage growth
- Verify backup completion
- Test point-in-time recovery procedures

---

## TROUBLESHOOTING GUIDE

### Brevo Email Issues
- **Emails not sending**: Check API key, sender identity verification, email template
- **High bounce rate**: Review email list quality, check for typos in addresses
- **Rate limiting**: Implement exponential backoff, batch email sending
- **Template errors**: Validate template variables, test with sample data

### UploadThing File Issues
- **Upload failures**: Check file size, file type, API key, network connectivity
- **Storage quota exceeded**: Archive old files, upgrade plan, delete unused files
- **Access denied**: Verify file permissions, check API key, review access control rules
- **Slow uploads**: Check network speed, file size, server load

### Neon PostgreSQL Issues
- **Connection failures**: Check connection string, verify IP whitelist, check credentials
- **Slow queries**: Review query plans, add indexes, optimize queries
- **Connection pool exhausted**: Increase pool size, review connection usage, close idle connections
- **Backup failures**: Check storage space, verify backup configuration, contact Neon support

---

## SECURITY CONSIDERATIONS

### API Key Management
- Store all API keys in environment variables
- Never commit API keys to version control
- Rotate API keys regularly (every 90 days)
- Use separate keys for development and production
- Implement key rotation procedures

### Data Protection
- Encrypt sensitive data before uploading to UploadThing
- Use HTTPS for all external service communications
- Implement rate limiting to prevent abuse
- Monitor for suspicious activity
- Implement audit logging for all external service calls

### Compliance
- Ensure GDPR compliance for email communications
- Implement data retention policies
- Provide data export functionality
- Implement data deletion procedures
- Document data processing agreements with external services

---

## DOCUMENTATION LINKS

- **Brevo API Documentation**: https://developers.brevo.com/
- **Brevo Email Templates**: https://www.brevo.com/features/email-templates/
- **UploadThing Documentation**: https://docs.uploadthing.com/
- **UploadThing API Reference**: https://docs.uploadthing.com/api-reference
- **Neon Documentation**: https://neon.tech/docs/
- **Neon Connection Pooling**: https://neon.tech/docs/connect/connection-pooling
- **Neon Backups**: https://neon.tech/docs/manage/backups

---

## SUPPORT CONTACTS

- **Brevo Support**: support@brevo.com
- **UploadThing Support**: support@uploadthing.com
- **Neon Support**: support@neon.tech

---

## NEXT STEPS

1. Create accounts for all three external services
2. Generate and securely store API keys
3. Configure environment variables
4. Implement service wrappers in backend
5. Create integration tests
6. Document integration procedures
7. Set up monitoring and alerting
8. Train team on service usage and troubleshooting
