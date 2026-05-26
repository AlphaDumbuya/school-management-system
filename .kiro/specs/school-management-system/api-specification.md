# School Management System - API Specification (OpenAPI 3.0)

## Overview

This document provides the complete OpenAPI 3.0 specification for the School Management System REST API. It defines all endpoints, request/response schemas, authentication, and error handling.

---

## OpenAPI Definition

```yaml
openapi: 3.0.0
info:
  title: School Management System API
  description: Multi-tenant SaaS platform for school operations management
  version: 1.0.0
  contact:
    name: API Support
    email: api-support@schoolmgmt.com
  license:
    name: Proprietary
    url: https://schoolmgmt.com/license

servers:
  - url: https://api.schoolmgmt.com/api/v1
    description: Production
  - url: https://staging-api.schoolmgmt.com/api/v1
    description: Staging
  - url: http://localhost:3000/api/v1
    description: Development

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT token obtained from login endpoint

  schemas:
    # Common Schemas
    Error:
      type: object
      required:
        - code
        - message
        - timestamp
      properties:
        code:
          type: string
          enum:
            - VALIDATION_ERROR
            - AUTHENTICATION_ERROR
            - AUTHORIZATION_ERROR
            - NOT_FOUND
            - CONFLICT
            - RATE_LIMIT_EXCEEDED
            - INTERNAL_ERROR
            - SERVICE_UNAVAILABLE
        message:
          type: string
        details:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string
        timestamp:
          type: string
          format: date-time
        request_id:
          type: string

    Pagination:
      type: object
      properties:
        page:
          type: integer
          minimum: 1
        limit:
          type: integer
          minimum: 1
          maximum: 100
        total:
          type: integer
        total_pages:
          type: integer

    # Authentication Schemas
    LoginRequest:
      type: object
      required:
        - email
        - password
      properties:
        email:
          type: string
          format: email
        password:
          type: string
          minLength: 8

    LoginResponse:
      type: object
      properties:
        access_token:
          type: string
        refresh_token:
          type: string
        expires_in:
          type: integer
        token_type:
          type: string
          enum: [Bearer]

    RegisterRequest:
      type: object
      required:
        - email
        - password
        - first_name
        - last_name
        - school_name
      properties:
        email:
          type: string
          format: email
        password:
          type: string
          minLength: 12
          pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$'
        first_name:
          type: string
          minLength: 1
          maxLength: 50
        last_name:
          type: string
          minLength: 1
          maxLength: 50
        school_name:
          type: string
          minLength: 1
          maxLength: 100

    # Student Schemas
    Student:
      type: object
      required:
        - student_id
        - first_name
        - last_name
        - email
        - tenant_id
      properties:
        student_id:
          type: string
          format: uuid
        tenant_id:
          type: string
          format: uuid
        first_name:
          type: string
          maxLength: 50
        last_name:
          type: string
          maxLength: 50
        email:
          type: string
          format: email
        date_of_birth:
          type: string
          format: date
        gender:
          type: string
          enum: [M, F, Other]
        contact_info:
          type: object
          properties:
            phone:
              type: string
            address:
              type: string
            city:
              type: string
            state:
              type: string
            postal_code:
              type: string
        guardians:
          type: array
          items:
            type: object
            properties:
              name:
                type: string
              relationship:
                type: string
              phone:
                type: string
              email:
                type: string
        enrollment_date:
          type: string
          format: date
        status:
          type: string
          enum: [active, inactive, withdrawn]
        gpa:
          type: number
          format: float
          minimum: 0
          maximum: 4.0
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    StudentCreateRequest:
      type: object
      required:
        - first_name
        - last_name
        - email
      properties:
        first_name:
          type: string
          minLength: 1
          maxLength: 50
        last_name:
          type: string
          minLength: 1
          maxLength: 50
        email:
          type: string
          format: email
        date_of_birth:
          type: string
          format: date
        gender:
          type: string
          enum: [M, F, Other]
        contact_info:
          type: object
        guardians:
          type: array
          items:
            type: object

    StudentUpdateRequest:
      type: object
      properties:
        first_name:
          type: string
          minLength: 1
          maxLength: 50
        last_name:
          type: string
          minLength: 1
          maxLength: 50
        email:
          type: string
          format: email
        date_of_birth:
          type: string
          format: date
        gender:
          type: string
          enum: [M, F, Other]
        contact_info:
          type: object
        guardians:
          type: array
          items:
            type: object
        status:
          type: string
          enum: [active, inactive, withdrawn]

    # Grade Schemas
    Grade:
      type: object
      required:
        - grade_id
        - student_id
        - subject_id
        - grade_value
      properties:
        grade_id:
          type: string
          format: uuid
        student_id:
          type: string
          format: uuid
        subject_id:
          type: string
          format: uuid
        class_id:
          type: string
          format: uuid
        grade_value:
          type: integer
          minimum: 0
          maximum: 100
        letter_grade:
          type: string
          enum: [A, B, C, D, F]
        session_id:
          type: string
          format: uuid
        recorded_by:
          type: string
          format: uuid
        recorded_date:
          type: string
          format: date-time
        modified_date:
          type: string
          format: date-time
        modification_reason:
          type: string
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    GradeCreateRequest:
      type: object
      required:
        - student_id
        - subject_id
        - grade_value
      properties:
        student_id:
          type: string
          format: uuid
        subject_id:
          type: string
          format: uuid
        class_id:
          type: string
          format: uuid
        grade_value:
          type: integer
          minimum: 0
          maximum: 100
        session_id:
          type: string
          format: uuid

    # Attendance Schemas
    Attendance:
      type: object
      required:
        - attendance_id
        - student_id
        - session_date
        - status
      properties:
        attendance_id:
          type: string
          format: uuid
        student_id:
          type: string
          format: uuid
        class_id:
          type: string
          format: uuid
        session_date:
          type: string
          format: date
        status:
          type: string
          enum: [present, absent, late]
        recorded_by:
          type: string
          format: uuid
        recorded_date:
          type: string
          format: date-time
        notes:
          type: string
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    AttendanceCreateRequest:
      type: object
      required:
        - student_id
        - session_date
        - status
      properties:
        student_id:
          type: string
          format: uuid
        class_id:
          type: string
          format: uuid
        session_date:
          type: string
          format: date
        status:
          type: string
          enum: [present, absent, late]
        notes:
          type: string

    # Fee Schemas
    Fee:
      type: object
      required:
        - fee_id
        - fee_type
        - amount
      properties:
        fee_id:
          type: string
          format: uuid
        fee_type:
          type: string
          enum: [tuition, activity, library, transport, other]
        amount:
          type: number
          format: decimal
          minimum: 0
        due_date:
          type: string
          format: date
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    Payment:
      type: object
      required:
        - payment_id
        - amount
        - payment_date
      properties:
        payment_id:
          type: string
          format: uuid
        student_fee_id:
          type: string
          format: uuid
        amount:
          type: number
          format: decimal
          minimum: 0
        payment_date:
          type: string
          format: date-time
        payment_method:
          type: string
          enum: [credit_card, debit_card, bank_transfer, cash, check]
        transaction_id:
          type: string
        is_late:
          type: boolean
        penalty_amount:
          type: number
          format: decimal
        created_at:
          type: string
          format: date-time

    PaymentCreateRequest:
      type: object
      required:
        - student_fee_id
        - amount
        - payment_method
      properties:
        student_fee_id:
          type: string
          format: uuid
        amount:
          type: number
          format: decimal
          minimum: 0
        payment_method:
          type: string
          enum: [credit_card, debit_card, bank_transfer, cash, check]
        transaction_id:
          type: string

    # Class Schemas
    Class:
      type: object
      required:
        - class_id
        - class_name
        - capacity
      properties:
        class_id:
          type: string
          format: uuid
        class_name:
          type: string
          maxLength: 100
        academic_level:
          type: string
        capacity:
          type: integer
          minimum: 1
        session_id:
          type: string
          format: uuid
        enrolled_count:
          type: integer
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time

    ClassCreateRequest:
      type: object
      required:
        - class_name
        - capacity
      properties:
        class_name:
          type: string
          minLength: 1
          maxLength: 100
        academic_level:
          type: string
        capacity:
          type: integer
          minimum: 1
        session_id:
          type: string
          format: uuid

    # Report Schemas
    Report:
      type: object
      required:
        - report_id
        - report_type
        - status
      properties:
        report_id:
          type: string
          format: uuid
        report_type:
          type: string
          enum: [student_grades, attendance_summary, financial_summary, performance_analysis]
        status:
          type: string
          enum: [pending, processing, completed, failed]
        generated_by:
          type: string
          format: uuid
        generated_at:
          type: string
          format: date-time
        file_url:
          type: string
          format: uri
        filters:
          type: object

    ReportGenerateRequest:
      type: object
      required:
        - report_type
      properties:
        report_type:
          type: string
          enum: [student_grades, attendance_summary, financial_summary, performance_analysis]
        filters:
          type: object
        format:
          type: string
          enum: [pdf, excel, csv]

security:
  - BearerAuth: []

paths:
  /auth/register:
    post:
      tags:
        - Authentication
      summary: Register new user
      operationId: registerUser
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RegisterRequest'
      responses:
        '201':
          description: User registered successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  user_id:
                    type: string
                    format: uuid
                  email:
                    type: string
                  tenant_id:
                    type: string
                    format: uuid
        '400':
          description: Validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '409':
          description: User already exists
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /auth/login:
    post:
      tags:
        - Authentication
      summary: User login
      operationId: loginUser
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
      responses:
        '200':
          description: Login successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LoginResponse'
        '401':
          description: Invalid credentials
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '429':
          description: Too many login attempts
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /auth/refresh:
    post:
      tags:
        - Authentication
      summary: Refresh JWT token
      operationId: refreshToken
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - refresh_token
              properties:
                refresh_token:
                  type: string
      responses:
        '200':
          description: Token refreshed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LoginResponse'
        '401':
          description: Invalid refresh token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /auth/logout:
    post:
      tags:
        - Authentication
      summary: User logout
      operationId: logoutUser
      responses:
        '200':
          description: Logout successful
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /students:
    get:
      tags:
        - Students
      summary: List students
      operationId: listStudents
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
        - name: search
          in: query
          schema:
            type: string
        - name: status
          in: query
          schema:
            type: string
            enum: [active, inactive, withdrawn]
      responses:
        '200':
          description: List of students
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Student'
                  pagination:
                    $ref: '#/components/schemas/Pagination'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

    post:
      tags:
        - Students
      summary: Create new student
      operationId: createStudent
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/StudentCreateRequest'
      responses:
        '201':
          description: Student created
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/Student'
        '400':
          description: Validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '403':
          description: Insufficient permissions
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /students/{studentId}:
    get:
      tags:
        - Students
      summary: Get student details
      operationId: getStudent
      parameters:
        - name: studentId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Student details
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/Student'
        '404':
          description: Student not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

    put:
      tags:
        - Students
      summary: Update student
      operationId: updateStudent
      parameters:
        - name: studentId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/StudentUpdateRequest'
      responses:
        '200':
          description: Student updated
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/Student'
        '404':
          description: Student not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

    delete:
      tags:
        - Students
      summary: Deactivate student
      operationId: deleteStudent
      parameters:
        - name: studentId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '204':
          description: Student deactivated
        '404':
          description: Student not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /grades:
    get:
      tags:
        - Grades
      summary: List grades
      operationId: listGrades
      parameters:
        - name: student_id
          in: query
          schema:
            type: string
            format: uuid
        - name: class_id
          in: query
          schema:
            type: string
            format: uuid
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: List of grades
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Grade'
                  pagination:
                    $ref: '#/components/schemas/Pagination'

    post:
      tags:
        - Grades
      summary: Record grade
      operationId: createGrade
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/GradeCreateRequest'
      responses:
        '201':
          description: Grade recorded
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/Grade'
        '400':
          description: Validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /grades/{gradeId}:
    put:
      tags:
        - Grades
      summary: Update grade
      operationId: updateGrade
      parameters:
        - name: gradeId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/GradeCreateRequest'
      responses:
        '200':
          description: Grade updated
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/Grade'
        '404':
          description: Grade not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /attendance:
    get:
      tags:
        - Attendance
      summary: List attendance records
      operationId: listAttendance
      parameters:
        - name: student_id
          in: query
          schema:
            type: string
            format: uuid
        - name: class_id
          in: query
          schema:
            type: string
            format: uuid
        - name: date_from
          in: query
          schema:
            type: string
            format: date
        - name: date_to
          in: query
          schema:
            type: string
            format: date
      responses:
        '200':
          description: List of attendance records
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Attendance'

    post:
      tags:
        - Attendance
      summary: Record attendance
      operationId: createAttendance
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AttendanceCreateRequest'
      responses:
        '201':
          description: Attendance recorded
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/Attendance'

  /payments:
    post:
      tags:
        - Payments
      summary: Record payment
      operationId: createPayment
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PaymentCreateRequest'
      responses:
        '201':
          description: Payment recorded
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/Payment'
        '400':
          description: Validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /reports/generate:
    post:
      tags:
        - Reports
      summary: Generate report
      operationId: generateReport
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ReportGenerateRequest'
      responses:
        '202':
          description: Report generation started
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/Report'
        '400':
          description: Validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /reports/{reportId}:
    get:
      tags:
        - Reports
      summary: Get report
      operationId: getReport
      parameters:
        - name: reportId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Report details
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/Report'
        '404':
          description: Report not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
```

---

## Rate Limiting

**Rate Limits:**
- Authenticated Users: 1000 requests/hour
- Unauthenticated Users: 100 requests/hour
- Burst Limit: 50 requests/minute

**Rate Limit Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1234567890
```

**Rate Limit Exceeded Response:**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later.",
    "retry_after": 3600
  }
}
```

---

## Pagination

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response Format:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

---

## Filtering & Sorting

**Filtering:**
```
GET /api/v1/students?status=active&search=john
```

**Sorting:**
```
GET /api/v1/students?sort=first_name:asc,created_at:desc
```

---

## Error Handling

**Error Response Format:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input provided",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ],
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "req_123456"
  }
}
```

**HTTP Status Codes:**
- 200: OK
- 201: Created
- 202: Accepted (async operation)
- 204: No Content
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict
- 429: Too Many Requests
- 500: Internal Server Error
- 503: Service Unavailable

---

## Webhooks

**Webhook Events:**
- `student.created`
- `student.updated`
- `grade.recorded`
- `payment.received`
- `report.completed`

**Webhook Payload:**
```json
{
  "event": "student.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "student_id": "uuid",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com"
  }
}
```

---

## Versioning

**API Versioning Strategy:**
- URL-based versioning: `/api/v1/`, `/api/v2/`
- Current Version: v1
- Deprecation Policy: 12-month notice before removal

---

## Authentication Details

**JWT Token Claims:**
```json
{
  "sub": "user_id",
  "tenant_id": "tenant_id",
  "email": "user@example.com",
  "role": "teacher",
  "permissions": ["grade:read", "grade:write"],
  "iat": 1234567890,
  "exp": 1234571490,
  "iss": "school-management-system"
}
```

**Token Refresh:**
- Access Token Expiration: 1 hour
- Refresh Token Expiration: 7 days
- Refresh Endpoint: `POST /auth/refresh`

---

## CORS Configuration

**Allowed Origins:**
- Production: https://schoolmgmt.com
- Staging: https://staging.schoolmgmt.com
- Development: http://localhost:3000

**Allowed Methods:**
- GET, POST, PUT, DELETE, PATCH, OPTIONS

**Allowed Headers:**
- Content-Type
- Authorization
- X-Request-ID

